# Unity desktop input tutorial

[English](README.md) | [Français](README.fr.md)

**Download the project:** [Windows x64 (zip)](https://github.com/Robin-G0/Motion-Input-Grid/releases/tag/v1.1.0#user-content-mig-v1-1-0-unity-examples) · [Linux x64 (zip)](https://github.com/Robin-G0/Motion-Input-Grid/releases/tag/v1.1.0#user-content-mig-v1-1-0-unity-examples).

## What this example demonstrates

One logical action per raised wrist, an on-screen panel and a profile-import
variant. The editor components accept supplied pose observations. Synthetic
mode demonstrates action wiring without a camera or claims about tracking accuracy.
All editor integrations remain preview integrations.

## Quick Start

1. Extract `*-unity-standalone` for your platform.
2. Add this folder’s `package.json` through Package Manager → **Add package from disk**.
   Attach **MigRaisedHands** to a GameObject, enable **UseSyntheticDemo**, and press Play.
3. Expect `left_raise` and `right_raise` in the panel; connect the action event
   to your game. Disable synthetic mode when connecting a real provider.

Unity desktop editor and a Windows/Linux x64 project. Initial project/package
setup can exceed one minute. No camera estimator is bundled; synthetic mode needs no camera.

## Folder walkthrough

| File/directory | Purpose |
| --- | --- |
| `MigInput.cs` | Tracker owner, configuration, frames, actions and teardown. |
| `MigRaisedHands.cs / MigProfileInput.cs` | Demo/import component selection. |
| `Resources/MIG/raised-hands.json` | Two-wrist profile loaded as a TextAsset. |
| `SyntheticFrames.cs` | Release: camera-free provider fixture. |
| `MIG.Examples.asmdef` | Example assembly references the native binding assembly. |
| `package.json` | UPM descriptor; standalone package has no second UPM dependency. |
| `Runtime/` | Release: MIG.Runtime assembly, managed bridge and filtered native plugins. |
| `licenses/`, `LICENSE`, `manifest.json` | Release notices and checksums. |

## Code walkthrough

1. `MigInput.cs` → `OnEnable()` loads the assigned TextAsset or Resources profile and constructs `MigTracker(json)` once.
2. `MigInput.cs` → `Update()` generates 90 deterministic packets when UseSyntheticDemo is enabled.
3. `MigInput.cs` → `SubmitFrame(packet)` calls `tracker.Update(ref packet, actionHandler)` once per fresh observation.
4. `MigInput.cs` → `HandleAction()` updates the panel and invokes `OnAction`; connect this UnityEvent to a game command.
5. `MigInput.cs` → `ImportProfile(path)` uses `ImportJson()` to validate before replacing the current rules.
6. `MigInput.cs` → `OnDisable()` calls `tracker.Dispose()` before ownership ends.

## Dependencies and runtime placement

Release: `Runtime/Plugins/<platform>/mig-c.dll` or `libmig-c.so` and importer
metadata are bundled with `Runtime/Bridge/MigTracker.cs`. Do not change the
platform filters. Recognition consumes supplied positions; no MediaPipe models
are needed. Supported: desktop Windows/Linux x64. Mobile, WebGL and IL2CPP
mobile are not validated. World coordinates are metres, Y up, relative to hips;
`TryCoordinate()` can move the object, while missing world data leaves it still.

The editor/toolchain is external; native libraries, configuration, bridge and
licenses are bundled in the individual release. A real camera pose provider is
optional and must call SubmitFrame() on the owning game/main thread.

## Source setup outside the repository

For a copied source-only folder, install the matching runtime UPM package
first, then copy `SyntheticFrames.cs` from the managed binding release into this
folder. The source UPM descriptor declares that runtime dependency. The standalone
archive already supplies both and removes the extra dependency. Assign a schema-v2
TextAsset to Profile for preload; MigProfileInput starts empty otherwise.

## Reuse and troubleshooting

Start with `MigInput.cs` and the profile. Keep its lifecycle and replace
the named action callback/signal with application commands. The panel and prop
movement only illustrate feedback. Submit unmirrored MediaPipe-indexed body/hand
observations, original aspect, monotonic milliseconds and increasing sequence.
Send absent observations when tracking is lost; never update a disposed tracker.
Callbacks are logical actions, not OS keyboard injection. Use Active/active or
the C ABI’s mig_active for continuous game input where appropriate.

- DLL/SO not found: keep the documented native placement and matching architecture.
- Import fails: fix the displayed schema error; invalid profiles retain prior rules.
- No action: calibrate with both shoulders visible, start in the Required region,
  then move into Trigger. Standing in Trigger alone cannot fire; sample gaps over
  180 ms require profiling. Synthetic mode is intended for this demo profile.
- The raised-hands JSON contains two broad Required/Trigger wrist paths; valid
  imports clear previous recognition progress and restart calibration.
- First editor build/export can exceed one minute. Preview exports and real camera
  providers need validation on your target editor/platform.

[Configuration reference](../../docs/reference/configuration.md).
