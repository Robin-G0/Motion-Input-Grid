# Tests

[English](README.md) | [Français](README.fr.md)

Tests are grouped by the behavior they verify. Each C++ domain owns its CMake
targets and CTest registrations; [CMakeLists.txt](CMakeLists.txt) assembles them.

| Directory | Coverage |
| --- | --- |
| `core/` | Recognition, constraints, sessions, coordinates and hands |
| `format/` | JSON validation and configuration round trips |
| `native/` | Camera runtime, observations, pixels and frame ownership |
| `apps/` | Authoring, profiles, keyboard policies and preview helpers |
| `ui/linux/`, `ui/windows/` | Desktop interactions, themes and platform widgets |
| `bindings/` | C ABI, Python, JavaScript/WASM and .NET consumers |
| `examples/` | Demo profiles, runtime discovery, viewers and file pickers |
| `packaging/` | Installed SDKs, wheels, npm, engine packages and release archives |
| `tooling/` | Downloads and version resolution |
| `benchmarks/` | Synthetic engine performance measurements |

## C++ and desktop tests

Run these commands from the repository root:

```sh
cmake -S . -B build/sdk -DMIG_BUILD_CONFIGURATOR=OFF -DMIG_BUILD_CONTROLLER=OFF
cmake --build build/sdk --config Release --parallel 3
ctest --test-dir build/sdk -C Release --output-on-failure
```

For desktop tests, build the applications using the
[Windows](../docs/getting-started/windows.md) or
[Linux](../docs/getting-started/linux.md) guide, then run CTest on that build.
UI tests exercise the real applications through `--ui-test`; their implementations
live here and are compiled only with `MIG_BUILD_TESTS=ON`. Linux uses Qt's offscreen
platform. UI tests have a 30-second timeout and run serially. Select the Linux UI
checks with `ctest --test-dir build/linux-native -R '^linux-.*-ui$'`.

`MIG_BUILD_TESTS=OFF` excludes the test tree and application diagnostic test modes.
Enable `MIG_BUILD_BENCHMARKS=ON` to build `mig-engine-benchmark` under
`build/<configuration>/tests/benchmarks/` (with `Release/` for Visual Studio).

## Script tests

```sh
python tests/tooling/release_version_tests.py
python tests/tooling/version_resolution_tests.py
python tests/packaging/example_package_tests.py
python tests/packaging/wheel_record_tests.py
python tests/bindings/python/python_tests.py build/windows/src/c-api/Release/mig-c.dll
npm test
npm run test:types
```

Python binding and example tests need a compiled C ABI library. Browser and
package tests additionally need the prepared assets or artifact passed on their
command line. The [tools guide](../tools/README.md) explains how to prepare the
binaries and packages each check needs.

`packaging/standalone_editor_tests.py --build-csharp` validates isolated editor
dependencies and compiles the packaged Godot .NET project. Unity/Unreal editor
execution and exported games still need their own installed editor toolchains.

The Godot regression scene stays in `examples/godot/gdscript/tests/`: it belongs
to the demo project used to validate the extracted add-on and is run by
`packaging/godot_package_tests.py`.

The extracted tutorial checks are `packaging/standalone_example_tests.py`
(native Windows/Linux), `packaging/standalone_browser_tests.py` (four browser
archives with Playwright), and `packaging/godot_package_tests.py` (addon or
standalone project). Native integration checks accept standalone Unity/Unreal
archives as well. Release CI runs these after packaging.

The Linux release also runs the native archives in `tools/docker/linux-example-test.Dockerfile`:
only the archives and test runner are mounted, with no checkout or development libraries.
