# Godot 4 .NET input tutorial

[English](README.md) | [Français](README.fr.md)

## What this example demonstrates

One logical action per raised wrist, an on-screen panel and a profile-import
variant. The editor components accept supplied pose observations. Synthetic
mode demonstrates action wiring; it does not measure tracking accuracy.

> [!IMPORTANT]
> **Start in synthetic mode** to see `left_raise` and `right_raise` without a camera.
> For a webcam-controlled game, supply body landmarks from your own pose provider next.
> **This is a preview integration**: verify your editor and exported game.

## Quick Start

1. Extract `*-godot-csharp-standalone` for your platform.
2. Import `project.godot` in Godot 4.4 .NET, Build its C# project, then Run.
   The supplied `raised_hands.tscn` already enables **UseSyntheticDemo**.
   Open `profile.tscn` to import arbitrary JSON.
3. Expect `left_raise` and `right_raise` in the panel; connect the action event
   to your game. Disable synthetic mode when connecting a real provider.

Godot 4.4 .NET desktop editor, its .NET 8 SDK and matching Windows/Linux x64
native library. Initial .NET restore/build or editor setup can exceed one minute.
No camera provider is bundled; the demo uses supplied synthetic observations.

## Folder walkthrough

| File/directory | Purpose |
| --- | --- |
| `project.godot / MigExample.csproj` | Complete Godot project and pinned .NET build configuration. |
| `raised_hands.tscn / profile.tscn` | Synthetic demo and arbitrary-profile scenes. |
| `MigInput.cs` | Tracker lifecycle, native resolver, packets and signals. |
| `MigRaisedHands.cs / MigProfileInput.cs` | Initial mode selection. |
| `raised-hands.json` | Local schema-v2 two-wrist profile. |
| `MigTracker.cs / SyntheticFrames.cs` | Release: managed bridge and camera-free provider fixture. |
| `mig-c.dll / libmig-c.so` | Release: loose native C ABI at the project root. |
| `licenses/`, `LICENSE`, `manifest.json` | Release notices and checksums. |

## Code walkthrough

1. `MigInput.cs` → `_Ready()` calls InitializeNativeLibrary(), creates `MigTracker(json)` and imports the selected local profile.
2. `MigInput.cs` → `_Process()` optionally generates synthetic packets with increasing sequence and timestamp.
3. `MigInput.cs` → `SubmitFrame(packet)` calls `tracker.Update(ref packet, actionHandler)` once for each observation.
4. `MigInput.cs` → `HandleAction()` updates the panel and emits MotionAction with copied action/input strings.
5. `MigInput.cs` → `ImportProfile(path)` reads JSON through Godot.FileAccess and calls ImportJson() before replacement.
6. `MigInput.cs` → `_ExitTree()` calls `tracker.Dispose()` before node teardown.

## Dependencies and runtime placement

The project-root `mig-c.dll` / `libmig-c.so` is a loose file, not only a
PCK entry. `InitializeNativeLibrary()` installs a .NET resolver using
`ProjectSettings.GlobalizePath("res://...")`; Godot’s generated assembly location
and the working directory are irrelevant. Include this loose library when
exporting and match the editor/export architecture. No MediaPipe/models needed
for supplied positions. World coordinates use metres, Y up, relative to hips;
Godot’s world Z mapping is explicit and missing coordinates do not move the node.

The editor/toolchain is external; native libraries, configuration, bridge and
licenses are bundled in the individual release. A real camera pose provider is
optional and must call SubmitFrame() on the owning game/main thread.

## Source setup outside the repository

For a copied source-only folder, copy `MigTracker.cs` and `SyntheticFrames.cs`
from the matching managed binding release, plus the SDK’s native C ABI library,
into the project root. The standalone archive already supplies these files.
Use Godot’s Build button or `dotnet build MigExample.csproj`; normal NuGet restore
provides Godot.NET.Sdk 4.4.1. Set ProfilePath for preload in the generic component.
The preview currently targets desktop, not mobile/browser exports.

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

[Configuration reference](../../../docs/reference/configuration.md).
