# Windows Motion Input Grid Studio and Motion Input Grid Controller

[English](windows.md) | [Français](windows.fr.md)

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
The matching Visual C++ 2022 Redistributable is needed on deployment machines.

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
Logs close with the app. Rounded filled controls expose enabled/hover/focus state.
Accepted actions flash green for 900ms without logs or keyboard enabled.

Use **Movements**, **Edit** and **Test** in the main window. No separate
movement editor opens. Start the camera explicitly and keep both shoulders
visible for about one second. Body view projects the grid using shoulder scale; Full grid shows all
27x27 cells, mirrored once including dots/traces. Pointer mapping uses the same
inverse transform; a stroke freezes its view until release.

A new movement starts empty with one Ordered step and no time limit. Select body part,
Pencil/Fill/Tolerance/Eraser/Select and green Required, red Forbidden or yellow
Trigger. Tolerance targets the clicked region, including an existing Low contour,
without preselection. Select drags a rectangle; Ctrl retains the previous
selection, and Delete removes selected regions with their linked tolerances. A stroke is
one Undo. Manual Order1/2 draws alternative horizontal rows; any one region of
each number advances that anatomical lane. Trigger is one movable finish.
The grid displays centered numbers, X guards and R unordered Required.

The layer stack groups independent landmark constraints; other layers remain
outlined. Help is optional. Hide changes display only, Delete removes that
landmark across scopes, Clear step removes the current scope. Select a layer, change
Layer body part, then Save layer. Destination collisions fail; pending assignment
must be saved or restored before switching/drawing/testing. IDs, cells and rules
remain intact, but explicit sign/finger hands and recorded trace identity do not
change. Save layer edits the draft, Apply input publishes, File Save persists.

The inspector separates **Movement**, **Zones**, **Fingers**, **Hand sign**,
**Layers** and **Recording**. Movement contains identity, keyboard, reference and
timing. Zones contains the current step, route mode and region geometry; hold
settings appear for simultaneous steps. There is no Basic/Advanced switch. Purple Interaction needs a hand/sign and continuous hold
0..60000ms; choose settings before painting, Select/Update interaction to edit.
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

Recording needs an open editor and selected landmarks/basis, or full body.
Start/Stop manually or with its sign; review, move point, delete synchronized
sample, trim, discard and explicitly convert to constraints. Sampling is20 Hz
maximum,60s,2048 points/trace. More than64 cell transitions needs trimming.
Raw temporary capture is not a final rule or saved video. Apply/Save publishes.
Ctrl+Z/Y, copy/paste/duplicate/delete retain ordinary text-field editing.

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
