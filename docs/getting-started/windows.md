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

Windows 10/11 x64, Visual Studio 2022 C++ Build Tools/Windows SDK and CMake 3.25+
are required to build. Bootstrap needs network once; -SkipBootstrap reuses assets.
The latest Visual C++ Redistributable is needed on deployment machines.

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

File/Edit/View menus, session toolbar, MOVEMENTS sidebar and status bar surround the mirrored
camera. View selects light/dark and toggles grid, hand bones, body dots and linked
logs independently. Hiding hands does not disable inference. Stale overlays vanish.
The log terminal is a small, opaque floating window: drag its title bar or resize
its edges. Closing hides it; reopening retains its position and size. It remains
open when switching workspace views and closes with the app. Reading or selecting
older events pauses automatic scrolling until you return to the bottom.
Rounded filled controls expose enabled/hover/focus state.
Accepted actions flash green for 900ms without logs or keyboard enabled.

Use **Movements**, **Edit** and **Test** in the main window. No separate
movement editor opens. Start the camera explicitly and keep both shoulders
visible for about one second. Body view projects the grid using shoulder scale; Full grid shows all
27x27 cells, mirrored once including dots/traces. Pointer mapping uses the same
inverse transform; a stroke freezes its view until release.

A new movement starts empty with one step and no time limit. Choose the tracked
point, then **Select**, **Required**, **Trigger**, **Forbidden**, **Interaction** or
**Erase**, like the web Studio. Place the cells directly; there is no tolerance
tool or priority selector. Imported margins remain intact. Select drags a rectangle;
Ctrl retains the previous selection, and Delete removes selected regions and linked
imported margins. A stroke is one Undo. Action is one movable finish.
The Zones inspector labels phases as **Step 1 of N**: phases run successively.
Within a phase, choose **In order**, **Any order** or **Simultaneous**. One phase
is enough for a simple movement. Route position edits appear only for a selected
ordered region; equal numbers are alternatives for that tracked point.
The grid displays centered numbers, X guards and R unordered Required.

Independent tracked points keep their own zones; other points remain outlined.
Help is optional and Clear step removes the current scope.
Click a movement to edit its tracked point and zones. Changing the tracked point
reassigns its existing zones immediately; destination collisions preserve both
drawings. Explicit sign/finger hands and recorded trace identity remain intact.
**Movement settings** opens identity, keyboard, reference and timing; **Back to
zones** returns to the movement's current step and selected-region geometry.
The separate body-parts, recording and Undo/Redo toolbar options are removed.
Ctrl+Z/Y remains available. The document updates automatically for existing
movements; File Save persists it to disk. New movements are published with Apply.

Purple conditional triggers reveal hand, sign and continuous hold (0..60000 ms)
after placement or selection. Edits update the selected trigger immediately.
Clicking with its existing colour selects a zone; a different colour asks before
replacement. Erase removes zones explicitly. Imported margins remain supported.
Purple-only inputs work without green/yellow. Matching signs reserve the hand
from global commands. Details shows every scope/finger/sign/time/key binding.

Jump/Crouch use calibrated head/shoulder/hip regions; body space follows the
torso. Mirror transforms anatomy/rules/fingers; camera mirror is separate.
Hands settings are shared and saved. Applying finger/sign bindings enables Hands
in ON builds; missing observations never waive the rules. OFF can edit data but
cannot infer hands. See [hand contract](../guides/hands.md).

## Output, test and recording

Set name/action and keyboard in **Movement**. Keys/Ctrl+K and Edit keys recognize
`"Hello world" _ Enter _ Ctrl + C`, repeated actions and simultaneous + chords.
Outlined boxes confirm parsing. None gives a logical event only.
Action mode offers Single press, Hold or Repeat with interval20..60000ms.
Hold's last action must be a chord. Keyboard starts disabled and targets the
foreground app only after consent. Lost terminal conditions, stale data, Stop,
dialogs, editing and Test cancel/release. Shared modifiers stay down until their
last owning action ends. [Complete output contract](../reference/configuration.md).

Test isolates an input, never sends keys, and keeps cell/step/finger feedback.
Restart clears attempts without recalibration, Recalibrate replaces the anchor;
both recover before resuming. Remote controls map Restart/Recalibrate/Record
to anatomical Thumb/V/OK/Open palm/Fist. Validation defaults250ms, recovery is
exactly1000ms from validation, held command needs deliberate release. A sign/hand
pair controls one command; reassignment removes its previous binding.

Recording tools are no longer exposed in Studio. Existing recording data remains
compatible with the schema. Ctrl+Z/Y, copy/paste/duplicate/delete retain ordinary
text-field editing.

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
