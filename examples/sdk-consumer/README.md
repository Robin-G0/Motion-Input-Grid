# C++ positions recognition tutorial

[English](README.md) | [Français](README.fr.md)

**Download this example:** [Windows x64 (zip)](https://github.com/Robin-G0/Motion-Input-Grid/releases/tag/v1.1.0#user-content-sdk-consumer-examples) · [Linux x64 (tar.gz)](https://github.com/Robin-G0/Motion-Input-Grid/releases/tag/v1.1.0#user-content-sdk-consumer-examples).

## What this example demonstrates

Recognizes `left_raise` from supplied synthetic shoulder/wrist observations.
It demonstrates linking the installed SDK, calibration, ordered movement rules
and logical event dispatch without a camera, model or window.

## Quick Start

1. Extract `*-sdk-consumer-standalone` for your Windows/Linux x64 platform.
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
| `configuration/default.json` | Individual archive: one authored `left_raise` path. |

## Code walkthrough

1. `main.cpp` checks the JSON argument and calls `initialize_mig()`.
2. `example_usage.hpp` includes `<mig/core/engine.hpp>` and the format API.
   `initialize_mig()` validates JSON with `mig::load_configuration(path)` and
   constructs an engine owning the rules and temporal state.
3. `calibrate()` supplies stable shoulders over time, with increasing sequence.
4. `demonstrate_path()` walks the first input’s constraint centers and calls
   `engine.update(frame, frame.timestamp_ms)` once per generated observation.
5. `dispatch_events()` consumes borrowed events immediately and maps each
   `event.motion` to `engine.configuration().motions[event.motion].action`.
6. The scoped engine is destroyed on return or exception.

## Dependencies and rebuilding

External: Windows x64 with VC++ runtime, or Linux x64 with glibc 2.35+.
Bundled: executable, public SDK, licenses, configuration.
Recognition is statically linked; no MediaPipe or camera runtime is needed.
Optional development: CMake 3.25+, C++20 compiler and matching MIG SDK. Copy
this folder and use an installed SDK or the individually bundled `sdk/`:

```sh
cmake -S . -B build -DCMAKE_PREFIX_PATH=/path/to/MIG/sdk
cmake --build build --config Release
build/mig-sdk-example configuration/default.json
```

Visual Studio puts the binary under `build/Release/` and appends `.exe`.
Source-only folders require an installed SDK and your configuration file.
The local `configuration/default.json` is included in source folders too.
Replace it with your own Motion Input Grid Studio profile. Compilation exceeds the prebuilt trial time.

## Reuse and troubleshooting

Start with `example_usage.hpp`; replace synthetic frame construction with your pose provider and dispatch with your game commands.
The synthetic walker only illustrates a simple authored path; it does not simulate arbitrary simultaneous lanes, fingers or Interaction profiles.
Use fresh unmirrored observations with valid aspect, monotonic timestamps and
increasing sequence. Keep one owning thread and the demonstrated scope lifetime.

- Missing JSON: pass an existing profile; the launcher uses the bundled `configuration/default.json`.
- SDK not found: set `CMAKE_PREFIX_PATH` or retain bundled `sdk/`.
- Wrong architecture: use the SDK and native files matching the executable.

[C++ SDK setup](../../docs/getting-started/cpp.md).
