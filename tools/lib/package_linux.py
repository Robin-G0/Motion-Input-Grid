#!/usr/bin/env python3
"""Package Linux SDKs and applications with dependencies and licenses."""
import argparse
import gzip
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import tarfile
import tempfile
from release_metadata import PACKAGE_NAME, PROJECT_NAME, REPOSITORY, release_version
from distribution_policy import EXCLUDED_NAMES

SYSTEM_LIBRARIES = {
    "libc.so.6", "libm.so.6", "libpthread.so.0", "libdl.so.2", "librt.so.1",
    "libresolv.so.2", "libutil.so.1", "ld-linux-x86-64.so.2",
}
EXCLUDED_FILES = {
    "__pycache__", "build", ".git", ".venv", "node_modules", ".next", "dist", "out", "public",
}


def run(*arguments):
    return subprocess.check_output(arguments, text=True).strip()


def copy_tree(source, destination):
    def excluded(directory, names):
        return [name for name in names if name in EXCLUDED_FILES or name in EXCLUDED_NAMES
                or name.endswith((".pyc", ".egg-info"))]
    shutil.copytree(source, destination, symlinks=True, ignore=excluded)


def dependencies(path):
    output = run("ldd", str(path))
    if "not found" in output:
        raise RuntimeError(f"Unresolved dependencies for {path}:\n{output}")
    return [Path(match) for match in re.findall(r"(?:=>\s+|^\s*)(/\S+)", output, re.M)]


def library_package(path):
    candidates = [path, path.resolve(), Path("/usr") / path.relative_to("/")]
    for candidate in candidates:
        result = subprocess.run(["dpkg-query", "-S", str(candidate)], text=True,
                                capture_output=True)
        if result.returncode == 0:
            return result.stdout.split(": ", 1)[0].splitlines()[0]
    raise RuntimeError(f"No package/license provenance for {path}")


def bundle_libraries(seeds, destination, licenses, system_libraries=SYSTEM_LIBRARIES):
    pending = list(seeds)
    seen = set()
    packages = set()
    inventory = []
    destination.mkdir(parents=True)
    while pending:
        binary = pending.pop()
        for path in dependencies(binary):
            if path.name in system_libraries or path.name in seen:
                continue
            seen.add(path.name)
            shutil.copy2(path, destination / path.name)
            package = library_package(path)
            packages.add(package)
            inventory.append({"file": path.name, "package": package,
                              "version": run("dpkg-query", "-W", "-f=${Version}", package)})
            pending.append(path)
    for package in packages:
        name = package.split(":", 1)[0]
        copyright_file = Path("/usr/share/doc") / name / "copyright"
        if not copyright_file.exists():
            raise RuntimeError(f"Missing copyright notice: {package}")
        shutil.copy2(copyright_file, licenses / f"{name}-copyright")
    if not (licenses / "common-licenses").exists():
        copy_tree(Path("/usr/share/common-licenses"), licenses / "common-licenses")
    return sorted(inventory, key=lambda item: item["file"])


def write_launcher(root, name):
    script = root / name
    script.write_text(f'''#!/bin/sh
set -eu
root=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
export LD_LIBRARY_PATH="$root/lib${{LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}}"
export QT_PLUGIN_PATH="$root/plugins"
export FONTCONFIG_FILE="$root/fonts.conf"
exec "$root/bin/{name}" --runtime "$root" "$@"
''')
    script.chmod(0o755)


def bundle_apps(root, install, runtime):
    licenses = root / "licenses"
    shutil.copy2(runtime / "libmediapipe.so", root)
    shutil.copy2(runtime / "LICENSE", licenses / "MediaPipe-LICENSE")
    copy_tree(runtime / "models", root / "models")
    binary_directory = root / "bin"
    binary_directory.mkdir()
    seeds = [root / "libmediapipe.so"]
    for name in ("motion-input-grid-controller", "motion-input-grid-studio"):
        binary = binary_directory / name
        shutil.copy2(install / "bin" / name, binary)
        binary.chmod(0o755)
        seeds.append(binary)
        write_launcher(root, name)
    copy_tree(install / "share" / "applications", root / "share" / "applications")
    copy_tree(install / "share" / "icons", root / "share" / "icons")
    plugin_directory = Path("/usr/lib/x86_64-linux-gnu/qt6/plugins")
    for category in ("platforms", "imageformats"):
        copy_tree(plugin_directory / category, root / "plugins" / category)
        seeds.extend((root / "plugins" / category).glob("*.so"))
    (binary_directory / "qt.conf").write_text("[Paths]\nPrefix=..\nPlugins=plugins\n")
    copy_tree(Path("/usr/share/fonts/truetype/dejavu"), root / "fonts")
    (root / "fonts.conf").write_text(
        '<?xml version="1.0"?>\n<!DOCTYPE fontconfig SYSTEM "fonts.dtd">\n'
        '<fontconfig><dir prefix="relative">fonts</dir>'
        '<cachedir prefix="xdg">fontconfig</cachedir></fontconfig>\n')
    shutil.copy2(Path("/usr/share/doc/fonts-dejavu-core/copyright"),
                 licenses / "fonts-dejavu-copyright")
    return bundle_libraries(seeds, root / "lib", licenses)


def write_manifest(root, arguments, dependencies):
    files = {}
    for path in sorted(root.rglob("*")):
        if path.is_file() and not path.is_symlink():
            files[str(path.relative_to(root))] = hashlib.sha256(path.read_bytes()).hexdigest()
    manifest = {"project": PROJECT_NAME, "package": PACKAGE_NAME, "repository": REPOSITORY,
                "version": arguments.version, "architecture": arguments.architecture,
                "variant": "native" if arguments.native else "positions-sdk",
                "baseline": "Ubuntu 22.04 / glibc 2.35",
                "dependencies": dependencies, "sha256": files}
    (root / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")


def verify_architecture(root, architecture):
    expected = 183 if architecture == "arm64" else 62
    for path in root.rglob("*"):
        if not path.is_file():
            continue
        with path.open("rb") as file:
            header = file.read(20)
        if header[:4] == b"\x7fELF":
            machine = int.from_bytes(header[18:20], "little")
            if machine != expected:
                raise RuntimeError(f"Architecture mismatch: {path}")


def create_archive(root, output):
    def metadata(info):
        info.uid = info.gid = 0
        info.uname = info.gname = "root"
        info.mtime = int(os.environ.get("SOURCE_DATE_EPOCH", "0"))
        if info.isfile() and (info.name.endswith("/node") or info.name.endswith(".sh")):
            info.mode = 0o755
        return info
    with output.open("wb") as file:
        with gzip.GzipFile(filename="", fileobj=file, mode="wb", mtime=0) as compressed:
            with tarfile.open(fileobj=compressed, mode="w") as archive:
                archive.add(root, arcname=root.name, filter=metadata)
    digest = hashlib.sha256(output.read_bytes()).hexdigest()
    output.with_name(output.name + ".sha256").write_text(f"{digest}  {output.name}\n")


def arguments():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--install", required=True, type=Path)
    parser.add_argument("--runtime", type=Path, default=Path("build/native-linux-deps"))
    parser.add_argument("--version", default=release_version())
    parser.add_argument("--architecture", choices=("x64", "arm64"), default="x64")
    parser.add_argument("--native", action="store_true")
    parser.add_argument("--destination", type=Path, default=Path("build/releases"))
    result = parser.parse_args()
    if result.native and result.architecture != "x64":
        parser.error("The pinned native MediaPipe runtime is only available for Linux x64")
    if not re.fullmatch(r"[0-9]+\.[0-9]+\.[0-9]+", result.version):
        parser.error("Version must have the form major.minor.patch")
    return result


def main():
    options = arguments()
    options.destination.mkdir(parents=True, exist_ok=True)
    suffix = "native" if options.native else "sdk"
    name = f"motion-input-grid-{options.version}-linux-{options.architecture}-{suffix}"
    project = Path(__file__).resolve().parents[2]
    with tempfile.TemporaryDirectory(prefix="mig-package-", dir=options.destination) as folder:
        root = Path(folder) / name
        copy_tree(options.install, root / "sdk")
        copy_tree(project / "docs", root / "docs")
        copy_tree(project / "examples", root / "examples")
        copy_tree(project / "integrations", root / "integrations")
        for binding in ("python", "dotnet"):
            copy_tree(project / "bindings" / binding, root / "bindings" / binding)
        copy_tree(project / "configs", root / "configs")
        (root / "licenses").mkdir()
        shutil.copy2(project / "LICENSE", root / "LICENSE")
        usage = ("Run `./motion-input-grid-controller` or `./motion-input-grid-studio` from this directory."
                 if options.native else "Set CMAKE_PREFIX_PATH to the extracted `sdk` directory.")
        (root / "README.md").write_text(
            f"# Motion Input Grid (MIG) {options.version} — Linux {options.architecture}\n\n"
            "[English](README.md) | [Français](README.fr.md)\n\n"
            f"{usage}\n\n"
            "See [package installation](docs/getting-started/packages.md) and the "
            "[verification report](docs/reference/support.md) for prerequisites and limitations.\n")
        usage_fr = ("Lancez ./motion-input-grid-controller ou ./motion-input-grid-studio depuis ce dossier."
                    if options.native else "Utilisez le dossier sdk comme CMAKE_PREFIX_PATH.")
        (root / "README.fr.md").write_text(
            f"# Motion Input Grid (MIG) {options.version} — Linux {options.architecture}\n\n"
            "[English](README.md) | [Français](README.fr.md)\n\n"
            f"{usage_fr}\n\n"
            "[Installation](docs/getting-started/packages.fr.md) et "
            "[vérifications actuelles](docs/reference/support.fr.md).\n", encoding="utf-8")
        shutil.copy2(options.runtime / "nlohmann-LICENSE", root / "licenses/nlohmann-LICENSE")
        inventory = bundle_apps(root, options.install, options.runtime) if options.native else []
        verify_architecture(root, options.architecture)
        write_manifest(root, options, inventory)
        output = options.destination / f"{name}.tar.gz"
        create_archive(root, output)
        if options.native:
            from importlib.util import spec_from_file_location, module_from_spec
            spec = spec_from_file_location("controller_package", project / "tools/packaging/package-controller.py")
            controller_package = module_from_spec(spec)
            spec.loader.exec_module(controller_package)
            payload = Path(folder) / "controller-only"
            controller_package.controller_payload(root, payload, "linux")
            portable = options.destination / f"motion-input-grid-{options.version}-controller-linux-x64.run"
            controller_package.linux_file(payload, portable)
            digest = hashlib.sha256(portable.read_bytes()).hexdigest()
            portable.with_name(portable.name + ".sha256").write_text(f"{digest}  {portable.name}\n")
    print(output)


if __name__ == "__main__":
    main()
