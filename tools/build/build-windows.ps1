param(
    [ValidateSet('Debug', 'Release')][string]$Configuration = 'Release',
    [ValidateSet('ON', 'OFF')][string]$Hands = 'ON',
    [ValidateSet('x64', 'ARM64')][string]$Architecture = 'x64',
    [string]$BuildDirectory = "$PSScriptRoot/../../build/windows",
    [switch]$SkipBootstrap
)
$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath("$PSScriptRoot/../..")
$buildPath = [IO.Path]::GetFullPath($BuildDirectory)
$nativeDeps = Join-Path $projectRoot 'build/native-deps'
if ($Architecture -eq 'ARM64') {
    $nativeDeps = Join-Path $projectRoot 'build/native-deps-arm64'
}
if (-not $SkipBootstrap) {
    & "$PSScriptRoot/../bootstrap/bootstrap-native.ps1" -Destination $nativeDeps -Architecture $Architecture -SkipHands:($Hands -eq 'OFF')
}

$cmakeTool = Get-Command cmake -ErrorAction SilentlyContinue
if ($cmakeTool) {
    $cmakePath = $cmakeTool.Source
} else {
    $vswherePath = "${env:ProgramFiles(x86)}/Microsoft Visual Studio/Installer/vswhere.exe"
    if (-not (Test-Path $vswherePath)) {
        throw 'Install Visual Studio 2022 C++ Build Tools and CMake.'
    }
    $vsPath = & $vswherePath -latest -products '*' -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath
    $cmakePath = Join-Path $vsPath 'Common7/IDE/CommonExtensions/Microsoft/CMake/CMake/bin/cmake.exe'
}
if (-not (Test-Path $cmakePath)) {
    throw 'CMake not found. Install the CMake component in Visual Studio.'
}

& $cmakePath -S $projectRoot -B $buildPath -G 'Visual Studio 17 2022' -A $Architecture "-DMIG_BUILD_HANDS=$Hands" "-DMIG_NATIVE_DEPS=$nativeDeps"
if ($LASTEXITCODE) {
    throw 'CMake configuration failed.'
}
& $cmakePath --build $buildPath --config $Configuration
if ($LASTEXITCODE) {
    throw 'Compilation failed.'
}
$ctestPath = Join-Path (Split-Path $cmakePath) 'ctest.exe'
if ($Architecture -eq 'x64' -or $env:PROCESSOR_ARCHITECTURE -eq 'ARM64') {
    & $ctestPath --test-dir $buildPath -C $Configuration --output-on-failure
    if ($LASTEXITCODE) {
        throw 'Tests failed.'
    }
} else {
    Write-Output 'ARM64 binaries cross-compiled; run CTest on Windows ARM64 before publishing.'
}
Write-Output "Run $buildPath/bin/motion-input-grid-studio.exe or motion-input-grid-controller.exe"
