# Bootstrap a project

[English](bootstrap.md) | [Français](bootstrap.fr.md)

<details>
<summary>On this page</summary>

- [Configure one action](#configure-one-action)
- [Run and adapt each integration](#run-and-adapt-each-integration)
- [Use installed libraries or the checkout](#use-installed-libraries-or-the-checkout)
- [Choose a CMake preset](#choose-a-cmake-preset)
- [Verify your changes](#verify-your-changes)

</details>

To install just the library and link it to your project, follow the
[C++ SDK / CMake guide](cpp.md). It covers archives, source builds,
`cmake --install` and generated Makefiles on Linux.

To use the libraries without compiling them, install
`python -m pip install motion-input-grid` (Python) or
`npm install motion-input-grid` (browser/React/Vue/Next.js), then run
`npx mig-copy-assets public/mig` for browser assets.
[Python](../../bindings/python/README.md) · [JavaScript](../../bindings/javascript/README.md).

Desktop applications and the Python camera runtime remain separate native
archives; prebuilt examples include their dependencies.

Download the individual `*-standalone` tutorial for your technology from the
[release downloads](https://github.com/Robin-G0/Motion-Input-Grid/releases/tag/v1.1.0#user-content-downloads). Extract the whole archive. Individual tutorials
keep runtime assets beside their own source; combined archives share runtime,
binding and license folders. Source files sit beside executables or compiled pages. [Standalone instructions](../../examples/README.md)
list runtime and operating-system requirements.

## Configure one action

Use [raised-hands.json](../../examples/common/raised-hands.json) as your first profile.
It defines `left_raise` and `right_raise`: anatomical wrist 15/16 travels through
four green Required rows, then a yellow Trigger row. Each row spans the grid.
Keep shoulders visible for about one second, lower your hands, then raise either
one. The view mirrors once; left/right feedback refers to your anatomy.
Copy the profile before editing it. Change `action` to your application's command
name; preserve unique input IDs and the [schema-v2 rules](../reference/configuration.md).

The demo variant loads that profile. The profile variant starts empty: click
**Import profile**, choose JSON and recalibrate. Invalid imports preserve the
previous configuration. Accepted events appear on screen and in the terminal;
examples do not type keys into another application.

## Run and adapt each integration

| Technology | Start from an extracted archive | Connect feedback to your app |
| --- | --- | --- |
| Python/Tk | `main.exe` on Windows; `./main` on Linux | Use `handle_detected_actions()` in local `example_usage.py` |
| Pygame | `main.exe` on Windows; `./main` on Linux | Use `handle_detected_actions()` in local `example_usage.py` |
| SDL2 | `mig-sdl2.exe` or `./mig-sdl2` | Use `tutorial::handle_detected_actions()` in local `example_usage.hpp` |
| SFML | `mig-sfml.exe` or `./mig-sfml` | Same named function in its own `example_usage.hpp` |
| Plain browser | `run.cmd` or `sh run.sh` | Set `MIGSession`'s `onAction` |
| React | `run.cmd` or `sh run.sh`; `/` or `/profile.html` | `useMIG({onAction})` |
| Vue | `run.cmd` or `sh run.sh`; `/` or `/profile.html` | Composable `useMIG({onAction})` |
| Next.js | `run.cmd` or `sh run.sh`; `/` or `/profile` | Client component's React `onAction` |
| C++ supplied positions | Run `run.cmd` / `sh run.sh` in the SDK tutorial | Read the span returned by `engine.update(frame)` as demonstrated by the consumer |
| Native C++ estimator | `run.cmd` / `sh run.sh`; see its README for arguments | Supply RGB, update the same engine, consume events |
| Unity | Add the standalone tutorial’s `package.json` through Package Manager | `OnAction` UnityEvent or `SubmitFrame(packet)` |
| Godot C# | Open the standalone .NET project and `raised_hands.tscn` | Connect `MotionAction`; call `SubmitFrame` from your provider |
| Godot GDScript | Open the standalone `project.godot` and `raised_hands.tscn` | Connect `motion_action`; call `submit_frame` from your provider |
| Unreal | Copy the standalone folder to your project’s `Plugins/MigExample` | Subscribe to `OnMotion`; call `SubmitFrame` |

Run these commands from the extracted standalone tutorial folder. Older or locally
built combined archives use `examples/<technology>` subfolders. Read each tutorial
README for exact platform prerequisites.

GUI profile variants use `profile.exe`/`profile` for Python and `mig-*-profile`
for C++. Editor components have both a raised-hands and a generic variant.
Game engines require their installed editor and a camera/landmark provider;
`UseSyntheticDemo` checks wiring without a camera. They are not turnkey exports.

## Use installed libraries or the checkout

Python sources require Python 3.10+, Pillow and Pygame (Tk for the picker):

```sh
python -m pip install motion-input-grid pillow pygame
python examples/python-tkinter/main.py
python examples/pygame/profile.py
```

Scripts prefer an installed `mig` import, then use the packaged `bindings/python` or a verified full
checkout. The pip wheel bundles the positions-only C ABI. Camera examples need a
camera-enabled native SDK too; set `MIG_LIBRARY` to its C ABI library and
`MIG_RUNTIME` to its MediaPipe/model directory when overriding discovery. Frozen viewers
include Python/UI dependencies and use the archive's native runtime.
See the [Python package](../../bindings/python/README.md).

C++ graphics consumers first try `find_package(MIG CONFIG)` and otherwise build the checkout.
From a configured native build, install and configure an example:

```sh
cmake --install build/linux-native --prefix "$PWD/install"
cmake -S examples -B build/graphics -DCMAKE_PREFIX_PATH="$PWD/install"
cmake --build build/graphics --parallel 2
```

On Windows, add `--config Release` to build/install. SDL2/SFML development
packages and the platform toolchain are needed for rebuilding, not for bundled
execution. [Integration](../integrations/overview.md) explains RGB and supplied-pose hosts.

JavaScript workspaces use the same package name as consumers. Prepare WASM and
checksummed assets, then build the frameworks:

```sh
cmake -P tools/bootstrap/bootstrap-web.cmake
node tools/bootstrap/bootstrap-browser.mjs
npm ci
npm run prepare:javascript
npm run build:examples
```

Build `build/web/web/mig.mjs` and `mig.wasm` with Emscripten first; the
[JavaScript guide](../integrations/javascript.md) gives the full commands and adapter snippets.
The npm package contains local models and MediaPipe/WASM assets; run
`mig-copy-assets public/mig` in a consumer. Serve over localhost or HTTPS.
Only an explicit Start requests camera permission. React cleanup survives
StrictMode; Next initializes browser resources only on the client.

For C# use [MigTracker](../../bindings/dotnet/README.md); for lower-level Python/C#
contracts read the [C API](../reference/c-abi.md). Handle logical events instead of forwarding
keyboard injection from examples. Dispose trackers and stop capture on exit.

## Choose a CMake preset

A preset stores the build options and output directory. VS Code's CMake Tools
uses these same presets; choosing one configures the project, it does not run it.

`CMakePresets.json` is shared in Git. Keep machine-specific overrides in
`CMakeUserPresets.json`, which is ignored, including local toolchain paths.

- `release`: optimized Motion Input Grid Studio, Motion Input Grid Controller and engine. Bootstrap the native
  dependencies first; see [Windows](windows.md) or [Linux](linux.md).
- `debug`: the same applications with debugging information.
- `sdk-release` / `sdk-debug`: portable engine and bindings only, without camera
  applications or MediaPipe. A C++20 toolchain is required; the first configuration
  fetches the JSON dependency when it is not already installed.

```sh
cmake --preset sdk-release
cmake --build --preset sdk-release
ctest --preset sdk-release
```

For the desktop applications, select `release` after bootstrap. A fresh clone
contains no downloaded dependencies or binaries; a missing-bootstrap error is
resolved by the platform bootstrap command, not by changing optimization mode.

## Verify your changes

Use each viewer's hidden `--smoke` for generated positions. It checks event/render
wiring, not your camera. Keep the real camera, sign accuracy, held-output release
and target-OS checks on your own release checklist. Read the
[source walkthrough](examples.md) before modifying ownership or mirroring.
