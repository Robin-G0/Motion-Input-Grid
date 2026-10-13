"""Stage canonical engine sources and build a self-contained wheel and sdist."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "lib"))
import argparse
import os
import shutil
import subprocess
import tempfile

from package_linux import copy_tree
from release_metadata import build_directory, ROOT, rewrite_package_guides
from wheel_record import normalize_wheel


def stage_python(destination, dependencies):
    copy_tree(ROOT / "bindings/python", destination)
    engine = destination / "_engine"
    engine.mkdir()
    for name in ("CMakeLists.txt", "VERSION", "LICENSE"):
        shutil.copy2(ROOT / name, engine / name)
    for name in ("src", "cmake"):
        copy_tree(ROOT / name, engine / name)
    headers = dependencies / "include/nlohmann"
    if not headers.is_dir() or not (dependencies / "nlohmann-LICENSE").is_file():
        raise ValueError("Supply bootstrapped nlohmann headers and nlohmann-LICENSE")
    copy_tree(headers, engine / "vendor/include/nlohmann")
    shutil.copy2(dependencies / "nlohmann-LICENSE", engine / "vendor/nlohmann-LICENSE")
    shutil.copy2(ROOT / "LICENSE", destination / "LICENSE")
    rewrite_package_guides(destination)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dependencies", type=Path, default=ROOT / "build/native-deps")
    parser.add_argument("--destination", type=Path, default=ROOT / "build/releases")
    parser.add_argument("--linux-arm64", action="store_true",
                        help="Cross-build on Linux with the existing ARM64 toolchain")
    args = parser.parse_args()
    args.destination.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="python-source-", dir=build_directory()) as folder:
        source = Path(folder) / "package"
        artifacts = Path(folder) / "dist"
        stage_python(source, args.dependencies.resolve())
        command = [sys.executable, "-m", "build", str(source), "--outdir", str(artifacts)]
        environment = os.environ.copy()
        if args.linux_arm64:
            if sys.platform != "linux":
                parser.error("--linux-arm64 requires the Linux cross-toolchain")
            environment["_PYTHON_HOST_PLATFORM"] = "linux-aarch64"
            toolchain = source / "_engine/cmake/linux-arm64.cmake"
            command.append(f"--config-setting=cmake.define.CMAKE_TOOLCHAIN_FILE={toolchain}")
        subprocess.run(command, env=environment, check=True)
        for wheel in artifacts.glob("*.whl"):
            normalize_wheel(wheel)
        for artifact in artifacts.iterdir():
            shutil.copy2(artifact, args.destination / artifact.name)


if __name__ == "__main__":
    main()
