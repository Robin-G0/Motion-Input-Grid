"""Select CI jobs from the complete Git diff, without API file-count limits."""
import json
import os
from pathlib import Path
import subprocess


JOBS = ("windows", "linux", "portable", "web", "format", "metadata", "site", "docs")
SOURCE = {"windows", "linux", "portable", "web"}
NATIVE = {"windows", "linux"}


def classify(paths):
    selected = set()
    for path in paths:
        if path.startswith("site/") or path == ".github/workflows/pages.yml":
            selected.add("site")
            continue  # The site uses its own locked npm runtime, not the source SDK.
        if path.rsplit("/", 1)[-1] in {"VERSION", "package.json", "pyproject.toml", "vcpkg.json"}:
            selected.add("metadata")
        if path.endswith((".cpp", ".hpp", ".h")) or path == ".clang-format":
            selected.add("format")
        if path == ".clang-format":
            continue
        if path.endswith(".md") or path.startswith("docs/") or path in {
            "tools/dev/check-docs.py", "tests/tooling/docs_tests.py",
        }:
            selected.add("docs")
            continue
        if path in {".github/workflows/docs.yml"}:
            selected.add("docs")
        elif path in {".github/workflows/engine-integrations.yml",
                      ".github/workflows/release-check.yml", ".gitignore"}:
            continue  # Separate site, manual integration and release workflows.
        elif path.startswith(("src/apps/", "src/controller/", "tests/apps/")):
            # Native applications share these headers; portable app tests include them.
            selected.update(NATIVE | {"portable"})
        elif path.startswith("tests/ui/windows/"):
            selected.add("windows")
        elif path.startswith(("src/linux-apps/", "tests/ui/linux/")):
            selected.add("linux")
        elif path.startswith(("src/native/", "tests/native/", "bindings/python/",
                              "examples/pygame/", "examples/python-tkinter/", "tests/examples/")):
            selected.update(NATIVE)
        elif path.startswith(("src/web/", "bindings/javascript/", "tests/bindings/javascript/",
                              "examples/web/", "examples/react/", "examples/vue/", "examples/next/",
                              "tools/web/")) or path in {"package.json", "package-lock.json"}:
            selected.add("web")
        elif path.startswith("tools/packaging/controller-launcher/") or path in {
            "tools/packaging/package-controller.py", "tools/packaging/package-windows-release.ps1",
            "tools/packaging/package-distribution.ps1", "tools/packaging/prepare-windows-packages.ps1",
            "tools/lib/pe_dependencies.py", "tests/packaging/controller_package_tests.py",
            "tests/packaging/controller_runtime_tests.py", "tests/packaging/pe_dependency_tests.py",
            "tests/packaging/windows_icon.py", "tests/packaging/windows_modules.py",
        }:
            selected.update({"windows", "metadata"})
        elif path in {"tools/lib/package_linux.py", "tools/packaging/prepare-linux-packages.sh",
                      "tools/build/build-linux-release.sh"}:
            selected.update({"linux", "metadata"})
        elif path.startswith("assets/apps/"):
            selected.update(NATIVE)
        elif path.startswith(("tools/packaging/", "tools/lib/", "tests/packaging/")):
            selected.update(NATIVE | {"web", "metadata"})
        elif path.startswith("tools/release/") or path.startswith("tests/tooling/"):
            selected.add("metadata")
            if path == "tests/tooling/download_tests.ps1":
                selected.add("windows")
            if path == "tests/tooling/ci_changes_tests.py":
                selected.update(JOBS)
        elif path in {"tools/bootstrap/bootstrap-native.ps1", "tools/build/build-windows.ps1"}:
            selected.add("windows")
        elif path in {"tools/bootstrap/bootstrap-native-linux.py"}:
            selected.add("linux")
        elif path in {"tools/bootstrap/bootstrap-browser.mjs", "tools/bootstrap/bootstrap-node.mjs",
                      "tools/bootstrap/bootstrap-web.cmake", "tools/bootstrap/node-archive.mjs"}:
            selected.add("web")
        else:
            # Shared CMake, engine, configs and unknown/new code paths fail open.
            selected.update(SOURCE | {"metadata"})
            if path.startswith(".github/") or path == "tools/dev/ci-changes.py":
                selected.update(JOBS)
    return {job: job in selected for job in JOBS}


def git(*args, root):
    return subprocess.check_output(["git", *args], cwd=root, stderr=subprocess.PIPE)


def changed_paths(event_name, event, root):
    """None requests a full run when a trustworthy baseline is unavailable."""
    try:
        if event_name == "pull_request":
            head = event["pull_request"]["head"]["sha"]
            base = git("merge-base", event["pull_request"]["base"]["sha"], head, root=root).decode().strip()
        elif event_name == "push" and not event.get("deleted"):
            base, head = event["before"], event["after"]
            if not base or set(base) == {"0"}:
                return None
        else:
            return None
        # No rename detection: test both the deleted old path and the added new path.
        paths = git("diff", "--name-only", "--no-renames", "-z", base, head, "--", root=root)
        return paths.decode("utf-8", errors="surrogateescape").rstrip("\0").split("\0") if paths else []
    except (KeyError, OSError, subprocess.CalledProcessError):
        return None


def main():
    event = json.loads(Path(os.environ["GITHUB_EVENT_PATH"]).read_text(encoding="utf-8"))
    paths = changed_paths(os.environ["GITHUB_EVENT_NAME"], event, Path.cwd())
    results = dict.fromkeys(JOBS, True) if paths is None else classify(paths)
    with open(os.environ["GITHUB_OUTPUT"], "a", encoding="utf-8") as output:
        for job, enabled in results.items():
            output.write(f"{job}={str(enabled).lower()}\n")
    summary = "## Selected CI checks\n\n"
    summary += "Full validation (manual run, first push or unavailable comparison).\n\n" if paths is None else f"Compared {len(paths)} changed paths.\n\n"
    summary += "| Check | Run |\n| --- | --- |\n"
    summary += "".join(f"| {job} | {'yes' if enabled else 'skip'} |\n" for job, enabled in results.items())
    if os.environ.get("GITHUB_STEP_SUMMARY"):
        with open(os.environ["GITHUB_STEP_SUMMARY"], "a", encoding="utf-8") as output:
            output.write(summary)
    print(summary)


if __name__ == "__main__":
    main()
