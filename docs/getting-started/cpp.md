# Install and use the C++ SDK

[English](cpp.md) | [Français](cpp.fr.md)

<details>
<summary>On this page</summary>

- [Use a prebuilt SDK](#use-a-prebuilt-sdk)
- [Build and install from source](#build-and-install-from-source)
- [Link your application](#link-your-application)
- [Package-manager alternatives and troubleshooting](#package-manager-alternatives-and-troubleshooting)

</details>

Motion Input Grid (MIG) exports a CMake package for C++20 applications. Use an
installed SDK or build it from source. Both routes provide the same `MIG::`
targets. Camera tracking is separate from the positions-only SDK.

## Use a prebuilt SDK

**Download the SDK:** [Windows x64 (zip)](https://github.com/Robin-G0/Motion-Input-Grid/releases/tag/v1.1.0#user-content-mig-v1-1-0-cpp-sdk) · [Linux x64 (tar.gz)](https://github.com/Robin-G0/Motion-Input-Grid/releases/tag/v1.1.0#user-content-mig-v1-1-0-cpp-sdk) · [Linux ARM64 (tar.gz)](https://github.com/Robin-G0/Motion-Input-Grid/releases/tag/v1.1.0#user-content-mig-v1-1-0-cpp-sdk).

Extract the complete package for your system.
Choose your OS and architecture. Windows requires a compatible MSVC toolset;
Linux release SDKs target glibc 2.35+ and GCC 11+.

Find the **SDK prefix** in the extracted package:

```text
sdk/                         <- CMAKE_PREFIX_PATH points here
  include/
  lib/
    cmake/MIG/MIGConfig.cmake
```

Native application archives also have an SDK under `sdk/`.

> [!TIP]
> **Want to see an action before writing your own host?** Run the
> [positions tutorial](../../examples/sdk-consumer/README.md). It recognizes
> a generated hand raise without a camera or tracking models.

## Build and install from source

Install CMake 3.25+ and a C++20 compiler. On Windows, install Visual Studio Build
Tools with Desktop development with C++; on Linux, install CMake, GCC and a
build tool such as Ninja or Make. From the full checkout root:

```sh
cmake --preset sdk-release
cmake --build --preset sdk-release --parallel 2
ctest --preset sdk-release
cmake --install build/sdk-release --config Release --prefix install
```

The SDK is now under `install/`. Use its absolute path as the prefix for your
application. No administrator access is needed for this local installation.
The first configuration may download the pinned JSON dependency. The SDK preset
disables desktop applications and native camera dependencies; no MediaPipe
bootstrap is needed. For camera-enabled builds, use the
[Windows](windows.md) or [Linux](linux.md) guide instead.

<details>
<summary>Alternative: generate GNU Makefiles on Linux</summary>

Use a separate build directory:

```sh
cmake -S . -B build/sdk-make -G "Unix Makefiles" \
    -DCMAKE_BUILD_TYPE=Release -DMIG_INSTALL=ON \
    -DMIG_BUILD_CONFIGURATOR=OFF -DMIG_BUILD_CONTROLLER=OFF \
    -DMIG_BUILD_NATIVE_RUNTIME=OFF
cmake --build build/sdk-make --parallel 2
ctest --test-dir build/sdk-make --output-on-failure
cmake --install build/sdk-make --prefix install
```

`cmake --build` invokes Make for this generator; `make -C build/sdk-make -j2`
is equivalent. A checkout has no handwritten root Makefile. Do not change the
generator of an existing build directory.

</details>

## Link your application

In your application's `CMakeLists.txt`:

```cmake
cmake_minimum_required(VERSION 3.25)
project(MyApplication LANGUAGES CXX)

find_package(MIG 1.0 CONFIG REQUIRED)

add_executable(my-application main.cpp)
target_link_libraries(my-application PRIVATE MIG::core MIG::format)
```

Configure and build from your application directory:

```sh
cmake -S . -B build -DCMAKE_BUILD_TYPE=Release -DCMAKE_PREFIX_PATH=/absolute/path/to/sdk
cmake --build build --config Release --parallel 2
```

Replace the prefix with the extracted SDK or your local `install/`. Quote paths
containing spaces. Visual Studio creates the executable under `build/Release/`;
single-configuration generators normally place it under `build/`.

| Target | Use |
| --- | --- |
| `MIG::core` | Recognize movements from supplied landmarks |
| `MIG::format` | Load and save JSON profiles; links the core |
| `MIG::hands`, `MIG::face` | Optional hand/face helpers when included in the SDK |
| `MIG::c` | Shared C ABI for native and language integrations |
| `MIG::native` | Camera adapter, only in camera-enabled SDKs |

Targets supply their include paths and C++20 requirements. Do not manually link
the JSON dependency. Use matching architecture, compiler/runtime and build
configuration for your SDK and application. Hosts using the shared C ABI must
also make its DLL/SO available at runtime.

For a complete runnable consumer, configure
[examples/sdk-consumer](../../examples/sdk-consumer/README.md) with the same
prefix. It uses synthetic observations and needs no camera.
The [API reference](../reference/cpp.md) describes frames and recognition.

## Package-manager alternatives and troubleshooting

A local Debian package installs the SDK under `/usr`; CMake can discover it
without a custom prefix. vcpkg provides it through the release overlay and its
CMake toolchain. See [distribution](packages.md) and the
[vcpkg port](../../ports/motion-input-grid/README.md).

| Symptom | Check |
| --- | --- |
| CMake cannot find MIG | Point `CMAKE_PREFIX_PATH` at the SDK prefix above, or set `MIG_DIR=/path/to/sdk/lib/cmake/MIG`. |
| `MIG::native` is missing | Use a camera-enabled SDK; the positions-only download does not export this target. |
| MediaPipe is requested for a positions-only build | Select `sdk-release`, which disables desktop/camera targets. |
| Linker or DLL/SO loading error | Match architecture, compiler/runtime and build configuration; make shared libraries available at runtime. |
