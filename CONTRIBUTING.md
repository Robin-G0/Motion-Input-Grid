# Contributing

[English](CONTRIBUTING.md) | [Français](docs/fr/CONTRIBUTING.fr.md)

Use CMake 3.25+, a C++20 compiler and Git. The positions SDK can fetch its pinned
JSON dependency; camera applications additionally need the platform bootstrap.
Python packaging uses Python 3.10+ and build; browser examples need Node 22.12+,
npm and Emscripten. See [bootstrap](docs/getting-started/bootstrap.md).

## Build and test the portable SDK

```sh
cmake -S . -B build/sdk -DMIG_BUILD_CONFIGURATOR=OFF -DMIG_BUILD_CONTROLLER=OFF
cmake --build build/sdk --config Release --parallel 3
ctest --test-dir build/sdk -C Release --output-on-failure
cmake --install build/sdk --config Release --prefix install
```

For native applications follow the [Windows](docs/getting-started/windows.md) or
[Linux](docs/getting-started/linux.md) guide. Test hands ON/OFF when changing optional
tracking. Camera accuracy, real key delivery and engine exports require manual checks.

The [test guide](tests/README.md) maps each domain to its directory and explains
CTest, application UI tests and script checks.
The [CI guide](docs/development/ci.md) explains which changed paths select each workflow job.

`src/core` owns recognition; `src/format` owns JSON; C ABI/WASM and `bindings`
expose the same engine. Runtime editor packages live in `integrations`, demos in
`examples`, artifact builders in [tools](tools/README.md). See [architecture](docs/architecture/overview.md).

## Adapt the source safely

Use descriptive names, explicit ownership and one responsibility per function.
Keep realtime buffers/queues bounded and recognition independent of UI/cameras.
Use four spaces and clang-format 16; `.clang-format` is authoritative.

Run the tests affected by your change, `python tools/dev/check-docs.py` and
`tools/dev/format-code.ps1 -Check`. For a binding or package change, install the
generated artifact in a separate consumer using the
[installation guide](docs/getting-started/packages.md).
Update the relevant English/French guide and add a meaningful regression test
for changed behavior. Do not edit generated copies or redistribute credentials.
