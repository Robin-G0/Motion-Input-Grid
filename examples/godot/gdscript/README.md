# Godot 4 GDScript input tutorial

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

1. Extract `*-godot-gdscript-standalone` for your platform.
2. Import `project.godot` in Godot 4.3+ desktop. Open `raised_hands.tscn`,
   enable **use_synthetic_demo** on its node, and Run. Open `profile.tscn` for JSON import.
3. Expect `left_raise` and `right_raise` in the panel; connect the action event
   to your game. Disable synthetic mode when connecting a real provider.

Godot 4.3+ desktop editor matching the archive’s Windows/Linux platform and
architecture. With the editor installed, import-and-run is a short trial; first
editor installation/export setup can exceed one minute. No camera estimator is bundled.

## Folder walkthrough

| File/directory | Purpose |
| --- | --- |
| `project.godot / raised_hands.tscn / profile.tscn` | Complete project, demo scene and import scene. |
| `mig_input.gd` | Actual tracker initialization, frames, signals and cleanup. |
| `mig_raised_hands.gd / mig_profile_input.gd` | Initial mode selection. |
| `mig_synthetic_frames.gd` | Camera-free observation provider. |
| `raised-hands.json` | Local schema-v2 two-wrist profile. |
| `addons/mig/` | Release: native GDExtension, platform descriptor, C ABI and licenses. |
| `native/ / dependencies/godot/` | Optional bridge rebuild entry and local bridge sources in the release. |
| `tests/regression.gd` | Deterministic bridge/scene/import/teardown checks. |
| `licenses/`, `LICENSE`, `manifest.json` | Release notices and checksums. |

## Code walkthrough

1. `mig_input.gd` → `_ready()` constructs `MigTrackerNative`, calls `open(json)` and imports the local profile.
2. `mig_input.gd` → `_process()` optionally obtains demo landmarks from MigSyntheticFrames.
3. `mig_input.gd` → `submit_frame()` calls tracker.update(timestamp, sequence, aspect, body, hands, count, mask) once.
4. `mig_input.gd` → `motion_action.emit()` delivers copied action/input strings after querying event_action/event_id.
5. `mig_input.gd` → `import_profile()` validates JSON atomically and displays failures without losing the old rules.
6. `mig_input.gd` → `_exit_tree()` closes the native tracker before the scene is destroyed.

## Dependencies and runtime placement

`addons/mig/bin/` contains `mig-godot.dll` / `.so` and the C ABI;
`mig.gdextension` selects a matching platform/architecture. Keep the addon inside
the project. Recognition takes supplied MediaPipe-indexed positions and needs no
MediaPipe models. World coordinates use metres, Y up; the example explicitly maps
world Z into Godot’s negative-Z-forward convention. Missing world data does not move the node.

The editor/toolchain is external; native libraries, configuration, bridge and
licenses are bundled in the individual release. A real camera pose provider is
optional and must call submit_frame() on the owning game/main thread.

## Source setup outside the repository

For a copied source-only folder, install the matching MIG Godot addon release
into its `addons/` directory, then import `project.godot`. Optional native rebuilding
requires CMake 3.25+, C++20, the installed C ABI SDK, godot-cpp godot-4.3-stable,
and integration bridge sources. In an individual archive, those sources are in
`dependencies/godot/`; configure `native/` with GODOT_CPP_DIR and CMAKE_PREFIX_PATH.
The repository fallback is only for checkout builds. Export with the matching native addon.

## Reuse and troubleshooting

Start with `mig_input.gd` and the profile. Keep its lifecycle and replace
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
