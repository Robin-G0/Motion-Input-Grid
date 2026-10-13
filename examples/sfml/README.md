# SFML: camera and logical actions

[English](README.md) | [Français](README.fr.md)

## What this example demonstrates

A mirrored camera preview, finger outlines and wrist-following props show two
logical actions: **Left hand raised!** and **Right hand raised!**. The second
executable imports your own MIG Studio JSON and displays its action names.

## Quick Start — prebuilt package

1. Extract this example's `*-sfml-standalone` archive.
2. In the extracted folder, run `mig-sfml.exe` on Windows or `./mig-sfml` on Linux.
3. Keep both shoulders visible for calibration; lower your hands into green,
   then raise either wrist into yellow. Watch the action panel.
4. Close the window to release the camera. Run `mig-sfml-profile.exe / ./mig-sfml-profile` to import JSON.

Allow about 30–60 seconds with prerequisites installed; model loading depends
on hardware. These commands also work inside the combined archive's example folder.

## Folder walkthrough

| File or directory | Purpose |
| --- | --- |
| `main.cpp` | Small application entry point; selects demo or import mode. |
| `example_usage.hpp` | Actual MIG initialization, recognition and action handling. |
| `application.cpp` | Window, input events, rendering and processing loop. |
| `configuration/raised-hands.json` | Local schema-v2 two-wrist profile. |
| `support/` | Resource lookup and display helpers; source is included locally. |
| `hud.hpp` | Action text and import controls for the graphics library. |
| `CMakeLists.txt` | Builds both variants against public MIG SDK targets. |
| `support/DejaVuSans.ttf` | Redistributable HUD font; its license is alongside it. |
| `lib/` | Linux release: bundled graphics and file-dialog shared libraries. |
| `sdk/` | Individual release: development headers/libraries for reuse. |

## Code walkthrough

1. `main.cpp` calls `run_application()` in `application.cpp`.
2. `example_usage.hpp` includes the public MIG API. `initialize_mig()` calls
   `load_configuration()` to validate the local JSON, then constructs `mig::Engine`.
3. `support/source.hpp`, `demo::Source::sample()`, captures RGB and calls
   `Pose::infer()` to obtain unmirrored landmarks; synthetic mode supplies fixtures.
4. `tutorial::process_tracking_frame()` calls `engine.update(frame, timestamp_ms)`.
   It consumes the borrowed events immediately and looks up each logical action
   through `engine.configuration().motions[event.motion]`.
5. The action loop prints and updates the HUD. Replace it with your game's
   action dispatch. `draw_frame()` mirrors only the visual preview.
6. `demo::import_profile()` validates a replacement before changing the engine.
7. Closing exits the loop. C++ destruction stops Source capture/tasks before
   destroying the engine; graphics owners release textures and the window.

## Dependencies and runtime placement

Bundled: executable variants, MIG/MediaPipe, Lite pose and hand models, graphics
runtime, font and licenses. Individual archives contain `runtime/` here;
combined archives share it at their root. Linux launchers set their library,
font and Qt plugin paths relative to themselves. Windows graphics DLLs sit
beside the executables. Keep these folders together; launch from any working directory.

External: Windows x64 and VC++ runtime, or Linux x64 with glibc 2.35+ and a
desktop display; webcam for real tracking. Optional development: CMake 3.25+,
C++20 compiler, installed MIG SDK and graphics development libraries.

## Rebuild this folder outside the repository

```sh
cmake -S . -B build -DCMAKE_PREFIX_PATH="/path/to/MIG/sdk;/path/to/graphics/sdk"
cmake --build build --config Release
```

Individual archives bundle the MIG SDK and CMake also searches `sdk/`. A copied
source-only folder requires an installed MIG SDK. The full checkout can build MIG
as a fallback after native bootstrap. Camera assets are separate from development
headers: set `MIG_RUNTIME` to the directory containing MediaPipe and `models/`.
The hidden `--smoke` argument supplies generated frames and exits without a camera.
Capture/inference is synchronous; move Source ownership to a worker in a game
that needs rendering independent of inference latency.

SFML 2.6 development libraries are required. Linux additionally uses Qt6 Widgets
for the profile picker; Windows uses its native dialog.

## Configuration and reuse

The raised-hands profile has a broad Required region `[-9,3,27,3]`, followed by
a Trigger region `[-9,1,27,2]` for each wrist. Starting only in yellow cannot
trigger the upward path. Import mode starts without rules; invalid JSON keeps
the previous configuration, while a valid import resets calibration.

Copy the named integration file and configuration into your application. Replace
the action callback with your game command. Feed unmirrored MediaPipe-indexed
observations with their original aspect, increasing sequence and monotonic time;
submit one update per fresh frame and missing observations on tracking loss.
The preview, wrist props and action panel are optional presentation code.
Keep each tracker on one owning thread and preserve its cleanup lifecycle.
Actions stay in the application; these examples never inject desktop keys.

## Troubleshooting

- Missing library/model: retain the complete extracted folder. Source folders
  require the dependencies and setup below; they do not contain release binaries.
- Camera busy: close other camera applications and grant camera permission.
- No action: keep both shoulders visible until calibrated, lower the wrists, then
  raise through green into yellow. Samples more than 180 ms apart need profiling.
- Import rejected: fix the reported schema error; the previous rules still run.
- Closing waits for any in-flight inference before releasing the tracker.
