"""Stage verified build outputs on a draft release without Actions artifact storage."""
import argparse
import json
import os
from pathlib import Path
import re
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "tools/lib"))
from release_metadata import release_version


def gh(*arguments):
    return subprocess.check_output(["gh", *arguments], cwd=ROOT, text=True)


def draft(tag):
    data = json.loads(gh("release", "view", tag, "--json", "tagName,isDraft,targetCommitish,url"))
    if not data["isDraft"] or data["tagName"] != tag:
        raise ValueError("Build outputs may only be uploaded to this version's draft release")
    commit = subprocess.check_output(["git", "-c", f"safe.directory={ROOT.as_posix()}", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip()
    if data["targetCommitish"] != commit:
        raise ValueError("Draft target does not match the checked-out release commit")
    return data


def create(tag):
    commit = subprocess.check_output(["git", "-c", f"safe.directory={ROOT.as_posix()}", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip()
    result = subprocess.run(["gh", "release", "view", tag, "--json", "isDraft"], cwd=ROOT,
                            capture_output=True, text=True)
    if result.returncode:
        # Creation is guarded by --verify-tag; an existing release/auth failure
        # makes gh fail rather than overwriting or publishing anything.
        gh("release", "create", tag, "--draft", "--verify-tag", "--target", commit,
           "--title", f"Motion Input Grid {tag[1:]}", "--notes",
           "Release builds and package validation are in progress. Not published yet.")
    return draft(tag)


def upload(tag, directory, final):
    draft(tag)
    version = release_version(tag)
    directory = directory.resolve()  # gh runs from ROOT, callers may run in a subdirectory.
    selected = []
    for path in sorted(directory.iterdir()):
        if not path.is_file():
            continue
        if path.name in {"SHA256SUMS", "release-manifest.json"}:
            if final:
                selected.append(path)
            continue
        if path.name.endswith(".observed-modules.json"):
            continue  # Test diagnostics are not release downloads.
        if path.name.endswith(".sha256") and not re.search(r"-controller-(?:windows-x64\.exe|linux-x64\.run)\.sha256$", path.name):
            continue  # Keep existing Controller links; SHA256SUMS covers all files.
        if re.search(r"-(?:javascript|windows-x64|linux-x64)-examples\.(?:tar\.gz|zip)(?:\.sha256)?$", path.name):
            continue  # Independent examples are the published downloads.
        if not re.search(rf"(?<![0-9]){re.escape(version)}(?![0-9]|\.[0-9])", path.name):
            raise ValueError(f"Stale/unversioned release output: {path.name}")
        if not path.name.startswith(("motion-input-grid-", "motion-input-grid_", "motion_input_grid-")):
            raise ValueError(f"Unexpected release output: {path.name}")
        selected.append(path)
    if not selected:
        raise ValueError("No release outputs to stage")
    gh("release", "upload", tag, *map(str, selected), "--clobber")
    print(f"Staged {len(selected)} files on draft {tag}; no Actions artifact upload.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--tag", default=os.environ.get("RELEASE_TAG"))
    parser.add_argument("--create", action="store_true")
    parser.add_argument("--final", action="store_true")
    parser.add_argument("directory", type=Path, nargs="?")
    args = parser.parse_args()
    if not args.tag or not re.fullmatch(r"v\d+\.\d+\.\d+", args.tag):
        parser.error("an explicit vX.Y.Z release tag is required")
    release_version(args.tag)
    if args.create:
        create(args.tag)
    elif args.directory:
        upload(args.tag, args.directory, args.final)
    else:
        parser.error("provide --create or an output directory")
