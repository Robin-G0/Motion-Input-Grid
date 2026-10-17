# Linux Motion Input Grid Studio and Motion Input Grid Controller

[English](linux.md) | [Français](linux.fr.md)

**No build needed:** [Download Studio + Controller](https://github.com/Robin-G0/Motion-Input-Grid/releases/tag/v1.1.0#user-content-mig-v1-1-0-desktop-applications).

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

## Build and launch

Install the system packages, prepare the models, then build from the **repository root**:

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

### Runtime requirements

Source builds are tested on Ubuntu 22.04 and 24.04 x86-64. Official MediaPipe requires
glibc >=2.28; packaged applications require glibc >=2.35. Source builds use system
Qt/X11; release archives bundle their shared dependencies/plugins/fonts. See
[package installation](packages.md) for x64 archives and ARM64 positions SDKs.
Use `--camera N` for `/dev/videoN`;
single-plane YUYV V4L2 and camera permissions are required. Start explicitly opens
capture; stop one application before starting the other.

## Workspace and drawing

Use the [illustrated Studio guide](../guides/configurator.md) for the drawing
workflow. These are the Linux-specific controls and limits:

| Task | Linux behavior |
| --- | --- |
| Switch views | **Movements**, **Edit** and **Test** share the main window. Session controls stay outside the camera. |
| Draw | Select, Required, Trigger, Forbidden, Interaction and Erase match the web tools. Full grid shows the grid; Body fits the complete mirrored image. |
| Edit a phase | Choose any-order, simultaneous or ordered. Hold time appears for simultaneous phases. Selecting a zone reveals its geometry; purple conditions also reveal hand, sign and hold. |
| Change the tracked point | Existing zones are reassigned immediately; collisions preserve both drawings. |
| Save | **Save** validates and persists the document. Imported files are never overwritten automatically. |
| Edit every schema field | **Complete JSON profile** retains fingers, tolerance, controls and recordings. Detailed finger editing uses this page. |
| Inspect logs | The floating terminal can be moved, resized or docked. **View** controls overlays and light/dark themes. |

**Interactive recording and Undo/Redo are not exposed in this frontend.**
Imported margin and finger rules remain supported. Test disables keyboard output.

## Worker and keyboard output



One worker owns camera/models/engine/controls. A mutex-protected latest snapshot
transfers copied observations/image and at most 64 timestamped events. Profile
changes stop/join before replacement; stale events/output are rejected after 250 ms.
Shutdown joins the worker and releases keys. Widgets stay on the main thread per
[Qt's threading contract](https://doc.qt.io/qt-6/threads-qobject.html).

> [!IMPORTANT]
> **Keyboard output requires X11/XTest. Native Wayland output is unavailable.**
> The positions SDK can still emit logical actions independently of key injection.

Keyboard output is opt-in. Letters/digits,
function keys, modifiers/navigation and named key-editor keys are supported. Text
uses characters present in the current X11 layout; unsupported/non-BMP characters
disable output with an error. Full Windows Unicode delivery is not available on
this backend. Hold/Repeat reuse the existing scheduler.

## Validation limits

Offscreen `--ui-test` checks both executables without camera access. Physical V4L2,
keyboard delivery and human gesture accuracy still require desktop validation.
