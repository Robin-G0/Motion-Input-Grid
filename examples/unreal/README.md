# Unreal 5 desktop input tutorial

[English](README.md) | [Français](README.fr.md)

**Download the project:** [Windows x64 (zip)](https://github.com/Robin-G0/Motion-Input-Grid/releases/tag/v1.1.0#user-content-unreal-examples) · [Linux x64 (zip)](https://github.com/Robin-G0/Motion-Input-Grid/releases/tag/v1.1.0#user-content-unreal-examples) · [Linux ARM64 (zip)](https://github.com/Robin-G0/Motion-Input-Grid/releases/tag/v1.1.0#user-content-unreal-examples).

## What this example demonstrates

One logical action per raised wrist, an on-screen panel and a profile-import
variant. The editor components accept supplied pose observations. Synthetic
mode demonstrates action wiring without a camera or claims about tracking accuracy.
All editor integrations remain preview integrations.

## Quick Start

1. Extract `*-unreal-standalone` for your platform.
2. Copy this folder to `YourProject/Plugins/MigExample` in an Unreal C++ project.
   Regenerate project files and build. Attach **MigRaisedHandsComponent** to an actor,
   enable **UseSyntheticDemo**, and press Play.
3. Expect `left_raise` and `right_raise` in the panel; connect the action event
   to your game. Disable synthetic mode when connecting a real provider.

Unreal 5 desktop editor and its C++ toolchain, Windows/Linux. Project setup
and compilation exceed one minute. No camera provider is included; the optional
synthetic demo emits two actions without one.

## Folder walkthrough

| File/directory | Purpose |
| --- | --- |
| `MigExample.uplugin` | Plugin descriptor. |
| `Source/MigExample/Public/MigInputComponent.h` | Provider packet API, Blueprint OnMotion and synthetic toggle. |
| `Source/MigExample/Private/MigInputComponent.cpp` | Direct C ABI integration and component lifecycle. |
| `Source/MigExample/Public/MigRaisedHandsComponent.h / MigProfileInputComponent.h` | Initial mode selection. |
| `Source/MigExample/Private/MigExamplePanel.cpp` | UMG feedback, file path and import button. |
| `Source/MigExample/MigExample.Build.cs` | Links/stages native library and loose JSON. |
| `Content/raised-hands.json` | Two-wrist profile, staged NonUFS. |
| `ThirdParty/` | Release: C ABI headers and platform native/import libraries. |
| `licenses/`, `LICENSE`, `manifest.json` | Release notices and checksums. |

## Code walkthrough

1. `Source/MigExample/Private/MigInputComponent.cpp` → `BeginPlay()` calls `mig_create()` once and imports the initial loose Content JSON.
2. `Source/MigExample/Private/MigInputComponent.cpp` → `TickComponent()` optionally generates 90 synthetic observations for the raised-hands component.
3. `Source/MigExample/Private/MigInputComponent.cpp` → `SubmitFrame(Packet)` calls `mig_update()` and copies `mig_event_action()` / `mig_event_id()` before callbacks.
4. `Source/MigExample/Private/MigInputComponent.cpp` → `OnMotion.Broadcast()` delivers logical strings to Blueprint listeners; the UMG panel displays all simultaneous actions.
5. `Source/MigExample/Private/MigInputComponent.cpp` → `ImportProfile(Path)` reads JSON via FFileHelper and calls `mig_load()`; errors come from `mig_last_error()`.
6. `Source/MigExample/Private/MigInputComponent.cpp` → `EndPlay()` removes the panel, calls `mig_destroy()` and clears the handle.

## Dependencies and runtime placement

Release: `ThirdParty/include/mig/c/api.h`, plus `bin/mig-c.dll` and
`lib/mig-c.lib` on Windows, or `lib/libmig-c.so.1` on Linux. Build.cs stages the
library beside the game executable and keeps JSON loose (NonUFS); FFileHelper
needs a real file. No separate MIGRuntime plugin or MediaPipe/model dependency
is needed. Native architecture must match your editor/export. `mig_coordinate()`
and `mig_active()` support continuous controls; world metres require multiplication
by 100 for Unreal centimetres and an explicit axis mapping for your camera.

The editor/toolchain is external; native libraries, configuration, bridge and
licenses are bundled in the individual release. A real camera pose provider is
optional and must call SubmitFrame() on the owning game/main thread.

## Source setup outside the repository

For a copied source-only folder, obtain the matching installed MIG C ABI SDK
and place its `include/`, platform `lib/` and Windows `bin/` in `ThirdParty/`,
then regenerate/build as above. No parent repository path is used. Attach
MigProfileInputComponent for arbitrary profiles, type the absolute JSON path in
the panel, or call Blueprint ImportProfile(Path). Bind OnMotion to game behavior.

## Reuse and troubleshooting

Start with `Source/MigExample/Private/MigInputComponent.cpp` and the profile. Keep its lifecycle and replace
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
