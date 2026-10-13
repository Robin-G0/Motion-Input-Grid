"""Verify generated archive manifests, licenses and minimal runtime payloads."""
import hashlib
import json
from pathlib import Path
import re
import sys
import tarfile
import zipfile
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "tools/lib"))
from distribution_policy import EXCLUDED_NAMES
from release_metadata import PACKAGE_NAME, PROJECT_NAME, REPOSITORY
from wheel_record import validate_wheel


def archive_files(path):
    if zipfile.is_zipfile(path):
        with zipfile.ZipFile(path) as archive:
            return {name: archive.read(name) for name in archive.namelist() if not name.endswith("/")}
    with tarfile.open(path) as archive:
        return {member.name: archive.extractfile(member).read()
                for member in archive.getmembers() if member.isfile() or member.issym() or member.islnk()}


def check_manifest(files):
    manifests = [name for name in files if name.endswith("manifest.json")]
    if not manifests:
        raise AssertionError("Missing package manifest")
    for name in manifests:
        manifest = json.loads(files[name])
        assert manifest["project"] == PROJECT_NAME, name
        assert manifest["package"] == PACKAGE_NAME, name
        assert manifest["repository"] == REPOSITORY, name
        prefix = name.removesuffix("manifest.json")
        for relative, digest in manifest["sha256"].items():
            assert hashlib.sha256(files[prefix + relative]).hexdigest() == digest, relative


def verify(path):
    files = archive_files(path)
    names = list(files)
    assert path.name.startswith(("motion-input-grid-", "motion_input_grid-")), path
    npm_package = ("package/package.json" in files and
                   json.loads(files["package/package.json"])["name"] == "motion-input-grid")
    assert not any(".." in Path(name).parts or name.startswith("/") for name in names)
    assert not any("node_modules" in Path(name).parts or ".git" in Path(name).parts for name in names)
    for name in names:
        parts = Path(name).parts
        for index, part in enumerate(parts):
            if part not in EXCLUDED_NAMES:
                continue
            # These exact directories are runnable framework output. Caches and
            # build directories elsewhere remain excluded from release archives.
            framework = {'react': 'dist', 'vue': 'dist', 'next': 'out'}
            combined_output = (index == 3 and parts[1] == 'examples' and
                               framework.get(parts[2]) == part and
                               '-javascript-examples' in parts[0])
            individual_output = (index == 1 and any(
                f'-browser-{example}-standalone' in parts[0] and output == part
                for example, output in framework.items()))
            assert combined_output or individual_output, (path, name)
    assert any(name.endswith("LICENSE") for name in names), path
    if "-native." in path.name or "-examples." in path.name:
        assert any(name.endswith("licenses/MediaPipe-LICENSE") and files[name].strip()
                   for name in names), "Missing MediaPipe runtime license"
        assert any(name.endswith("licenses/nlohmann-LICENSE") and files[name].strip()
                   for name in names), "Missing nlohmann runtime license"
    if "vcpkg-overlay" in path.name:
        source = next(data.decode() for name, data in files.items() if name.endswith("source.cmake"))
        assert re.search(r'MIG_SOURCE_SHA512 "[0-9a-f]{128}"', source)
        port = next(data for name, data in files.items() if name.endswith("motion-input-grid/vcpkg.json"))
        assert json.loads(port)["name"] == PACKAGE_NAME
    elif path.name.startswith("motion_input_grid-") and path.name.endswith(".tar.gz"):
        assert any(name.endswith("_engine/vendor/include/nlohmann/json.hpp") for name in names)
        assert any(name.endswith("_engine/src/c-api/api.cpp") for name in names)
        assert any(name.endswith("native/CMakeLists.txt") for name in names)
    elif "-source.tar.gz" not in path.name and path.suffix != ".whl" and not npm_package:
        check_manifest(files)
    if any(marker in path.name for marker in ("-unity.", "-unreal.", "-godot.")):
        assert any(name.endswith("nlohmann-LICENSE") for name in names)
        assert not any("mediapipe" in name.lower() or "/models/" in name or name.endswith(".a") for name in names)
        assert not any("mig-core.lib" in name or "mig-format.lib" in name for name in names)
        if "-unity." in path.name:
            assert json.loads(files["package/package.json"])["name"] == "com.robin-g0.motion-input-grid"
            metadata = next(data.decode() for name, data in files.items()
                            if name.endswith((".dll.meta", ".so.meta")))
            metadata = metadata.replace("\r\n", "\n")
            assert "package/Runtime/Bridge/MigTracker.cs.meta" in files
            assert "package/Runtime/MIG.Runtime.asmdef.meta" in files
            target = "Win64" if "windows" in path.name else "Linux64"
            assert f"Standalone: {target}" in metadata
            assert "Any: \n    second:\n      enabled: 0" in metadata
    if path.suffix == ".whl":
        validate_wheel(path)
        assert "none-any" not in path.name, "A self-contained wheel must be platform tagged"
        assert any("mig/_native/" in name and name.endswith((".dll", ".so.1")) for name in names)
        assert any(name.endswith("nlohmann-LICENSE") for name in names)
        assert any(name.endswith(".dist-info/licenses/LICENSE") for name in names)
        native = next(data for name, data in files.items()
                      if "mig/_native/" in name and name.endswith((".dll", ".so.1")))
        if "win_amd64" in path.name:
            offset = int.from_bytes(native[60:64], "little")
            assert native[offset:offset + 4] == b"PE\0\0"
            assert int.from_bytes(native[offset + 4:offset + 6], "little") == 0x8664
        else:
            assert native[:4] == b"\x7fELF"
            machine = 183 if "aarch64" in path.name else 62
            assert int.from_bytes(native[18:20], "little") == machine
    print(f"Verified {path.name}")


if __name__ == "__main__":
    for argument in sys.argv[1:]:
        path = Path(argument)
        if path.is_dir():
            for archive in sorted(path.iterdir()):
                if archive.name.endswith((".zip", ".tgz", ".tar.gz", ".whl")):
                    verify(archive)
        else:
            verify(path)
