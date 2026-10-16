# Native RGB inference tutorial

[English](README.md) | [Français](README.fr.md)

**Download this example:** [Windows x64 (zip)](https://github.com/Robin-G0/Motion-Input-Grid/releases/tag/v1.1.0#user-content-mig-v1-1-0-native-consumer-examples) · [Linux x64 (tar.gz)](https://github.com/Robin-G0/Motion-Input-Grid/releases/tag/v1.1.0#user-content-mig-v1-1-0-native-consumer-examples).

## What this example demonstrates

Loads MediaPipe and the Full pose model, performs inference on one blank RGB
frame, toggles optional hands and releases tasks. It prints `sequence=1`; blank
RGB demonstrates ownership and API wiring, not human tracking accuracy.

## Quick Start

1. Extract `*-native-consumer-standalone` for your Windows/Linux x64 platform.
2. Run `run.cmd` (Windows) or `sh run.sh` (Linux) from this folder.
3. Observe the console result, then normal process exit. No webcam is needed.

Target: 30–60 seconds with prerequisites installed; inference model loading
depends on hardware. The combined archive offers the same launchers in its example folder.

## Folder walkthrough

| File/directory | Purpose |
| --- | --- |
| `main.cpp` | Argument validation and simple tutorial orchestration. |
| `example_usage.hpp` | Actual MIG API calls and explanatory comments. |
| `CMakeLists.txt` | Public MIG SDK targets; also searches a bundled `sdk/`. |
| `run.cmd`, `run.sh` | Packaged launch command and resource arguments relative to this folder. |
| `sdk/` | Individual package: headers and development libraries. |
| `licenses/`, `LICENSE` | Redistribution notices. |
| `runtime/` | MediaPipe and Full pose/hand models, plus required Linux libraries. |

## Code walkthrough

1. `main.cpp` checks the runtime-directory argument and optional `--hands`.
2. `example_usage.hpp` includes `<mig/native/pose.hpp>`.
3. `demonstrate_inference()` constructs `mig::native::Pose(runtime)` and calls
   `set_hands_enabled(hands)`. The runtime folder must contain the native library
   and `models/pose_landmarker_full.task` (also the hand model with `--hands`).
4. `infer(rgb, width, height, timestamp_ms, sequence)` returns unmirrored
   observations. Replace blank RGB with fresh camera pixels and pass the result
   to `Engine::update()` for motion recognition; inference alone emits no actions.
5. Disable hands; scope exit destroys tasks before unloading the native library.

## Dependencies and rebuilding

Use a camera-enabled SDK exporting `MIG::native`: the `sdk/` from a desktop or
native tutorial archive, or a [native source build](../../docs/integrations/overview.md).
The standalone positions-only SDK does not include this target.

External: Windows x64 with VC++ runtime, or Linux x64 with glibc 2.35+.
Bundled: executable, public SDK, licenses, native MediaPipe and models.
Keep `runtime/` beside the executable in an individual package; combined archives use their shared runtime root. The Linux launcher sets relative library paths.
Optional development: CMake 3.25+, C++20 compiler and matching MIG SDK. Copy
this folder and use an installed SDK or the individually bundled `sdk/`:

```sh
cmake -S . -B build -DCMAKE_PREFIX_PATH=/path/to/MIG/sdk
cmake --build build --config Release
build/mig-native-example runtime
```

Visual Studio puts the binary under `build/Release/` and appends `.exe`.
Source-only folders require an installed SDK and runtime/models from its native release.
No JSON profile is needed for this inference-only example. The
[positions tutorial](../sdk-consumer/README.md) demonstrates configured recognition.

## Reuse and troubleshooting

Start with `example_usage.hpp`; replace the blank RGB input with your camera/provider.
Native inference and configured recognition are separate; see the positions tutorial for `Engine::update()`.
Use fresh unmirrored observations with valid aspect, monotonic timestamps and
increasing sequence. Keep one owning thread and the demonstrated scope lifetime.

- Missing native library/model: retain the complete runtime folder and pass its absolute path when calling the executable directly.
- SDK not found: set `CMAKE_PREFIX_PATH` or retain bundled `sdk/`.
- Wrong architecture: use the SDK and native files matching the executable.

[C++ SDK setup](../../docs/getting-started/cpp.md).
