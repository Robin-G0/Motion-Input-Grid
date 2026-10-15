#!/usr/bin/env bash
set -euo pipefail
project_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$project_root"
jobs="${MIG_BUILD_JOBS:-3}"
mkdir -p build/releases
python3 tools/bootstrap/bootstrap-native-linux.py

build_native() {
    cmake -S . -B build/release-linux-x64 -G Ninja \
        -DCMAKE_BUILD_TYPE=Release -DCMAKE_INSTALL_PREFIX=/usr
    cmake --build build/release-linux-x64 --parallel "$jobs"
    ctest --test-dir build/release-linux-x64 --output-on-failure
    cmake --install build/release-linux-x64 --prefix "$project_root/build/release-linux-x64-install"
    PYTHONPATH=bindings/python python3 tests/bindings/python/python_tests.py \
        build/release-linux-x64/src/c-api/libmig-c.so
    python3 tests/examples/python_demo_tests.py build/release-linux-x64/src/c-api/libmig-c.so
}

build_sdk() {
    local architecture="$1"
    local build_directory="build/release-sdk-$architecture"
    local install_directory="$project_root/$build_directory-install"
    local toolchain=()
    if [[ "$architecture" == arm64 ]]; then
        toolchain=("-DCMAKE_TOOLCHAIN_FILE=$project_root/cmake/linux-arm64.cmake")
    fi
    cmake -S . -B "$build_directory" -G Ninja "${toolchain[@]}" \
        -DCMAKE_BUILD_TYPE=Release -DCMAKE_INSTALL_PREFIX=/usr \
        -DMIG_BUILD_CONFIGURATOR=OFF -DMIG_BUILD_CONTROLLER=OFF \
        -DMIG_BUILD_NATIVE_RUNTIME=OFF -DMIG_PACKAGE_SDK=ON
    cmake --build "$build_directory" --parallel "$jobs"
    ctest --test-dir "$build_directory" --output-on-failure
    cmake --install "$build_directory" --prefix "$install_directory"
    (cd "$build_directory" && cpack -G DEB)
    cp "$build_directory"/motion-input-grid_*.deb build/releases/
    cmake -S examples/sdk-consumer -B "$build_directory-consumer" -G Ninja \
        "${toolchain[@]}" \
        -DCMAKE_BUILD_TYPE=Release "-DCMAKE_PREFIX_PATH=$install_directory"
    cmake --build "$build_directory-consumer" --parallel "$jobs"
    if [[ "$architecture" == arm64 ]]; then
        qemu-aarch64 -L /usr/aarch64-linux-gnu "$build_directory-consumer/mig-sdk-example" configs/default.json
    else
        "$build_directory-consumer/mig-sdk-example" configs/default.json
    fi
    python3 tools/packaging/package-linux.py --install "$install_directory" --architecture "$architecture"
}

build_python() {
    python3 -m venv build/release-python-env
    build/release-python-env/bin/python -m pip install build twine auditwheel patchelf
    build/release-python-env/bin/python tools/packaging/package-python.py --dependencies build/native-linux-deps
    for wheel in build/releases/*-linux_x86_64.whl; do
        PATH="$project_root/build/release-python-env/bin:$PATH" \
            build/release-python-env/bin/auditwheel repair --plat manylinux_2_35_x86_64 "$wheel" -w build/releases
        rm "$wheel"
    done
    build/release-python-env/bin/python tools/packaging/normalize-python-wheels.py build/releases/motion_input_grid-*.whl
    build/release-python-env/bin/python -m twine check \
        build/releases/motion_input_grid-*.whl build/releases/motion_input_grid-*.tar.gz
}

build_native
build_sdk x64
build_sdk arm64
python3 tools/packaging/package-linux.py --install build/release-linux-x64-install --native
python3 tests/packaging/controller_package_tests.py
python3 tests/packaging/controller_runtime_tests.py "build/releases/motion-input-grid-$(cat VERSION)-controller-linux-x64.run"
build_python
bash tools/build/build-examples.sh
python3 tools/release/release-checksums.py
python3 tests/packaging/release_archive_tests.py
