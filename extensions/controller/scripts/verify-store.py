"""Rebuild from the submitted sources with the installed, pinned npm dependency."""
import hashlib
import json
from pathlib import Path, PurePosixPath
import shutil
import subprocess
import tempfile
import zipfile

EXTENSION = Path(__file__).resolve().parents[1]
DIST = EXTENSION / "dist"
VERSION = json.loads((EXTENSION / "package.json").read_text())["version"]
OUT = DIST / "store-submission" / f"mig-controller-{VERSION}"


def hashes(folder):
    return {p.relative_to(folder).as_posix(): hashlib.sha256(p.read_bytes()).hexdigest()
            for p in sorted(folder.rglob("*")) if p.is_file()}


def main():
    source = OUT / "firefox" / f"mig-controller-sources-{VERSION}.zip"
    with tempfile.TemporaryDirectory(dir=DIST, prefix="source-check-") as directory:
        scratch = Path(directory).resolve()
        # This owned directory is removed by TemporaryDirectory; verify its scope
        # before extracting, building or allowing recursive cleanup on Windows.
        if scratch.parent != DIST.resolve() or not scratch.name.startswith("source-check-"):
            raise ValueError("Unexpected source verification directory")
        with zipfile.ZipFile(source) as archive:
            if len(archive.namelist()) != len(set(archive.namelist())):
                raise ValueError("Duplicate source members")
            for name in archive.namelist():
                p = PurePosixPath(name)
                if p.is_absolute() or ".." in p.parts or "\\" in name or ":" in name:
                    raise ValueError("Unsafe source path")
                if p.name in {"CODEBASE_REVIEW.md", "CODE_QUALITY_AUDIT.md", "NEXT.md"}:
                    raise ValueError("Private report leaked into source archive")
            archive.extractall(scratch)
        inputs = json.loads((scratch / "SOURCE-FILES.json").read_text())["sha256"]
        for name, expected in inputs.items():
            if hashlib.sha256((scratch / name).read_bytes()).hexdigest() != expected:
                raise ValueError(f"Source hash mismatch: {name}")
        build = scratch / "extensions/controller"
        shutil.copytree(EXTENSION / "node_modules/motion-input-grid", build / "node_modules/motion-input-grid")
        subprocess.run(["node", "scripts/build.mjs"], cwd=build, check=True)
        for platform in ("chromium", "firefox"):
            expected = hashes(DIST / platform)
            actual = hashes(build / "dist" / platform)
            if actual != expected:
                raise ValueError(f"Source rebuild differs from {platform} submission")
    report_path = OUT / "VALIDATION.json"
    report = json.loads(report_path.read_text())
    report["isolated_source_rebuild"] = {
        "chromium": True, "firefox": True,
        "dependency": "same installed motion-input-grid@1.1.0; no fresh npm download",
        "native_wasm_recompiled": False
    }
    report_path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    entries = [p for p in OUT.rglob("*") if p.is_file() and p.name != "SHA256SUMS"]
    (OUT / "SHA256SUMS").write_text("".join(
        f"{hashlib.sha256(p.read_bytes()).hexdigest()}  {p.relative_to(OUT).as_posix()}\n"
        for p in sorted(entries)), encoding="utf-8")
    print("Source archive verified: isolated Chromium and Firefox rebuilds match every submitted file.")
    print("Installed pinned npm dependency reused; no independent native-to-WASM compilation claimed.")


if __name__ == "__main__":
    main()
