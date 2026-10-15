param(
    [string]$Distribution = 'distribution/windows',
    [ValidateSet('x64', 'arm64')][string]$Architecture = 'x64',
    [ValidatePattern('^\d+\.\d+\.\d+$')][string]$Version = (Get-Content "$PSScriptRoot/../../VERSION" -Raw).Trim(),
    [string]$Destination = 'build/releases'
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression
function Write-ReleaseArchive([string]$folder, [string]$path) {
    $stream = [IO.File]::Open($path, [IO.FileMode]::Create)
    $zip = [IO.Compression.ZipArchive]::new($stream, [IO.Compression.ZipArchiveMode]::Create)
    try {
        $prefix = Split-Path $folder -Leaf
        Get-ChildItem -LiteralPath $folder -Recurse -File | ForEach-Object {
            $relative = $_.FullName.Substring($folder.Length + 1).Replace('\', '/')
            $entry = $zip.CreateEntry("$prefix/$relative", [IO.Compression.CompressionLevel]::Optimal)
            $inputStream = [IO.File]::OpenRead($_.FullName)
            $outputStream = $entry.Open()
            try { $inputStream.CopyTo($outputStream) }
            finally { $outputStream.Dispose(); $inputStream.Dispose() }
        }
    } finally { $zip.Dispose(); $stream.Dispose() }
}
$projectRoot = [IO.Path]::GetFullPath("$PSScriptRoot/../..")
$source = [IO.Path]::GetFullPath((Join-Path $projectRoot $Distribution))
$output = [IO.Path]::GetFullPath((Join-Path $projectRoot $Destination))
foreach ($name in @('motion-input-grid-controller.exe', 'motion-input-grid-studio.exe', 'libmediapipe.dll', 'mig-c.dll', 'sdk', 'models')) {
    if (-not (Test-Path -LiteralPath (Join-Path $source $name))) {
        throw "Release artifact missing: $name"
    }
}
$expectedMachine = if ($Architecture -eq 'arm64') { 0xAA64 } else { 0x8664 }
Get-ChildItem -LiteralPath $source -Recurse -File | Where-Object {
    $_.Extension -in @('.exe', '.dll')
} | ForEach-Object {
    $binary = [IO.File]::ReadAllBytes($_.FullName)
    $peOffset = [BitConverter]::ToInt32($binary, 0x3C)
    if ([BitConverter]::ToUInt16($binary, $peOffset + 4) -ne $expectedMachine) {
        throw "Architecture mismatch: $($_.Name)"
    }
}
New-Item -ItemType Directory -Force -Path $output | Out-Null
$staging = Join-Path $output ('staging-' + [guid]::NewGuid().ToString('N'))
$name = "motion-input-grid-$Version-windows-$Architecture-native"
$package = Join-Path $staging $name
try {
    New-Item -ItemType Directory -Force -Path $package | Out-Null
    Copy-Item -LiteralPath $source -Destination (Join-Path $package 'windows') -Recurse
    foreach ($folder in @('docs', 'examples', 'bindings')) {
        $prepared = Join-Path (Split-Path $source) $folder
        Copy-Item -LiteralPath $prepared -Destination (Join-Path $package $folder) -Recurse
    }
    Copy-Item -LiteralPath (Join-Path $projectRoot 'LICENSE') -Destination $package
    @"
# Motion Input Grid (MIG) $Version - Windows $Architecture

[English](README.md) | [Français](README.fr.md)

Run windows/motion-input-grid-controller.exe or windows/motion-input-grid-studio.exe.
Install the latest Microsoft Visual C++ x64 Redistributable first.
Set CMAKE_PREFIX_PATH to windows/sdk for C++ consumers.

See [package installation](docs/getting-started/packages.md) and the
[support matrix](docs/reference/support.md) for prerequisites and limitations.
"@ | Set-Content -LiteralPath (Join-Path $package 'README.md') -Encoding UTF8
    @"
# Motion Input Grid (MIG) $Version - Windows $Architecture

[English](README.md) | [Français](README.fr.md)

Lancez windows/motion-input-grid-controller.exe ou windows/motion-input-grid-studio.exe.
Installez le dernier Microsoft Visual C++ Redistributable x64.
Utilisez windows/sdk comme CMAKE_PREFIX_PATH pour compiler un consommateur.

[Installation](docs/getting-started/packages.fr.md) et [support](docs/reference/support.fr.md).
"@ | Set-Content -LiteralPath (Join-Path $package 'README.fr.md') -Encoding UTF8
    $hashes = [ordered]@{}
    Get-ChildItem -LiteralPath $package -Recurse -File | Sort-Object FullName | ForEach-Object {
        $relative = $_.FullName.Substring($package.Length + 1).Replace('\', '/')
        $hashes[$relative] = (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
    }
    $manifest = [ordered]@{
        project = 'Motion Input Grid'
        package = 'motion-input-grid'
        repository = 'https://github.com/Robin-G0/Motion-Input-Grid'
        version = $Version
        architecture = $Architecture
        sha256 = $hashes
    }
    $manifest | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $package 'manifest.json') -Encoding UTF8
    $archive = Join-Path $output "$name.zip"
    Write-ReleaseArchive $package $archive
    $digest = (Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant()
    "$digest  $name.zip" | Set-Content -LiteralPath "$archive.sha256" -Encoding ASCII
    Write-Output $archive
    if ($Architecture -eq 'x64') {
        $vswhere = "${env:ProgramFiles(x86)}/Microsoft Visual Studio/Installer/vswhere.exe"
        $vsDirectory = & $vswhere -latest -products '*' -property installationPath
        $crt = Get-ChildItem -LiteralPath (Join-Path $vsDirectory 'VC/Redist/MSVC') -Directory |
            Where-Object { $_.Name -match '^\d+\.\d+\.\d+$' } |
            Sort-Object { [version]$_.Name } -Descending |
            ForEach-Object { Get-ChildItem -Path (Join-Path $_.FullName 'x64/Microsoft.VC*.CRT') -Directory } |
            Select-Object -First 1
        if (-not $crt) { throw 'App-local Visual C++ runtime not found for standalone Controller packaging.' }
        $portableCmake = Join-Path $vsDirectory 'Common7/IDE/CommonExtensions/Microsoft/CMake/CMake/bin/cmake.exe'
        python (Join-Path $projectRoot 'tools/packaging/package-controller.py') --platform windows --source $source --redist $crt.FullName --cmake $portableCmake --output $output --version $Version
        if ($LASTEXITCODE -ne 0) { throw 'Standalone Controller packaging failed.' }
    }
} finally {
    $resolvedStaging = [IO.Path]::GetFullPath($staging)
    if (-not $resolvedStaging.StartsWith($output + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
        throw 'Refusing cleanup outside the release destination.'
    }
    if (Test-Path -LiteralPath $resolvedStaging) {
        Remove-Item -LiteralPath $resolvedStaging -Recurse -Force
    }
}
