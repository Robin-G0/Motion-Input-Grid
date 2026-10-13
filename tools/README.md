# Build tools and package contents

[English](README.md) | [Français](README.fr.md)

Use these tools when you want to build MIG, adapt a tutorial or create a package
for another machine. To try an existing download, start with its README or the
[package guide](../docs/getting-started/packages.md). Run the commands below from
the repository root. Generated files belong in `build/` or `distribution/`.

## Find the right tool

| Folder | Purpose | Main entry points |
| --- | --- | --- |
| `bootstrap/` | Download and verify native libraries, models, browser assets, Node or Godot dependencies. | [Windows native](bootstrap/bootstrap-native.ps1), [Linux native](bootstrap/bootstrap-native-linux.py), [browser assets](bootstrap/bootstrap-web.cmake), [MediaPipe browser runtime](bootstrap/bootstrap-browser.mjs), [Node](bootstrap/bootstrap-node.mjs), [Godot](bootstrap/bootstrap-godot.py) |
| `build/` | Configure, compile and test applications or tutorial executables. | [Windows](build/build-windows.ps1), [Linux](build/build-linux.sh), [Windows examples](build/build-examples.ps1), [Linux examples](build/build-examples.sh), [Linux release builds](build/build-linux-release.sh) |
| `web/` | Stage browser resources or serve files over localhost. | [Prepare assets](web/prepare-javascript.mjs), [HTTP server](web/serve-javascript.mjs) |
| `packaging/` | Assemble libraries, applications and tutorials into distributable archives. | See the package table below. |
| `release/` | Verify versions, write package inventories and check download hashes. | [Version](release/release-version.py), [manifest](release/release-manifest.py), [checksums](release/release-checksums.py) |
| `dev/` | Check documentation links/translations and format C++ source. | [Documentation](dev/check-docs.py), [formatting](dev/format-code.ps1) |
| `lib/` | Shared Python and PowerShell helpers used by the entry points. | [Archive/runtime assembly](lib/package_linux.py), [metadata](lib/release_metadata.py), [file exclusions](lib/distribution_policy.py), [downloads](lib/download.ps1) |
| `docker/` | Reproducible Linux build environments and a minimal runtime for testing downloads. | [Native development](docker/linux-sdk.Dockerfile), [release build](docker/linux-release.Dockerfile), [isolated example test](docker/linux-example-test.Dockerfile) |

## Build and adapt

```powershell
powershell -ExecutionPolicy Bypass -File tools/build/build-windows.ps1
```

```sh
bash tools/build/build-linux.sh
```

These native builds require the platform prerequisites described in the
[Windows](../docs/getting-started/windows.md) and
[Linux](../docs/getting-started/linux.md) guides. For browser development, follow
the [JavaScript guide](../docs/integrations/javascript.md); `npm run prepare:javascript`
uses `web/prepare-javascript.mjs` to copy compiled WASM, models, profiles and licenses.

Each tutorial owns its integration and display code. Study its `example_usage`
file or named engine component, and reuse that code with your own input/action
provider. `examples/common/` holds canonical assets, not a required runtime folder
outside an individual package. See the [tutorial index](../examples/README.md).

## What the packagers produce

Most Python entry points describe their arguments with `--help`. Packaging runs
on the target OS after compiling its binaries; it does not turn Windows binaries
into Linux binaries. Output defaults to `build/releases/` where supported.
JavaScript bootstrap/packaging uses `python` on Windows and `python3` on Linux;
set `MIG_PYTHON` to select another interpreter. Running compiled pages needs no Python.

| Entry point in `packaging/` | Input and output |
| --- | --- |
| [package-sdk.py](packaging/package-sdk.py) | Installed CMake SDK → headers, libraries, C ABI, CMake targets and notices. Uses host-supplied tracking; no camera estimator/models. |
| [package-linux.py](packaging/package-linux.py) | Linux install → SDK or native desktop archive; `--native` adds applications, camera libraries, models and runtime dependencies. |
| [package-distribution.ps1](packaging/package-distribution.ps1), [package-windows-release.ps1](packaging/package-windows-release.ps1) | Stage available SDK/application/browser outputs under `distribution/`, then archive a complete Windows desktop distribution. |
| [package-python.py](packaging/package-python.py) | Engine/binding sources → positions-only native wheel and source distribution. A camera application needs a separate camera-enabled runtime. |
| [normalize-python-wheels.py](packaging/normalize-python-wheels.py) | Validate file hashes/sizes and normalize wheel RECORD after repair, excluding directory entries. Runs automatically after wheel builds and Linux auditwheel repair. |
| [package-source.py](packaging/package-source.py) | Core/CMake source → source archive and vcpkg overlay pinned to its checksum. |
| [freeze-python-examples.py](packaging/freeze-python-examples.py) | Python tutorials → executable directories with an embedded interpreter and GUI dependencies. Requires PyInstaller 6.16.0, Pillow 11.3.0, Pygame 2.6.1 and the platform Tcl/Tk/Python shared runtime. |
| [package-examples.py](packaging/package-examples.py) | Built/frozen native tutorials → combined archive sharing runtime/models; `--standalone` also creates six independent archives. |
| [package-single-example.py](packaging/package-single-example.py) | Prepared native archive tree → one tutorial at the archive root, with its own runtime, configuration, source, licenses and relevant SDK/binding. |
| [package-javascript-examples.mjs](packaging/package-javascript-examples.mjs) | Built browser tutorials → combined archive with compiled pages, local assets and portable Node; also invokes the individual browser packager. Run with `npm run package:examples`. |
| [package-browser-example.py](packaging/package-browser-example.py) | Prepared JavaScript tree → one browser tutorial with compiled pages and a local npm dependency for rebuilding. Node 22.12+ remains an external prerequisite. |
| [package-integrations.py](packaging/package-integrations.py) | Installed C ABI → Godot add-on, Unity UPM or Unreal plugin; also creates matching standalone tutorial projects/plugins. |
| [package-editor-examples.py](packaging/package-editor-examples.py) | Prepared integration → complete tutorial project/plugin with bridge, profile and native libraries. The editor/toolchain and real tracking provider remain external. |
| [prepare-windows-packages.ps1](packaging/prepare-windows-packages.ps1), [prepare-linux-packages.sh](packaging/prepare-linux-packages.sh) | Assemble and verify SDK and language artifacts. Use `-EngineIntegrationsOnly` (Windows) or `--engines-only` (Linux) for engine artifacts, built by the manual **Build engine integrations (manual)** workflow. |
| [archive-examples.py](packaging/archive-examples.py) | Write a tar archive/checksum from an already prepared example tree. |

Keep all contents of an extracted archive together. Native launchers resolve
libraries/assets relative to their package; browser launchers use a local server.
Engine tutorials are editor projects/plugins, not exported games. Individual
archives need no parent checkout. Source development still requires the documented
compiler, framework/editor or package-manager dependencies.

## Verify your integration or download

```sh
python tools/dev/check-docs.py
python tools/release/release-checksums.py build/releases --check
```

The checksum command needs an existing `SHA256SUMS` file. Creating a manifest with
`release/release-manifest.py` records artifact sizes/hashes and writes that file;
hashes detect corruption but do not establish publisher identity.
The [tests guide](../tests/README.md) explains CTest, binding tests and extracted
tutorial checks. The [support matrix](../docs/reference/support.md) distinguishes
automated validation from camera, editor and export support.
