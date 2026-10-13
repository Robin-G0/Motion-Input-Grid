# Linux Motion Input Grid Studio and Motion Input Grid Controller

[English](linux.md) | [Français](linux.fr.md)

**No build needed:** [Download Studio + Controller](https://github.com/Robin-G0/Motion-Input-Grid/releases/tag/v1.1.0#user-content-desktop-applications).

> [!NOTE]
> On Debian, the Motion Input Grid Studio, Motion Input Grid Controller and some native examples are still
> being developed and tested. They may not yet work fully.

To use prebuilt applications, follow the [Motion Input Grid Studio](../guides/configurator.md)
and [Motion Input Grid Controller](../guides/controller.md) guides. This page covers source builds
and platform-specific controls. For just a library, see the [C++ SDK / CMake](cpp.md),
[Python](../../bindings/python/README.md) or [JavaScript](../../bindings/javascript/README.md) guide.

Both `motion-input-grid-studio` and `motion-input-grid-controller` build as native Qt6 applications,
sharing the existing engine, estimator and schema-v2 profiles with Windows.

The Motion Input Grid Controller has a dedicated profile/bindings interface. See the
[Motion Input Grid Controller guide](../guides/controller.md) for import, remembered selection, compact mode
and verification. The drawing tools described below belong to the Motion Input Grid Studio.

```sh
sudo apt-get install cmake ninja-build g++ python3 qt6-base-dev libxtst-dev libegl1 libgles2
python3 tools/bootstrap/bootstrap-native-linux.py
cmake -S . -B build/linux-apps -G Ninja -DCMAKE_BUILD_TYPE=Release
cmake --build build/linux-apps --parallel 3
ctest --test-dir build/linux-apps --output-on-failure
build/linux-apps/bin/motion-input-grid-studio --runtime "$PWD/build/native-linux-deps"
build/linux-apps/bin/motion-input-grid-controller --runtime "$PWD/build/native-linux-deps" --config configs/default.json
```

Use `bash tools/build/build-linux.sh [build-directory] [ON|OFF]` to bootstrap/build/test
both applications after installing the prerequisites above.

Source builds are tested on Ubuntu 22.04 and 24.04 x86-64. Official MediaPipe requires
glibc >=2.28; packaged applications require glibc >=2.35. Source builds use system
Qt/X11; release archives bundle their shared dependencies/plugins/fonts. See
[package installation](packages.md) for x64 archives and ARM64 positions SDKs.
Use `--camera N` for `/dev/videoN`;
single-plane YUYV V4L2 and camera permissions are required. Start explicitly opens
capture; stop one application before starting the other.

The session toolbar stays outside the camera canvas. The main window separates
**Movements**, **Edit** and **Test**, with compact drawing tools, body selection and
the same six tools as the web: Select, Required, Trigger, Forbidden, Interaction and Erase.
Cells are numbered automatically for ordered routes. Placing or selecting a purple
conditional trigger reveals sign/0..60000 ms hold settings. Draw in Full grid;
Body view fits the complete mirrored image. The log terminal opens as a small
floating window and can be moved, resized or docked. View toggles grid, dots/hands, logs and
light/dark themes. Input settings edit keys/sequences, Mirror, Single/Hold/Repeat,
repeat interval and cooldown. Steps offer any-order, simultaneous and ordered routes,
with hold time shown for simultaneous steps. Test disables keyboard output.
Save validates atomically. The in-app **Complete JSON profile** page edits all schema-v2
fields through a complete-profile JSON editor, preserving scoped fingers, stages,
tolerance, controls and recordings.

Click a movement to edit its tracked point and zones. Changing the tracked point
reassigns its zones immediately; collisions with another existing point are
rejected without loss. **Movement settings** and **Back to zones** keep identity
apart from drawing. Selecting one zone reveals its X/Y/width/height controls.
Hand-sign settings appear only for a newly placed or selected purple conditional
trigger; changing its hand, sign or hold updates the condition immediately.
Clicking with the same colour selects a zone; a different colour asks before
replacement. Save persists the document; imported files are never overwritten
automatically. Imported margin and finger rules remain supported, with detailed
finger editing available through JSON. Interactive recording and Undo/Redo are
not exposed in this frontend.

One worker owns camera/models/engine/controls. A mutex-protected latest snapshot
transfers copied observations/image and at most 64 timestamped events. Profile
changes stop/join before replacement; stale events/output are rejected after 250 ms.
Shutdown joins the worker and releases keys. Widgets stay on the main thread per
[Qt's threading contract](https://doc.qt.io/qt-6/threads-qobject.html).

Keyboard is opt-in X11/XTest; native Wayland output is disabled. Letters/digits,
function keys, modifiers/navigation and named key-editor keys are supported. Text
uses characters present in the current X11 layout; unsupported/non-BMP characters
disable output with an error. Full Windows Unicode delivery is not available on
this backend. Hold/Repeat reuse the existing scheduler.

Offscreen `--ui-test` checks both executables without camera access. Physical V4L2,
keyboard delivery and human gesture accuracy still require desktop validation.
