# Install release packages

[English](packages.md) | [Français](packages.fr.md)

Download packages for your operating system and architecture from
[v1.1.0 release tables](https://github.com/Robin-G0/Motion-Input-Grid/releases/tag/v1.1.0#user-content-mig-v1-1-0-downloads). Keep the complete
archive together after extraction. See the [support matrix](../reference/support.md)
for platform requirements and integration maturity.

## Desktop applications and examples

Controller-only single-file candidates are described in the
[standalone Controller guide](controller-standalone.md). Publish them before
offering them as downloads in web Studio.

**Download Studio + Controller:** [Windows x64 (zip)](https://github.com/Robin-G0/Motion-Input-Grid/releases/tag/v1.1.0#user-content-mig-v1-1-0-desktop-applications) · [Linux x64 (tar.gz)](https://github.com/Robin-G0/Motion-Input-Grid/releases/tag/v1.1.0#user-content-mig-v1-1-0-desktop-applications).

Extract the whole package, then follow the application guide below.

- `desktop applications` archives contain the Motion Input Grid Studio, Motion Input Grid Controller, camera runtime and models.
  Follow the [Motion Input Grid Studio](../guides/configurator.md) or [Motion Input Grid Controller](../guides/controller.md) guide.
- Each example is a separate `*-standalone` download; choose your technology and
  platform in the [examples guide](../../examples/README.md).
- `*-standalone` archives contain one native, browser or editor tutorial.
  The example is the archive root; keep its contents together and follow its README.
  Individual browser archives require Node 22.12+; native libraries and editor
  bridges are bundled. Editors/toolchains remain external prerequisites.
- JavaScript examples include local browser assets and Node launchers. Run
  `run.cmd` or `sh run.sh` in the chosen example folder and open the displayed URL.

## Archive layout and source builds

An individual tutorial places its README, application, integration source and
required runtime files in one folder. Combined archives from older releases or local builds place tutorials
under `examples/` and share dependencies at the archive root. Moving just one
subfolder from a combined archive can lose those dependencies; choose its
`*-standalone` archive when you want to copy only that tutorial.

The source checkout contains editable code, not prebuilt runtimes. For source
builds, install the dependencies listed in that tutorial's README. Native viewers
bundle shared libraries/models, Python viewers also bundle the interpreter, and
browser viewers bundle compiled pages/WASM/MediaPipe/models. Individual browser
archives require Node; the combined JavaScript archive bundles it. Engine
tutorials bundle native bridges but still require their editor and your tracking provider.

The [tools guide](../../tools/README.md) maps each package builder to its inputs
and payload; the [tests guide](../../tests/README.md) explains download validation.

## C++ SDK and vcpkg

**SDK :** [Windows x64 (zip)](https://github.com/Robin-G0/Motion-Input-Grid/releases/tag/v1.1.0#user-content-mig-v1-1-0-cpp-sdk) · [Linux x64 (tar.gz)](https://github.com/Robin-G0/Motion-Input-Grid/releases/tag/v1.1.0#user-content-mig-v1-1-0-cpp-sdk) · [Linux ARM64 (tar.gz)](https://github.com/Robin-G0/Motion-Input-Grid/releases/tag/v1.1.0#user-content-mig-v1-1-0-cpp-sdk).

**vcpkg :** [Download the overlay](https://github.com/Robin-G0/Motion-Input-Grid/releases/tag/v1.1.0#user-content-mig-v1-1-0-vcpkg-overlay).

Extract the matching `*-sdk` archive and pass its SDK directory to CMake:

```sh
cmake -S . -B build -DCMAKE_PREFIX_PATH=/absolute/path/to/sdk
```

Link `MIG::core` and, for profile files, `MIG::format`. The SDK provides recognition
for supplied landmarks; camera-enabled applications use a separate native runtime.
See the [C++ installation guide](cpp.md).

For vcpkg, extract the release overlay and install with:

```sh
vcpkg install motion-input-grid --overlay-ports=/path/to/motion-input-grid-vcpkg-overlay
```

The overlay downloads the matching release source. See the
[vcpkg guide](../../ports/motion-input-grid/README.md) for supported triplets.

## Python and JavaScript

```sh
python -m pip install motion-input-grid
npm install motion-input-grid
npx mig-copy-assets public/mig
```

**Offline packages:**

- Python (wheel) : [Windows x64](https://github.com/Robin-G0/Motion-Input-Grid/releases/tag/v1.1.0#user-content-mig-v1-1-0-python-wheel) · [Linux x64](https://github.com/Robin-G0/Motion-Input-Grid/releases/tag/v1.1.0#user-content-mig-v1-1-0-python-wheel) · [Linux ARM64](https://github.com/Robin-G0/Motion-Input-Grid/releases/tag/v1.1.0#user-content-mig-v1-1-0-python-wheel).
- npm : [TGZ](https://github.com/Robin-G0/Motion-Input-Grid/releases/tag/v1.1.0#user-content-mig-v1-1-0-npm-package).

For offline installation, use the downloaded wheel or npm tarball:

```sh
python -m pip install /path/to/motion_input_grid-1.1.0-<tags>.whl
npm install /path/to/motion-input-grid-1.1.0.tgz
```

Python imports `mig`; the wheel provides recognition for supplied positions.
The npm package includes WebAssembly, browser models and framework adapters.
These packages do not install the desktop applications. See the
[Python](../../bindings/python/README.md) and
[JavaScript](../../bindings/javascript/README.md) guides.

## Debian/Ubuntu

**Download:** [x64 (.deb)](https://github.com/Robin-G0/Motion-Input-Grid/releases/tag/v1.1.0#user-content-mig-v1-1-0-debian-ubuntu-sdk) · [ARM64 (.deb)](https://github.com/Robin-G0/Motion-Input-Grid/releases/tag/v1.1.0#user-content-mig-v1-1-0-debian-ubuntu-sdk).

Install a downloaded package matching your architecture:

```sh
sudo apt install ./motion-input-grid_1.1.0_amd64.deb
```

Use the `arm64` package on ARM64. The Debian package supplies the C++ SDK and
C ABI; the desktop applications are distributed separately. Installing by package
name requires an APT repository that provides MIG; downloading a `.deb` does not
configure one. See the [Linux guide](linux.md) for camera applications.

## Game engines

Use the package for your target platform and engine version:

- [Godot add-on](../../integrations/godot/README.md)
- [Unity UPM package](../../integrations/unity/README.md)
- [Unreal plugin](../../integrations/unreal/README.md)

These integrations are Preview and accept host-provided tracking. Their READMEs
explain installation, native dependencies and editor/export limitations.
