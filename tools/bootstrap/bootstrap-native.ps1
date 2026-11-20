param(
    [string]$Destination = "$PSScriptRoot/../../build/native-deps",
    [ValidateSet('x64', 'ARM64')][string]$Architecture = 'x64',
    [switch]$SkipHands,
    # The Heavy pose model is downloaded on demand by the applications; bundle it only when asked.
    [switch]$IncludeHeavy
)
$ErrorActionPreference = 'Stop'
. "$PSScriptRoot/../lib/download.ps1"
$root = [IO.Path]::GetFullPath($Destination)
New-Item -ItemType Directory -Force -Path $root | Out-Null
$version = '0.10.35'
$metadata = Invoke-MigRequest {
    Invoke-RestMethod "https://pypi.org/pypi/mediapipe/$version/json" -TimeoutSec 90 -ErrorAction Stop
}
$wheelPlatform = if ($Architecture -eq 'ARM64') { 'win_arm64' } else { 'win_amd64' }
$wheel = $metadata.urls | Where-Object filename -eq "mediapipe-$version-py3-none-$wheelPlatform.whl"
if (-not $wheel) {
    throw "Official Windows $Architecture MediaPipe archive not found."
}
$archive = Join-Path $root 'mediapipe.zip'
$pinnedHash = if ($Architecture -eq 'ARM64') {
    '46255326a6213118aaa518a7aa25e35f93337e82677960cc2a945f117bff8444'
} else {
    'b08f001cf3c3cd0d88d9ed68f3368dc8a4913f568281a93117f083115aa672ba'
}
if ($wheel.digests.sha256 -ne $pinnedHash) {
    throw 'MediaPipe pinned release hash mismatch.'
}
Get-MigArtifact -Uri $wheel.url -Destination $archive -Sha256 $pinnedHash
Expand-Archive -LiteralPath $archive -DestinationPath "$root/mediapipe-package" -Force
$license = Join-Path "$root/mediapipe-package" "mediapipe-$version.dist-info/licenses/LICENSE"
Copy-Item -LiteralPath $license -Destination "$root/MediaPipe-LICENSE" -Force
$headers = [Collections.Generic.HashSet[string]]::new()
$pending = [Collections.Generic.Queue[string]]::new()
$pending.Enqueue('mediapipe/tasks/c/vision/pose_landmarker/pose_landmarker.h')
if (-not $SkipHands) {
        $pending.Enqueue('mediapipe/tasks/c/vision/hand_landmarker/hand_landmarker.h')
}
while ($pending.Count) {
    $relative = $pending.Dequeue()
    if (-not $headers.Add($relative)) {
        continue
    }
    $target = Join-Path "$root/include" $relative
    New-Item -ItemType Directory -Force -Path (Split-Path $target) | Out-Null
    Get-MigArtifact -Uri "https://raw.githubusercontent.com/google-ai-edge/mediapipe/v$version/$relative" -Destination $target
    $source = Get-Content -Raw $target
    foreach ($match in [regex]::Matches($source, '#include\s+"(mediapipe/[^"\r\n]+)"')) {
        $pending.Enqueue($match.Groups[1].Value)
    }
}
New-Item -ItemType Directory -Force -Path "$root/include/nlohmann" | Out-Null
Get-MigArtifact -Uri 'https://raw.githubusercontent.com/nlohmann/json/v3.11.3/single_include/nlohmann/json.hpp' `
    -Destination "$root/include/nlohmann/json.hpp" `
    -Sha256 '9bea4c8066ef4a1c206b2be5a36302f8926f7fdc6087af5d20b417d0cf103ea6'
Get-MigArtifact -Uri 'https://raw.githubusercontent.com/nlohmann/json/v3.11.3/LICENSE.MIT' `
    -Destination "$root/nlohmann-LICENSE"
Get-MigArtifact -Uri 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task' `
    -Destination "$root/models/pose_landmarker_full.task" `
    -Sha256 '5134a3aad27a58b93da0088d431f366da362b44e3ccfbe3462b3827a839011b1'
Get-MigArtifact -Uri 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task' `
    -Destination "$root/models/pose_landmarker_lite.task" `
    -Sha256 '59929e1d1ee95287735ddd833b19cf4ac46d29bc7afddbbf6753c459690d574a'
if ($IncludeHeavy) {
    Get-MigArtifact -Uri 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_heavy/float16/1/pose_landmarker_heavy.task' `
        -Destination "$root/models/pose_landmarker_heavy.task" `
        -Sha256 '64437af838a65d18e5ba7a0d39b465540069bc8aae8308de3e318aad31fcbc7b'
}
if (-not $SkipHands) {
    Get-MigArtifact -Uri 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task' `
        -Destination "$root/models/hand_landmarker.task" `
        -Sha256 'fbc2a30080c3c557093b5ddfc334698132eb341044ccee322ccf8bcf3607cde1'
}
Write-Output "Native dependencies ready: $root (no Python runtime installed or used)"
Get-ChildItem -Recurse "$root/mediapipe-package" -Filter '*.dll' | Select-Object FullName
