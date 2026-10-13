param(
    [string]$WindowsBuild = 'build/windows',
    [string]$NativeDependencies = 'build/native-deps',
    [string]$LinuxInstall = 'build/linux-install',
    [string]$LinuxExamples = 'build/linux-examples',
    [string]$WebBuild = 'build/web/web',
    [string]$Destination = 'distribution',
    [string]$CMakePath = 'cmake'
)
$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath("$PSScriptRoot/../..")
$excludedNames = @(python "$PSScriptRoot/../lib/distribution_policy.py" --excluded-names)
if ($LASTEXITCODE) { throw 'Distribution policy query failed.' }
$targetRoot = [IO.Path]::GetFullPath((Join-Path $projectRoot $Destination))
New-Item -ItemType Directory -Force -Path $targetRoot | Out-Null
function Copy-Artifact([string]$source, [string]$target) {
    if ((Get-Item -LiteralPath $source).PSIsContainer) {
        New-Item -ItemType Directory -Force -Path $target | Out-Null
        Get-ChildItem -LiteralPath $source | Where-Object {
            $_.Name -notin $excludedNames -and $_.Name -ne '__pycache__' -and $_.Extension -ne '.pyc' -and
                $_.Name -notin @('node_modules', '.next', 'dist', 'out', 'public', 'runtime') -and
                $_.Name -ne 'build' -and -not $_.Name.EndsWith('.egg-info')
        } | ForEach-Object {
            Copy-Artifact $_.FullName (Join-Path $target $_.Name)
        }
        return
    }
    New-Item -ItemType Directory -Force -Path (Split-Path $target) | Out-Null
    Copy-Item -LiteralPath $source -Destination $target -Force -Recurse
}
if (Test-Path "$projectRoot/$WindowsBuild/bin/motion-input-grid-studio.exe") {
    & $CMakePath --install "$projectRoot/$WindowsBuild" --config Release --prefix "$targetRoot/windows/sdk"
    if ($LASTEXITCODE) { throw 'Windows SDK installation failed.' }
    foreach ($name in @('motion-input-grid-studio.exe', 'motion-input-grid-controller.exe', 'libmediapipe.dll', 'models', 'configs')) {
        Copy-Artifact "$projectRoot/$WindowsBuild/bin/$name" "$targetRoot/windows/$name"
    }
    if (Test-Path "$targetRoot/windows/sdk/bin/mig-c.dll") {
        Copy-Artifact "$targetRoot/windows/sdk/bin/mig-c.dll" "$targetRoot/windows/mig-c.dll"
    }
    foreach ($name in @('MediaPipe-LICENSE', 'nlohmann-LICENSE')) {
        Copy-Artifact "$projectRoot/$NativeDependencies/$name" "$targetRoot/windows/licenses/$name"
    }
}
if (Test-Path "$projectRoot/$LinuxInstall/include") {
    New-Item -ItemType Directory -Force -Path "$targetRoot/linux/sdk" | Out-Null
    Get-ChildItem -LiteralPath "$projectRoot/$LinuxInstall" | ForEach-Object {
        Copy-Artifact $_.FullName "$targetRoot/linux/sdk/$($_.Name)"
    }
    foreach ($name in @('mig-sdl2', 'mig-sfml')) {
        $exampleFolder = if ($name -eq 'mig-sdl2') { 'sdl2' } else { 'sfml' }
        if (Test-Path "$projectRoot/$LinuxExamples/$exampleFolder/$name") {
            Copy-Artifact "$projectRoot/$LinuxExamples/$exampleFolder/$name" "$targetRoot/linux/$name"
        }
    }
    foreach ($name in @('motion-input-grid-studio', 'motion-input-grid-controller')) {
        if (Test-Path "$projectRoot/$LinuxInstall/bin/$name") {
            Copy-Artifact "$projectRoot/$LinuxInstall/bin/$name" "$targetRoot/linux/$name"
        }
    }
    if (Test-Path "$projectRoot/$LinuxInstall/lib/libmig-c.so") {
        Copy-Artifact "$projectRoot/$LinuxInstall/lib/libmig-c.so" "$targetRoot/linux/libmig-c.so"
    }
    foreach ($name in @('libmediapipe.so', 'models', 'LICENSE', 'nlohmann-LICENSE')) {
        Copy-Artifact "$projectRoot/build/native-linux-deps/$name" "$targetRoot/linux/$name"
    }
    Copy-Artifact "$projectRoot/configs/default.json" "$targetRoot/linux/configs/default.json"
}
if (Test-Path "$projectRoot/$WebBuild/mig.wasm") {
    foreach ($name in @('mig.mjs', 'mig.wasm')) {
        Copy-Artifact "$projectRoot/$WebBuild/$name" "$targetRoot/web/$name"
    }
    Get-ChildItem -LiteralPath "$projectRoot/examples/web" | ForEach-Object {
        Copy-Artifact $_.FullName "$targetRoot/web/$($_.Name)"
    }
    Copy-Artifact "$projectRoot/examples/common/raised-hands.json" "$targetRoot/web/default.json"
    Copy-Artifact "$projectRoot/build/native-deps/vision" "$targetRoot/web/vision"
    foreach ($name in @('pose_landmarker_lite.task', 'hand_landmarker.task')) {
        Copy-Artifact "$projectRoot/build/native-deps/models/$name" "$targetRoot/web/models/$name"
    }
    $webLicense = "$projectRoot/build/native-deps/mediapipe-package/mediapipe-0.10.35.dist-info/licenses/LICENSE"
    if (-not (Test-Path $webLicense)) { $webLicense = "$projectRoot/build/native-deps/MediaPipe-LICENSE" }
    Copy-Artifact $webLicense "$targetRoot/web/licenses/MediaPipe-LICENSE"
    foreach ($name in @('nlohmann-LICENSE', 'Emscripten-LICENSE', 'libcxx-LICENSE',
            'libcxxabi-LICENSE', 'compiler-rt-LICENSE', 'libunwind-LICENSE', 'musl-LICENSE')) {
        Copy-Artifact "$projectRoot/build/native-deps/$name" "$targetRoot/web/licenses/$name"
    }
}
foreach ($language in @('', '.fr')) {
    $guideSource = "$projectRoot/readme.md"
    if ($language -eq '.fr') { $guideSource = "$projectRoot/docs/fr/readme.fr.md" }
    $guide = [IO.File]::ReadAllText($guideSource)
    if ($language -eq '.fr') {
        $guide = $guide.Replace('(../../', '(').Replace('(../', '(docs/')
        $guide = $guide.Replace('(CONTRIBUTING.fr.md)', '(docs/fr/CONTRIBUTING.fr.md)')
        $guide = $guide.Replace('(SECURITY.fr.md)', '(docs/fr/SECURITY.fr.md)')
    }
    $guide = $guide.Replace('(readme.md)', '(README.md)').Replace('(readme.fr.md)', '(README.fr.md)')
    $guide = $guide.Replace('(docs/fr/readme.fr.md)', '(README.fr.md)')
    [IO.File]::WriteAllText("$targetRoot/README$language.md", $guide, [Text.UTF8Encoding]::new($false))
}
Copy-Artifact "$projectRoot/examples" "$targetRoot/examples"
Copy-Artifact "$projectRoot/bindings" "$targetRoot/bindings"
Copy-Artifact "$projectRoot/integrations" "$targetRoot/integrations"
Copy-Artifact "$projectRoot/ports" "$targetRoot/ports"
Copy-Artifact "$projectRoot/docs" "$targetRoot/docs"
Copy-Artifact "$projectRoot/CONTRIBUTING.md" "$targetRoot/CONTRIBUTING.md"
Copy-Artifact "$projectRoot/SECURITY.md" "$targetRoot/SECURITY.md"
Copy-Artifact "$projectRoot/LICENSE" "$targetRoot/LICENSE"
Write-Output "Distribution ready: $targetRoot"
