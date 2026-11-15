"""Assemble and verify local store dossiers. Never upload, sign, commit or deploy."""
import hashlib
import io
import json
from pathlib import Path
import shutil
import struct
import subprocess
import zipfile
import zlib

EXTENSION = Path(__file__).resolve().parents[1]
ROOT = EXTENSION.parents[1]
DIST = EXTENSION / "dist"
STORE = EXTENSION / "store"
VERSION = json.loads((EXTENSION / "package.json").read_text(encoding="utf-8"))["version"]
OUT = DIST / "store-submission" / f"mig-controller-{VERSION}"
TAG = "v1.1.0"
UPSTREAM_COMMIT = "1c7724896b581894acf6bb55aed654bcb631501a"


def digest(data):
    return hashlib.sha256(data).hexdigest()


def document(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def tree(path):
    return {item.relative_to(path).as_posix(): digest(item.read_bytes())
            for item in sorted(path.rglob("*")) if item.is_file()}


def copy(source, target):
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(source, target)


def git(*args):
    if not (ROOT / ".git").exists():
        raise subprocess.CalledProcessError(128, ["git", *args])
    return subprocess.check_output(["git", "-c", f"safe.directory={ROOT.as_posix()}", *args], cwd=ROOT)


def member(archive, name, data):
    # Stable source ZIP metadata; source content, not the current checkout's mtime.
    info = zipfile.ZipInfo(name, (2026, 11, 1, 0, 0, 0))
    info.compress_type = zipfile.ZIP_DEFLATED
    info.external_attr = 0o100644 << 16
    archive.writestr(info, data)


def assemble_sources(target):
    try:
        tracked = git("ls-files", "-z").decode("utf-8").rstrip("\0").split("\0")
        selected = [ROOT / p for p in tracked if p.startswith(("src/", "cmake/", "tools/"))
                    or p in {"CMakeLists.txt", "VERSION", "LICENSE"}]
        actual = git("rev-parse", TAG + "^{commit}").decode().strip()
        if actual != UPSTREAM_COMMIT:
            raise ValueError("MIG release tag does not match the reviewed upstream commit")
        upstream = git("archive", "--format=zip", TAG)
        head = git("rev-parse", "HEAD").decode().strip()
    except subprocess.CalledProcessError:
        if not (ROOT / "upstream/mig-1.1.0/CMakeLists.txt").is_file():
            raise RuntimeError("Source review needs Git tag v1.1.0 or the supplied upstream source directory")
        selected = [p for folder in ("src", "cmake", "tools") for p in (ROOT / folder).rglob("*") if p.is_file()]
        selected += [ROOT / p for p in ("CMakeLists.txt", "VERSION", "LICENSE")]
        upstream = None
        head = "extracted-source-kit"
    # Explicit source inputs include local packaging changes; never include arbitrary
    # untracked repository files (in particular the user's private audit reports).
    for folder in ("src", "scripts", "tests", "store"):
        selected += [p for p in (EXTENSION / folder).rglob("*") if p.is_file()
                     and "__pycache__" not in p.parts and p.suffix != ".pyc"]
    selected += [EXTENSION / p for p in ("package.json", "package-lock.json", "playwright.config.mjs",
                                        "README.md", "README.fr.md", "PRIVACY.md", "PRIVACY.fr.md")]
    selected += [ROOT / "site/privacy/controller/index.html", ROOT / "site/scripts/build.mjs"]
    source_hashes = {}
    with zipfile.ZipFile(target, "w") as archive:
        for path in sorted(set(selected)):
            if not path.is_file():
                raise FileNotFoundError(path)
            relative = path.relative_to(ROOT).as_posix()
            if relative == "extensions/controller/store/examples/reviewer-profile.json":
                continue  # Generated below, including when rebuilding an extracted source kit.
            data = path.read_bytes()
            member(archive, relative, data)
            source_hashes[relative] = digest(data)
        example_name = "extensions/controller/store/examples/reviewer-profile.json"
        example = (OUT / "examples/reviewer-profile.json").read_bytes()
        member(archive, example_name, example)
        source_hashes[example_name] = digest(example)
        if upstream is not None:
            with zipfile.ZipFile(io.BytesIO(upstream)) as original:
                for info in original.infolist():
                    if not info.is_dir():
                        member(archive, "upstream/mig-1.1.0/" + info.filename, original.read(info))
        else:
            for path in sorted((ROOT / "upstream/mig-1.1.0").rglob("*")):
                if path.is_file() and not any(p in {"build", "node_modules", ".git", "dist", "__pycache__"} for p in path.relative_to(ROOT / "upstream/mig-1.1.0").parts):
                    member(archive, path.relative_to(ROOT).as_posix(), path.read_bytes())
        member(archive, "BUILD-REVIEW.md", (STORE / "BUILD-REVIEW.md").read_bytes())
        member(archive, "runtime-provenance.json", (OUT / "runtime-provenance.json").read_bytes())
        member(archive, "SOURCE-FILES.json", json.dumps({"checkout_head": head,
               "includes_local_submission_changes": True, "upstream_commit": UPSTREAM_COMMIT,
               "sha256": source_hashes}, indent=2).encode("utf-8"))
    return source_hashes


def verify_installable(path, platform):
    expected = tree(DIST / platform)
    with zipfile.ZipFile(path) as archive:
        entries = [i.filename for i in archive.infolist() if not i.is_dir()]
        if len(entries) != len(set(entries)):
            raise ValueError("Duplicate ZIP members")
        actual = {name: digest(archive.read(name)) for name in entries}
        if actual != expected:
            raise ValueError(f"ZIP differs from built {platform} tree")
        manifest = json.loads(archive.read("manifest.json"))
        if manifest["version"] != VERSION or manifest["permissions"] != ["storage", "activeTab", "scripting"]:
            raise ValueError("Unexpected version or permissions")
        if any(name.startswith(("store/", "node_modules/", "tests/", ".git/")) for name in entries):
            raise ValueError("Review/admin files leaked into installable ZIP")
        for locale in ("en", "fr"):
            summary = json.loads(archive.read(f"_locales/{locale}/messages.json"))["description"]["message"]
            if not 1 <= len(summary) <= 132:
                raise ValueError("Invalid localized summary length")
        for required in ("LICENSE", "PRIVACY.md", "PRIVACY.fr.md", "mig/LICENSE"):
            if required not in actual:
                raise ValueError("Missing license/privacy file")
    return actual


def main():
    metadata = json.loads((STORE / "listing.json").read_text(encoding="utf-8"))
    if metadata["version"] != VERSION:
        raise ValueError("Update store metadata to match package version")
    # No recursive cleanup: output is a dedicated generated directory, existing
    # user screenshots are never removed by the assembler.
    OUT.mkdir(parents=True, exist_ok=True)
    for path in STORE.glob("*.md"):
        copy(path, OUT / path.name)
    copy(STORE / "listing.json", OUT / "listing.json")
    copy(STORE / "reviewer-demo.html", OUT / "reviewer-demo.html")
    for filename in ("PRIVACY.md", "PRIVACY.fr.md"):
        copy(EXTENSION / filename, OUT / filename)
    copy(ROOT / "LICENSE", OUT / "LICENSE")
    copy(ROOT / "site/privacy/controller/index.html", OUT / "privacy/index.html")
    for path in (DIST / "store-assets").iterdir():
        if path.is_file():
            copy(path, OUT / "assets" / path.name)
    for size in (64, 96, 128):
        if struct.unpack(">II", (OUT / f"assets/icon-{size}.png").read_bytes()[16:24]) != (size, size):
            raise ValueError("Invalid icon dimensions")
    if struct.unpack(">II", (OUT / "assets/promo-440x280.png").read_bytes()[16:24]) != (440, 280):
        raise ValueError("Invalid promotional image dimensions")
    # Chrome's square store icon: 96px artwork plus 16px transparent padding.
    png = (OUT / "assets/icon-128.png").read_bytes()
    offset, data = 8, b""
    while offset < len(png):
        size = struct.unpack(">I", png[offset:offset + 4])[0]
        if png[offset + 4:offset + 8] == b"IDAT":
            data += png[offset + 8:offset + 8 + size]
        offset += size + 12
    raw = zlib.decompress(data)
    if any(raw[y * 513] != 0 for y in range(128)):
        raise ValueError("Unexpected generated icon PNG filter")
    visible = [(x, y) for y in range(128) for x in range(128) if raw[y * 513 + 1 + x * 4 + 3]]
    if (min(x for x, y in visible), min(y for x, y in visible),
            max(x for x, y in visible), max(y for x, y in visible)) != (16, 16, 111, 111):
        raise ValueError("Store icon must have 96px artwork with 16px transparent margins")
    hashes = {}
    for store, platform in (("chrome", "chromium"), ("opera", "chromium"), ("firefox", "firefox")):
        target = OUT / store / f"mig-controller-{store}-{VERSION}.zip"
        copy(DIST / "packages" / f"mig-controller-{platform}-{VERSION}.zip", target)
        hashes[store] = verify_installable(target, platform)
    document(OUT / "file-hashes.json", hashes)
    profile = subprocess.check_output(["node", "--input-type=module", "-e",
        "import {presetProfile} from './src/presets.mjs'; console.log(JSON.stringify(presetProfile()));"], cwd=EXTENSION)
    document(OUT / "examples/reviewer-profile.json", json.loads(profile))
    original = tree(EXTENSION / "node_modules/motion-input-grid/runtime")
    deployed = tree(DIST / "chromium/mig")
    changed = [p for p in original if original[p] != deployed.get(p)]
    if changed != ["mig.mjs"] or original["mig.wasm"] != deployed["mig.wasm"]:
        raise ValueError("Unexpected published-runtime changes")
    document(OUT / "runtime-provenance.json", {
        "runtime_package": "motion-input-grid@1.1.0", "source_release": TAG,
        "source_commit": UPSTREAM_COMMIT, "emscripten": "4.0.15", "mediapipe": "0.10.35",
        "changed_runtime_files": changed, "native_wasm_rebuilt_bit_for_bit": False,
        "original_npm_runtime_sha256": original, "deployed_runtime_sha256": deployed,
        "npm_package_integrity": json.loads((EXTENSION / "package-lock.json").read_text())["packages"]["node_modules/motion-input-grid"]["integrity"]
    })
    source_hashes = assemble_sources(OUT / "firefox" / f"mig-controller-sources-{VERSION}.zip")
    # Guard against accidental inclusion of the previous task's local reports.
    if any(Path(p).name in {"CODEBASE_REVIEW.md", "CODE_QUALITY_AUDIT.md", "NEXT.md"} for p in source_hashes):
        raise ValueError("Private task document included in source bundle")
    validation = {"installable_archive_matches_build": {s: True for s in hashes},
                  "opera_identical_to_chrome": (OUT / "chrome" / f"mig-controller-chrome-{VERSION}.zip").read_bytes() == (OUT / "opera" / f"mig-controller-opera-{VERSION}.zip").read_bytes(),
                  "source_inputs_count": len(source_hashes), "screenshots_generated": False,
                  "privacy_deployed": False, "signed": False, "submitted": False,
                  "remaining_owner_actions": ["real screenshots", "publish/verify privacy URL",
                      "developer accounts and dashboard declarations", "manual release validation", "upload/review"]}
    if not validation["opera_identical_to_chrome"]:
        raise ValueError("Opera package must match tested Chromium variant")
    document(OUT / "VALIDATION.json", validation)
    files = [p for p in OUT.rglob("*") if p.is_file() and p.name != "SHA256SUMS"]
    (OUT / "SHA256SUMS").write_text("".join(f"{digest(p.read_bytes())}  {p.relative_to(OUT).as_posix()}\n" for p in sorted(files)), encoding="utf-8")
    print(f"Prepared {OUT}")
    print(f"Verified 3 installable ZIPs, source archive ({len(source_hashes)} source inputs), icons, locale limits, licenses and hashes.")
    print("Not signed/submitted/deployed. Screenshots and owner dashboard actions remain.")


if __name__ == "__main__":
    main()
