# Integrate MIG into an application

[English](overview.md) | [Français](overview.fr.md)

<details>
<summary>On this page</summary>

- [Install the libraries](#install-the-libraries)
- [Coordinate access and custom motion logic](#coordinate-access-and-custom-motion-logic)
- [SDL2 and SFML examples](#sdl2-and-sfml-examples)
- [Linux native SDK](#linux-native-sdk)
- [Website library and camera example](#website-library-and-camera-example)
- [Building and refreshing distributions](#building-and-refreshing-distributions)
- [Linux applications and additional integrations](#linux-applications-and-additional-integrations)
- [React, Vue and Next.js](#react-vue-and-nextjs)

</details>

## Install the libraries

```sh
python -m pip install motion-input-grid
npm install motion-input-grid
npx mig-copy-assets public/mig
```

Choose pip for Python (`from mig import Tracker`) or npm for the browser,
React, Vue and Next.js. See the guides for
[Python](../../bindings/python/README.md) · [JavaScript](../../bindings/javascript/README.md).

These packages are libraries. Desktop applications and the Python camera
runtime are separate downloads from
[Releases](https://github.com/Robin-G0/Motion-Input-Grid/releases).

The distributable packages are in `distribution/windows`, `distribution/linux` and
`distribution/web`. Windows has directly accessible `mig-configurator.exe` and
`mig-controller.exe`; keep their `libmediapipe.dll`, models and configs beside them.
Each native package also has an installed CMake SDK under `sdk/`.
The native Linux archive contains the Qt6 applications and camera runtime.
Runnable SDL2/SFML tutorials are in the separate examples archives; the
positions-only SDK has its own package. See [Linux build and frontend limits](../getting-started/linux.md).

## Coordinate access and custom motion logic

Link `MIG::core` for host-supplied coordinates, `MIG::format` for JSON, and optionally
`MIG::native` for camera/MediaPipe inference. `MIG::hands` exposes 21 hand joints.
All data represents one capture timestamp/sequence. Process a snapshot on its
owner thread or copy its fixed-size frame into your own synchronized mailbox.

```cpp
#include <mig/core/coordinates.hpp>
#include <mig/core/engine.hpp>
#include <mig/format/configuration.hpp>
#include <mig/native/pose.hpp>

auto configuration = mig::load_configuration("profile.json");
// HTTP/file-picker/embedded resources can use the exact same strict parser:
auto imported = mig::parse_configuration(json_text);
mig::Engine engine(std::move(configuration));
mig::native::Pose pose("runtime", engine.configuration().track_hands);
auto frame = pose.infer(rgb_bytes, width, height, capture_ms, sequence);
const auto events = engine.update(frame, capture_ms);
if (auto wrist = mig::body_coordinate(frame, 15)) {
    // wrist->x / y / z: custom game logic or drawing.
}
if (auto wrist = mig::body_coordinate(frame, 15, mig::CoordinateSystem::WorldHeightUp)) {
    // Relative world metres: X right, Y up (height), Z depth away from camera.
}
for (const auto& event : events) {
    game_action(engine.configuration().motions[event.motion].action);
}
```

| API / system | X | Y | Z | Origin / availability |
| --- | --- | --- | --- | --- |
| Image body | normalized image right | normalized image down | model depth, smaller closer | Z relative to hip midpoint; scale comparable to normalized X |
| Image hand | normalized image right | normalized image down | model depth, smaller closer | Z relative to wrist; scale comparable to normalized X |
| World body | metres right | metres down | metres depth, smaller closer | hip midpoint |
| World hand | metres right | metres down | metres depth, smaller closer | hand centre; independent of body world origin |
| WorldHeightUp | same as world | negated world Y | same as world | height increases upward |

These are model estimates, not measured camera-to-user distances. Do not combine
hand-relative and hip-relative Z values as if they had the same origin. Coordinates
are unmirrored; draw with `screen_x = (1 - x) * width` for a mirrored preview.
Recognition Mirror remains a separate configuration rule.

`body_coordinate(frame, index)` and `hands::hand_coordinate(hand, Landmark::index_tip)`
are O(1), allocate no memory, and return `std::nullopt` for unavailable/invalid XYZ.
Image depth and world positions have separate validity flags. World data is optional;
2D-only hosts still work with the recognizer. Head index 33 derives all available
coordinates from the ear midpoint, falling back to the nose. Confidence defaults
to a 0.6 threshold for body access. Hands do not invent per-point confidence from
the handedness classification score.

`body_coordinates(frame)` and `hands::hand_coordinates(hand)` borrow fixed-size spans
for bulk processing without copies. Resolve named landmarks once using
`landmark_index("left_wrist")`. Only hand entries `[0, count)` are present; classifier
labels are not anatomical identities. Call `hands::hand_observations(hands, body)`
once per frame and use `hand_indices[Left/Right]` for the corresponding anatomical
hand, or -1 if association is ambiguous/unavailable. Pose's `hand_frame()` is borrowed
and expires at the next inference, capability change or destruction.

`Engine::update` returns borrowed events valid until the next update. Hold/Repeat
integrations can read `action_active(input_index)` for the accepted live activation;
your application owns game actions and repeat scheduling. The SDL2/SFML/web examples
use logical callbacks, and do not inject desktop keyboard shortcuts.

## SDL2 and SFML examples

Both examples in `examples` load a MIG Studio JSON profile, draw body/hand
coordinates, use wrist XYZ to move a marker, and route recognized actions into game
logic. They support SDL2 >=2.0.10 and SFML 2.5/2.6. The sample's SFML API is version 2;
SFML 3 applications can use the same MIG SDK with their own version-3 drawing calls.

```sh
cmake -S examples -B build/graphics -DCMAKE_PREFIX_PATH=/absolute/path/distribution/linux/sdk
cmake --build build/graphics
build/graphics/sdl2/mig-sdl2 configs/default.json --synthetic
build/graphics/sfml/mig-sfml configs/default.json --runtime /absolute/path/distribution/linux --hands --camera 0
```

The same consumers build on Windows using SDL2/SFML development packages and the
Windows SDK prefix; runtime directory is `distribution/windows`.
`--synthetic` explicitly uses generated sample coordinates; `--runtime` opens a real
camera. `--hands` enables drawing complete hands even for a body-only profile.
`--smoke` runs 90 synthetic frames for deterministic validation (SDL2 supports
`SDL_VIDEODRIVER=dummy`; SFML uses its window loop when a display is available and a supplied-input loop otherwise).
The examples keep capture/inference on the loop thread for clarity; production
games can use a worker and a latest-frame mailbox to avoid blocking rendering.

## Linux native SDK

The core, JSON and hands libraries are portable C++20. The Linux native adapter uses
the official MediaPipe C ABI via `dlopen`, plus V4L2 capture. It requires Linux x86_64,
the official 0.10.35 shared library, and models. Build tools use Python only to
download/extract/checksum artifacts; the executable runtime does not use Python.

```sh
python3 tools/bootstrap/bootstrap-native-linux.py
cmake -S . -B build/linux-native -DCMAKE_BUILD_TYPE=Release \
  -DMIG_BUILD_CONFIGURATOR=OFF -DMIG_BUILD_CONTROLLER=OFF \
  -DMIG_BUILD_NATIVE_RUNTIME=ON -DMIG_NATIVE_DEPS="$PWD/build/native-linux-deps"
cmake --build build/linux-native --parallel 3
ctest --test-dir build/linux-native --output-on-failure
cmake --install build/linux-native --prefix "$PWD/build/linux-install"
```

V4L2 currently requires a single-plane streaming camera supporting YUYV. It requests
1280×720 and accepts the camera's negotiated dimensions; unsupported MJPEG-only or
multi-plane cameras report an error. Camera access requires permission for
`/dev/videoN`. `shutdown()` requests stop; `read()` polls in bounded 100 ms intervals.
Pose/hands inference and capture ownership/lifetimes follow the Windows SDK contract.
Synthetic checks do not establish physical V4L2-camera compatibility; verify your device and capture format.

## Website library and camera example

`MIG::core`, `MIG::format` and `MIG::hands` are compiled with Emscripten into
`mig.mjs` + `mig.wasm`; `mig-tracker.mjs` is a small JavaScript wrapper. The same C++
JSON validator and motion engine run locally in the browser. MediaPipe Tasks Vision
supplies image/world landmarks from the browser's camera; the wrapper copies these
into fixed-size typed-array buffers, not JSON messages per frame.

```js
import {MIGTracker} from './mig-tracker.mjs';
const tracker = await MIGTracker.create(await (await fetch('profile.json')).text());
await tracker.importURL('another-profile.json'); // atomic: invalid import preserves current profile
tracker.update(poseResult, handResult, Math.floor(performance.now()), width / height,
  (action, inputId) => gameAction(action, inputId));
const wrist = tracker.coordinate(15); // null or {x,y,z,confidence}
const height = tracker.coordinate(15, 2); // world metres, Y upward
const indexTip = tracker.handCoordinate(0, 8, 0); // anatomical left hand's image XYZ
tracker.recalibrate();
tracker.dispose(); // releases the WASM engine
```

`handCoordinate(side, joint, system)` returns null for missing or ambiguous anatomical
hands and supports the same image/world/height-up systems. Hand XYZ is also available
directly in MediaPipe `handResult.landmarks` and
`handResult.worldLandmarks`; the low-level `handBuffer()` also exposes these in WASM.
The wrapper exposes `gesture(0/1)` on anatomical left/right, plus `active(inputIndex)`
for game-controlled Hold/Repeat logic. Image-body input layout is 33×8 floats:
`x,y,z,confidence,worldX,worldY,worldZ,worldValid`. Hand input layout is 2×21×6:
image XYZ followed by world XYZ. Acquire borrowed typed-array views again after a
configuration import or any call that can grow WASM memory.

Serve `distribution/web` with HTTP on localhost or HTTPS, then open its `index.html`.
It has JSON upload, Start/Stop camera, recalibration, hand/body drawing and
`mig-action` DOM events. A static file opened as `file://` cannot load the module
reliably. MediaPipe 0.10.35 JS/WASM, models and MIG WASM are packaged locally.
Run `node tools/bootstrap/bootstrap-browser.mjs` during setup and keep the `vision/` folder
with the browser assets. Start needs no CDN download; inference stays on-device.
Browser applications handle their own DOM/game input; operating-system keyboard
injection is unavailable. Synchronous MediaPipe inference can block the demo's UI;
move it into a Web Worker for latency-sensitive production usage.

Official references: [MediaPipe pose web guide](https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker/web_js),
[hand web guide](https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker/web_js),
[Emscripten Embind](https://emscripten.org/docs/porting/connecting_cpp_and_javascript/embind.html),
[SDL2 drawing](https://wiki.libsdl.org/SDL2/SDL_RenderDrawLine),
[SFML 2.6 shapes](https://www.sfml-dev.org/tutorials/2.6/graphics-shape.php).

## Building and refreshing distributions

With Emscripten and CMake >=3.25:

```sh
cmake -P tools/bootstrap/bootstrap-web.cmake
node tools/bootstrap/bootstrap-browser.mjs
emcmake cmake -S . -B build/web -DMIG_BUILD_WEB=ON -DMIG_BUILD_TESTS=OFF \
  -DMIG_BUILD_CONFIGURATOR=OFF -DMIG_BUILD_CONTROLLER=OFF
cmake --build build/web --parallel 3
node tests/bindings/javascript/web_tests.mjs
```

Docker builds use `tools/docker/linux-sdk.Dockerfile` for native Linux/examples, and the
official `emscripten/emsdk:4.0.15` image for web. That image's bundled CMake is older
than 3.25; install a newer CMake in the container or supply one explicitly to
`emcmake`. You can install CMake 3.31.10 with pip. Build directories are not part of the source package.

After building on Windows, run:

```powershell
./tools/packaging/package-distribution.ps1 -CMakePath 'C:/path/to/cmake.exe'
```

This installs the Windows SDK and copies available Windows/Linux/web artifacts into
`distribution/`, alongside required models and licenses. It never removes unrelated
destination files. Raw development binaries require SDL2/SFML system libraries;
release tutorial archives bundle these dependencies. Preserve executable permissions. Native C++
consumers must match the package architecture/toolchain. Browser WASM is independent
of the host operating system. The [tools guide](../../tools/README.md) explains
which inputs each packager expects and which runtime files it includes.

## Linux applications and additional integrations

Both Linux GUI executables are available in the native build and distribution.
See [Linux setup and frontend limits](../getting-started/linux.md). Python/Tkinter, Pygame,
Unity, Godot GDScript / C# and Unreal examples each have their own folder/README in the
[example index](../../examples/README.md). The language ports use the installed shared
[C ABI](../reference/c-abi.md), with the same strict profiles and recognition engine.
The graphics consumers build independently from examples/sdl2 and examples/sfml,
or together using the aggregate examples/CMakeLists.txt.

Each visual integration has raised-hands and profile-import variants, with accepted
actions displayed on screen. See the [entry point table](../../examples/README.md).
The Python/Tk tutorial lives in `examples/python-tkinter`; Pygame has its own
application, integration, profile and support files.

## React, Vue and Next.js

The [JavaScript bootstrap](javascript.md) covers both camera example variants,
shared browser-session ownership and the npm browser package.
React and Vue provide thin adapters; Next.js reuses React with SSR-safe setup.
