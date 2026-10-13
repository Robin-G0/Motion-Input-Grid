#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
version=$(tr -d '\r\n' < VERSION)
dependencies=build/native-linux-deps
mode="${1:-}"
if [[ $# -gt 1 || ( -n "$mode" && "$mode" != --engines-only ) ]]; then
    echo "Usage: $0 [--engines-only]" >&2
    exit 2
fi
if [[ "$mode" != --engines-only ]]; then
    for architecture in x64 arm64; do
        sdk="build/release-sdk-$architecture-install"
        python3 tools/packaging/package-sdk.py --sdk "$sdk" --dependencies "$dependencies" --platform "linux-$architecture"
        if [[ "$architecture" == arm64 ]]; then
            python3 tests/packaging/sdk_package_tests.py "build/releases/motion-input-grid-$version-linux-arm64-sdk.tar.gz" --arm64
        else
            python3 tests/packaging/sdk_package_tests.py "build/releases/motion-input-grid-$version-linux-x64-sdk.tar.gz"
        fi
    done
    python3 tests/packaging/python_package_tests.py build/releases/*-manylinux_2_35_x86_64.whl
    python3 tests/packaging/debian_package_tests.py build/releases/motion-input-grid_*.deb
    exit 0
fi

for architecture in x64 arm64; do
    python3 tools/packaging/package-integrations.py --ecosystem unreal --sdk "build/release-sdk-$architecture-install" --dependencies "$dependencies" --platform "linux-$architecture"
done
python3 tools/packaging/package-integrations.py --ecosystem unity --sdk build/release-sdk-x64-install --dependencies "$dependencies" --platform linux-x64
python3 tests/packaging/native_integration_package_tests.py "build/releases/motion-input-grid-$version-linux-x64-unreal.zip"
python3 tests/packaging/native_integration_package_tests.py "build/releases/motion-input-grid-$version-linux-x64-unreal-standalone.zip"
python3 tests/packaging/standalone_editor_tests.py "build/releases/motion-input-grid-$version-linux-x64-unreal-standalone.zip"
python3 tools/bootstrap/bootstrap-godot.py --editor
for architecture in x64 arm64; do
    toolchain=()
    if [[ "$architecture" == arm64 ]]; then
        toolchain=("-DCMAKE_TOOLCHAIN_FILE=$PWD/cmake/linux-arm64.cmake")
    fi
    build="build/release-godot-linux-$architecture"
    cmake -S integrations/godot/native -B "$build" -G Ninja -DCMAKE_BUILD_TYPE=Release \
        "${toolchain[@]}" -DGODOT_CPP_DIR="$PWD/build/godot-deps/godot-cpp-godot-4.3-stable" \
        -DCMAKE_PREFIX_PATH="$PWD/build/release-sdk-$architecture-install"
    cmake --build "$build" --parallel "${MIG_BUILD_JOBS:-3}"
    python3 tools/packaging/package-integrations.py --ecosystem godot --sdk "build/release-sdk-$architecture-install" \
        --dependencies "$dependencies" --platform "linux-$architecture" --godot-bridge "$build/mig-godot.so" \
        --godot-cpp build/godot-deps/godot-cpp-godot-4.3-stable
done
python3 tests/packaging/godot_package_tests.py "build/releases/motion-input-grid-$version-linux-x64-godot.zip" \
    --godot build/godot-deps/Godot_v4.3-stable_linux.x86_64
python3 tests/packaging/godot_package_tests.py "build/releases/motion-input-grid-$version-linux-x64-godot-gdscript-standalone.zip" \
    --godot build/godot-deps/Godot_v4.3-stable_linux.x86_64
python3 tests/packaging/standalone_editor_tests.py "build/releases/motion-input-grid-$version-linux-x64-godot-gdscript-standalone.zip"
