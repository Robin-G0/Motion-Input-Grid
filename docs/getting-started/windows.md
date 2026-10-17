# Windows Motion Input Grid Studio and Motion Input Grid Controller

[English](windows.md) | [Français](windows.fr.md)

**No build needed:** [Download Studio + Controller](https://github.com/Robin-G0/Motion-Input-Grid/releases/tag/v1.1.0#user-content-mig-v1-1-0-desktop-applications).

<details>
<summary>On this page</summary>

- [Build and launch](#build-and-launch)
- [Workspace and drawing](#workspace-and-drawing)
- [Output, test and recording](#output-test-and-recording)
- [Diagnostics and provenance](#diagnostics-and-provenance)

</details>

To use prebuilt applications, follow the [Motion Input Grid Studio](../guides/configurator.md)
and [Motion Input Grid Controller](../guides/controller.md) guides. This page covers source builds
and platform-specific controls. For just a library, see the [C++ SDK / CMake](cpp.md),
[Python](../../bindings/python/README.md) or [JavaScript](../../bindings/javascript/README.md) guide.

Both C++20 Win32/GDI applications use Media Foundation capture, native MediaPipe
and the same engine/schema-v2 reader. No interpreter, UDP bridge or separate
inference process is used. The interface is English; documentation is bilingual.

The Motion Input Grid Controller has a dedicated profile/bindings interface. See the
[Motion Input Grid Controller guide](../guides/controller.md) for import, remembered selection, compact mode
and verification. The drawing tools described below belong to the Motion Input Grid Studio.

## Build and launch

| Requirement | Purpose |
| --- | --- |
| **Windows 10/11 x64** | Native application target |
| **Visual Studio 2022 C++ Build Tools / Windows SDK** | Compiler and platform headers |
| **CMake 3.25+** | Configure the build |
| Internet for bootstrap | Download pinned native libraries and models once; `-SkipBootstrap` reuses them |

Unbundled MSVC binaries need a compatible Visual C++ runtime on the destination
machine. The [standalone Controller](controller-standalone.md) includes its runtime.

```powershell
powershell -ExecutionPolicy Bypass -File tools/build/build-windows.ps1
.\build\windows\bin\motion-input-grid-studio.exe
.\build\windows\bin\motion-input-grid-controller.exe
```

### VS Code and CMake presets

For the `release` or `debug` preset, bootstrap from the repository root once:

```powershell
powershell -ExecutionPolicy Bypass -File tools/bootstrap/bootstrap-native.ps1
cmake --preset release
cmake --build --preset release
ctest --preset release
```

In VS Code, select `release`, then run **CMake: Configure** and **CMake: Build**.
The programs are under `build/release/bin`. If CMake is not on the terminal's
PATH, use VS Code's CMake commands or the build script above. Choose
`sdk-release` when you only need the portable libraries, without camera apps.

Stop the first camera before starting another. Keep libmediapipe.dll, models and
configs with the executables. Paths resolve relative to the executable, not cwd.
--config path.json loads a profile; --camera N selects a device. Motion Input Grid Studio startup
is empty with Right V Recalibrate, inactive until Hands is enabled. The bundled
default profile must be opened explicitly and is not a forced drawing. The Motion Input Grid Controller
restores its last selected profile and starts with camera and keyboard output off.

```powershell
powershell -ExecutionPolicy Bypass -File tools/build/build-windows.ps1 -SkipBootstrap
powershell -ExecutionPolicy Bypass -File tools/build/build-windows.ps1 -Hands OFF -BuildDirectory build/windows-no-hands
cmake --install build/windows --config Release --prefix install
```

Capture prefers supported widescreen modes up to 1280x720. Both previews fit the
complete image; sensor field of view cannot be expanded beyond source pixels.
Lite is default; --pose-full compares accuracy/cost, --pose-lite selects Lite.
Both estimate 33 body landmarks even when legs are outside the frame. Compare
inference time/result age and accuracy with equal lighting/Hands settings; no
seated/standing speedup is assumed.

## Workspace and drawing

For the illustrated workflow, use the [Studio guide](../guides/configurator.md).
The [Controller guide](../guides/controller.md) covers running a saved profile.

| Task | Windows behavior |
| --- | --- |
| Edit and test | **Movements**, **Edit** and **Test** share the main window. |
| Draw a route | Choose the tracked point and Required, Trigger, Forbidden or Interaction. The Zones inspector selects the step and its ordering mode. |
| Change the tracked point | Existing zones move to that point immediately; a collision is rejected without losing either drawing. Explicit sign/finger hands and trace identities stay unchanged. |
| Undo a drawing edit | **Ctrl+Z / Ctrl+Y** undo or redo. A stroke is one operation. |
| Save | Existing movement edits update the document; **Apply** adds a new movement. **File > Save** persists it to disk. |
| Inspect the preview | Body view follows shoulder scale; Full grid shows all **27 × 27** cells. The preview mirrors once. |
| Read logs | The floating terminal can be moved and resized. Reading older events pauses automatic scrolling until returning to the bottom. |

> [!NOTE]
> **Hiding hand overlays does not stop hand inference.** Change the Hands setting
> to control that capability. Finger/sign rules still require reliable observations.
> See the [hand-tracking guide](../guides/hands.md).

## Output, test and recording

Set the name, action and keyboard sequence in **Movement settings**. The key
editor accepts quoted text, sequential `_` and simultaneous `+`, for example:

```text
"Hello world" _ Enter _ Ctrl + C
```

| Control | Effect |
| --- | --- |
| **Single press** | Execute the sequence once per accepted movement. |
| **Hold** | Execute the prefix once and hold the final chord; the last action must be a chord. |
| **Repeat** | Replay at the configured **20..60000 ms** interval while terminal conditions remain active. |
| **Test** | Isolate an input and show recognition feedback **without sending keys**. |
| **Restart / Recalibrate** | Clear attempts / replace the calibration anchor; remote commands require deliberate release before reuse. |

> [!IMPORTANT]
> **Keyboard output starts off and targets the foreground application.** Lost
> conditions, stale data, Stop, dialogs, editing and Test cancel or release output.
> The [configuration reference](../reference/configuration.md) defines timing,
> shared modifiers and global command bindings.

Recording tools are **not exposed in the current Studio UI**. Existing recording
metadata remains compatible with the schema. Ordinary text-field editing keeps
its usual copy/paste and Ctrl+Z/Y behavior.

## Diagnostics and provenance

```powershell
ctest --test-dir build/windows -C Release --output-on-failure
ctest --test-dir build/windows-no-hands -C Release --output-on-failure
```

UI tests run controls and synthetic rendering without a camera. --infer-test,
--hands-test exercise blank images; --camera-test/--session-test are explicit
live-device checks and do not inject keys. Current results and outstanding hardware
checks are in [release preparation](../reference/support.md).

Bootstrap extracts the official MediaPipe0.10.35 wheel as an archive and downloads
matching C ABI headers/models with pinned SHA256. Apps do not run Python or rebuild
MediaPipe with Bazel. CPU inference uses XNNPACK. Models are downloaded during
setup, not camera sessions. MediaPipe/JSON license texts accompany deployment.
[Official package](https://pypi.org/project/mediapipe/0.10.35/) and
[pose guide](https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker).
Upstream metrics connections were observed; no guarantee of zero network traffic.
Transitive license/model review remains manual. Face inference, gamepad, analog
and curvature/replay remain planned; keyboard Hold is implemented.
