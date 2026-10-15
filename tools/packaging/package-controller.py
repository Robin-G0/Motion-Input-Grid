#!/usr/bin/env python3
"""Build Controller-only single-file distributions from prepared native bundles.

Windows embeds every payload in a statically linked native launcher. Linux wraps
the dependency-bundled native release in a self-extracting POSIX launcher. Windows
validates/reuses a persistent payload cache; Linux cleans temporary files on exit.
Neither downloads dependencies at runtime nor changes the user's configuration.
"""
import argparse
import hashlib
import json
import os
import re
from pathlib import Path
import shutil
import subprocess
import sys
import tarfile
import tempfile

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "tools/lib"))
from pe_dependencies import audit_windows


def write_payload_manifest(destination):
    manifest = {str(path.relative_to(destination)).replace("\\", "/"): hashlib.sha256(path.read_bytes()).hexdigest()
                for path in sorted(destination.rglob("*")) if path.is_file() and path.name != "controller-manifest.json"}
    (destination / "controller-manifest.json").write_text(json.dumps({"files": manifest}, indent=2)+"\n")


def controller_payload(source, destination, platform, redist=None):
    """Select runtime, models and legal notices, excluding Studio and SDK files."""
    source, destination = Path(source), Path(destination)
    destination.mkdir(parents=True, exist_ok=True)
    if platform == "windows":
        for name in ["motion-input-grid-controller.exe", "libmediapipe.dll"]:
            if not (source / name).is_file():
                raise ValueError(f"Missing Controller runtime: {name}")
        names = [p for p in source.glob("*.dll") if p.name.lower() != "mig-c.dll"] + [source / "motion-input-grid-controller.exe"]
        for path in names:
            shutil.copy2(path, destination / path.name)
        if redist is None or not Path(redist).is_dir():
            raise ValueError("Windows requires --redist pointing to Microsoft.VC*.CRT (app-local runtime DLLs)")
        runtime = list(Path(redist).glob("*.dll"))
        if not any(p.name.lower().startswith("vcruntime140") for p in runtime) or not any(p.name.lower().startswith("msvcp140") for p in runtime):
            raise ValueError("The selected runtime lacks vcruntime140 or msvcp140")
        for path in runtime:
            shutil.copy2(path, destination / path.name)
    else:
        binary = source / "bin/motion-input-grid-controller"
        for required in [binary, source / "libmediapipe.so", source / "lib", source / "plugins"]:
            if not required.exists():
                raise ValueError(f"Missing dependency-bundled Linux runtime: {required}")
        (destination / "bin").mkdir()
        shutil.copy2(binary, destination / "bin" / binary.name)
        (destination / "bin" / binary.name).chmod(0o755)
        if (source / "bin/qt.conf").exists():
            shutil.copy2(source / "bin/qt.conf", destination / "bin/qt.conf")
        for name in ["libmediapipe.so", "fonts.conf"]:
            if (source / name).exists():
                shutil.copy2(source / name, destination / name)
        for name in ["lib", "plugins", "fonts"]:
            if (source / name).is_dir():
                shutil.copytree(source / name, destination / name, symlinks=False)
    if not (source / "licenses").is_dir():
        raise ValueError("The prepared bundle must include dependency license notices")
    for name in ["models", "licenses"]:
        shutil.copytree(source / name, destination / name, symlinks=False)
    for name in ["pose_landmarker_lite.task", "pose_landmarker_full.task", "hand_landmarker.task"]:
        if not (destination / "models" / name).is_file():
            raise ValueError(f"Missing model: {name}")
    shutil.copy2(ROOT / "LICENSE", destination / "LICENSE")
    write_payload_manifest(destination)


def windows_resources(payload, generated):
    paths = sorted(Path(payload).rglob("*"))
    resources, entries, inventory = [], [], []
    for index, path in enumerate((p for p in paths if p.is_file()), 101):
        name = path.relative_to(payload).as_posix()
        if any(c in name for c in ['"', "\n", "\r"]) or ".." in Path(name).parts:
            raise ValueError(f"Unsafe payload path: {name}")
        resources.append(f'{index} RCDATA "{path.resolve().as_posix()}"')
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        size = path.stat().st_size
        entries.append(f'    {{{index}, L"{name}", {size}ULL, "{digest}"}},')
        inventory.append({"name": name, "size": size, "sha256": digest})
    payload_hash = hashlib.sha256(json.dumps({"schema": 1, "files": inventory}, sort_keys=True, separators=(",", ":")).encode()).hexdigest()
    generated.mkdir(parents=True, exist_ok=True)
    (generated / "payload.rc").write_text("#pragma code_page(65001)\n"+"\n".join(resources)+"\n", encoding="utf-8")
    (generated / "payload.hpp").write_text(
        "#pragma once\nstruct PayloadFile { int id; const wchar_t* name; unsigned long long size; const char* sha256; };\n"
        f'inline constexpr char payload_hash[] = "{payload_hash}";\n'
        "inline constexpr PayloadFile payload_files[] = {\n"+"\n".join(entries)+"\n};\n", encoding="utf-8")
    return payload_hash


def linux_file(payload, output):
    # /bin/sh, tar and gzip are baseline OS facilities. glibc and display drivers
    # intentionally remain supplied by the host, as in the native release.
    script = '''#!/bin/sh
set -eu
umask 077
runtime=$(mktemp -d "${TMPDIR:-/tmp}/mig-controller.XXXXXXXX")
cleanup() { rm -rf -- "$runtime"; }
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
line=$(awk '/^__MIG_PAYLOAD__$/ { print NR + 1; exit }' "$0")
tail -n +"$line" "$0" | tar -xz -C "$runtime"
export LD_LIBRARY_PATH="$runtime/lib${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
export QT_PLUGIN_PATH="$runtime/plugins"
export QT_QPA_PLATFORM_PLUGIN_PATH="$runtime/plugins/platforms"
export FONTCONFIG_FILE="$runtime/fonts.conf"
"$runtime/bin/motion-input-grid-controller" --runtime "$runtime" "$@"
exit $?
__MIG_PAYLOAD__
'''
    with output.open("wb") as file:
        file.write(script.encode())
        def metadata(info):
            info.uid = info.gid = 0
            info.uname = info.gname = "root"
            info.mtime = int(os.environ.get("SOURCE_DATE_EPOCH", "0"))
            info.mode = 0o755 if info.isdir() or info.name == "bin/motion-input-grid-controller" else 0o644
            return info
        with tarfile.open(fileobj=file, mode="w:gz", dereference=True) as archive:
            for path in sorted(payload.iterdir()):
                archive.add(path, arcname=path.name, filter=metadata)
    output.chmod(0o755)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, required=True, help="Prepared Windows folder or extracted Linux native bundle")
    parser.add_argument("--platform", choices=["windows", "linux"], required=True)
    parser.add_argument("--redist", type=Path)
    parser.add_argument("--output", type=Path, default=ROOT / "build/releases")
    parser.add_argument("--cmake", default="cmake")
    parser.add_argument("--version", default=(ROOT / "VERSION").read_text().strip())
    arguments = parser.parse_args()
    if not re.fullmatch(r"[0-9]+\.[0-9]+\.[0-9]+", arguments.version):
        parser.error("Version must have the form major.minor.patch")
    arguments.output.mkdir(parents=True, exist_ok=True)
    suffix = "exe" if arguments.platform == "windows" else "run"
    output = arguments.output / f"motion-input-grid-{arguments.version}-controller-{arguments.platform}-x64.{suffix}"
    with tempfile.TemporaryDirectory(prefix="mig-controller-build-") as temp:
        work = Path(temp)
        payload = work / "payload"
        controller_payload(arguments.source, payload, arguments.platform, arguments.redist)
        if arguments.platform == "windows":
            if sys.platform != "win32":
                raise ValueError("The Windows launcher must be compiled on Windows")
            dependencies = payload / "windows-dll-dependencies.json"
            dependencies.write_text(json.dumps(audit_windows(payload), indent=2)+"\n")
            write_payload_manifest(payload)
            generated = work / "generated"
            payload_hash = windows_resources(payload, generated)
            subprocess.run([arguments.cmake, "-S", str(ROOT / "tools/packaging/controller-launcher"), "-B", str(work / "build"), "-A", "x64", f"-DPAYLOAD_DIRECTORY={generated}"], check=True)
            subprocess.run([arguments.cmake, "--build", str(work / "build"), "--config", "Release"], check=True)
            # The static-CRT launcher must also resolve solely through Windows.
            launcher_dependencies = audit_windows(work / "build/Release")
            shutil.copy2(work / "build/Release/mig-controller-portable.exe", output)
            output.with_name(output.name + ".dependencies.json").write_text(json.dumps({
                "payload_hash": payload_hash, "payload": json.loads(dependencies.read_text()), "launcher": launcher_dependencies
            }, indent=2)+"\n")
        else:
            linux_file(payload, output)
    digest = hashlib.sha256(output.read_bytes()).hexdigest()
    output.with_name(output.name+".sha256").write_text(f"{digest}  {output.name}\n")
    print(output)


if __name__ == "__main__":
    main()
