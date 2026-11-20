"""Generate a download catalogue from the validated release inventory."""
import argparse
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "lib"))
from release_metadata import REPOSITORY, ROOT


def generate(directory, output):
    manifest = json.loads((directory / "release-manifest.json").read_text())
    version, tag = manifest["version"], manifest["tag"]
    entries = manifest["artifacts"]
    if not re.fullmatch(r"\d+\.\d+\.\d+", version) or tag != f"v{version}":
        raise ValueError("Release catalogue requires matching version and vX.Y.Z tag")
    changelog = (ROOT / "docs/development/CHANGELOG.md").read_text(encoding="utf-8")
    notes = re.search(rf"^## {re.escape(version)}(?:[^\n]*)\n(.*?)(?=^## |\Z)", changelog, re.M | re.S)
    if not notes or not notes[1].strip():
        raise ValueError(f"Missing changelog entry for {version}")
    used = set()
    lines = [f"# Motion Input Grid {tag}", "",
             f'# [<img src="https://raw.githubusercontent.com/Robin-G0/Motion-Input-Grid/{tag}/site/favicon.svg" '
             'width="32" height="32" alt=""> Explore the presentation website]'
             '(https://robin-g0.github.io/Motion-Input-Grid/)', "",
             "Start here for a quick introduction and an interactive demo. "
             "[Open the browser Studio](https://robin-g0.github.io/Motion-Input-Grid/studio/) "
             "to create or import a configuration without installing anything.", "",
             "## What's new", "",
             notes[1].strip(), "",
             "## Downloads", "",
             "Choose one download for your platform. Every link below points directly to an attached release file.", "",
             "| I want to… | Go to |", "| --- | --- |",
             "| Use gestures on my computer | [Desktop applications](#desktop-applications) |",
             "| Control a browser presentation | [Browser extensions](#browser-extensions) |",
             "| Integrate MIG in a project | [SDKs and language packages](#sdks-and-language-packages) |",
             "| Try a ready-to-run tutorial | [Native examples](#native-examples) · [Browser examples](#browser-examples) |",
             "| Integrate a game engine | [Game engines](#game-engines) |",
             "| Build from source or verify a download | [Source and integrity files](#source-and-integrity-files) |", ""]

    def section(title, description="", level=3, anchor=None):
        if anchor:
            lines.extend([f'<a name="{anchor}"></a>', ""])
        lines.extend(["#" * level + " " + title, ""])
        if description:
            lines.extend([description, ""])

    def table(pattern, label=None):
        matches = [entry for entry in entries if re.search(pattern, entry["name"])]
        if not matches:
            raise ValueError(f"Missing release downloads: {pattern}")
        matches.sort(key=lambda entry: next((priority for markers, priority in (
            (("windows-x64", "win_amd64"), 0), (("linux-x64", "x86_64", "_amd64.deb"), 1),
            (("linux-arm64", "aarch64", "_arm64.deb"), 2))
            if any(marker in entry["name"] for marker in markers)), 3))
        lines.extend(["| Platform / package | Download | Size |", "| --- | --- | --- |"])
        for entry in matches:
            name = entry["name"]
            if name in used:
                raise ValueError(f"Duplicate catalogue entry: {name}")
            used.add(name)
            platform = next((value for marker, value in (
                ("windows-x64", "Windows x64"), ("win_amd64", "Windows x64"),
                ("linux-arm64", "Linux ARM64"), ("aarch64", "Linux ARM64"), ("_arm64.deb", "Linux ARM64"),
                ("linux-x64", "Linux x64"), ("x86_64", "Linux x64"), ("_amd64.deb", "Linux x64"))
                if marker in name), label or "All platforms")
            extension = next(ext for ext in ("tar.gz", "whl", "tgz", "zip", "deb", "exe", "run", "json") if name.endswith(ext))
            url = f"{REPOSITORY}/releases/download/{tag}/{name}"
            size = (f"{entry['bytes'] / 1048576:.1f} MiB" if entry['bytes'] >= 1048576
                    else f"{entry['bytes'] / 1024:.1f} KiB")
            lines.append(f"| {platform} | [Download {extension.upper()}]({url}) | {size} |")
        lines.append("")

    section("Desktop applications", level=2)
    section("Standalone Controller", "Create a profile in [web Studio](https://robin-g0.github.io/Motion-Input-Grid/studio/), "
            "export it, then import it into Controller. Includes the recognition runtime, models, dependencies and licenses.")
    table(r"-controller-(?:windows-x64\.exe|linux-x64\.run)$")
    lines.extend(["Windows: run the EXE. Its verified runtime is cached under "
                  "`%LOCALAPPDATA%\\MotionInputGrid\\runtime\\<payload-hash>\\`. "
                  "The first-install dialog explains extraction and allows cancellation or copying the cache path.", "",
                  f"Linux: allow execution or run `sh motion-input-grid-{version}-controller-linux-x64.run`. "
                  "Requires glibc 2.35+, camera access and an X11 session for keyboard output; Wayland is unsupported.", "",
                  "Test tracking with keyboard output off, then enable output and focus your target application. "
                  "[Controller walkthrough](https://robin-g0.github.io/Motion-Input-Grid/studio/controller/?lang=en).", ""])
    section("Complete desktop bundle", "Includes **Motion Input Grid Studio** and **Motion Input Grid Controller**, "
            "the camera runtime, models and example configurations.")
    table(r"-native\.(zip|tar\.gz)$")
    lines.extend(["Extract the complete archive. Create a configuration in the browser Studio or desktop Studio, "
                  "export its JSON file, then open it in Controller to map gestures to keyboard actions.", "",
                  "- Windows: run `windows/motion-input-grid-studio.exe` or `windows/motion-input-grid-controller.exe`. "
                  "If a required Microsoft runtime is missing, install the "
                  "[Visual C++ x64 runtime](https://aka.ms/vc14/vc_redist.x64.exe).",
                  "- Linux: run `./motion-input-grid-studio` or `./motion-input-grid-controller`. "
                  "Desktop packages target Ubuntu 22.04 or newer, x64.", "",
                  "> [!WARNING]\n> This project is in early development. Windows SmartScreen may not recognize "
                  "a new executable. Check that the download comes from this repository and verify its checksum "
                  "before choosing **More info → Run anyway**.", "",
                  "Be careful when using Controller in competitive games: it produces system input, and an "
                  "anti-cheat may treat unfamiliar input software as suspicious. Check the game's rules first.", ""])
    section("Browser extensions", "Experimental, unsigned MIG Controller packages for browser presentations. "
            "Choose the package for your browser and follow the "
            f"[installation guide]({REPOSITORY}/blob/{tag}/extensions/controller/README.md). "
            "Store publication is separate from these development packages.", 2)
    table(r"-browser-extension-chromium\.zip$", "Chromium / Chrome / Opera / Edge")
    table(r"-browser-extension-firefox\.zip$", "Firefox")
    section("SDKs and language packages", level=2)
    section("Python wheel", "Normally install with `python -m pip install motion-input-grid`. "
            "PyPI publication is separate from this GitHub release; to install this exact version before "
            "it appears on PyPI, download your wheel below and run `python -m pip install <wheel-file>`.")
    table(r"\.whl$")
    lines.extend(["Wheels contain the recognition library for supplied landmarks. Camera acquisition and pose "
                  "inference belong to your application or the separate desktop runtime.", ""])
    section("npm package", "Normally install with `npm install motion-input-grid`, then run "
            "`npx mig-copy-assets public/mig`. npm publication is separate; to use this exact version before "
            "it appears on npm, download the TGZ below and run `npm install ./<package-file>.tgz`.")
    table(rf"^motion-input-grid-{re.escape(version)}\.tgz$", "JavaScript / TypeScript")
    section("C++ SDK", "Recognition SDK for applications that supply landmarks. "
            "Pass its extracted directory to `-DCMAKE_PREFIX_PATH` and link `MIG::core` / `MIG::format`.", anchor="cpp-sdk")
    table(r"-sdk\.(zip|tar\.gz)$")
    section("Debian / Ubuntu SDK", "Development libraries for Debian/Ubuntu; these packages do not contain the desktop applications.",
            anchor="debian-ubuntu-sdk")
    table(r"\.deb$")
    section("vcpkg overlay", "Extract the overlay and run "
            "`vcpkg install motion-input-grid --overlay-ports=/path/to/overlay`. "
            "It downloads this release's source archive and checks its SHA512.")
    table(r"-vcpkg-overlay\.tar\.gz$")
    section("Native examples", "Each archive is one independent tutorial, with its own README, "
            "launchers and runtime. Python viewers include an interpreter; no pip install is needed.", 2)
    for technology, title in (("python-tkinter", "Python Tkinter"), ("pygame", "Pygame"),
                              ("sdl2", "SDL2"), ("sfml", "SFML"), ("sdk-consumer", "SDK consumer"),
                              ("native-consumer", "Native consumer")):
        section(title + " examples")
        table(rf"-{technology}-standalone\.(zip|tar\.gz)$")
    section("Browser examples", "Prebuilt pages, WebAssembly, MediaPipe and models are included. "
            "Install Node 22.12 or newer, extract, run `run.cmd` or `sh run.sh`, "
            "and open the URL printed in the terminal. No npm install or build is required.", 2)
    for technology, title in (("web", "Web"), ("react", "React"), ("vue", "Vue"), ("next", "Next")):
        section(("Next.js" if technology == "next" else title) + " examples", anchor=technology + "-examples")
        table(rf"-browser-{technology}-standalone\.tar\.gz$", "Browser / all platforms")
    section("Game engines", "Packages include recognition bridges and example landmarks. "
            "Install the corresponding editor separately and provide your own tracking data for a camera integration. "
            "These downloads do not bundle a game editor or the desktop camera runtime.", 2)
    for technology, title in (("godot-gdscript", "Godot GDScript"), ("godot-csharp", "Godot C#"),
                              ("unity", "Unity"), ("unreal", "Unreal")):
        section(title + " examples", "Godot projects target Godot 4.3; the C# project also needs .NET 8."
                if technology.startswith("godot") else "Open the extracted project/plugin and follow its README.",
                anchor=technology + "-examples")
        table(rf"-{technology}-standalone\.zip$")
    for technology, title in (("godot", "Godot"), ("unity", "Unity"), ("unreal", "Unreal")):
        section(title + " integration", "Choose this to add the bridge to an existing project.")
        table(rf"-{technology}\.(zip|tgz)$")
    section("Source and integrity files", level=2)
    section("Source archive", "C++ engine sources and CMake files. The full application, website, "
            "documentation and examples remain in the [repository tree](" + REPOSITORY + "/tree/" + tag + ").")
    table(r"-source\.tar\.gz$", "C++ sources")
    section("Python source distribution", "For building the Python package yourself; prefer a wheel for installation.")
    table(rf"^motion_input_grid-{re.escape(version)}\.tar\.gz$", "Python sources")
    section("Windows runtime inventory", "DLL dependency inventory for the standalone Windows Controller.")
    table(r"-controller-windows-x64\.exe\.dependencies\.json$", "Windows x64")
    lines.extend([f"[SHA256SUMS]({REPOSITORY}/releases/download/{tag}/SHA256SUMS) · "
                  f"[release-manifest.json]({REPOSITORY}/releases/download/{tag}/release-manifest.json)", "",
                  "Check downloads with `sha256sum -c SHA256SUMS` on Linux, or "
                  "`Get-FileHash <download> -Algorithm SHA256` in PowerShell. "
                  "The inventory records each package's version, size and SHA256.", ""])
    missing = {entry["name"] for entry in entries} - used
    if missing:
        raise ValueError(f"Unlisted release files: {sorted(missing)}")
    content = "\n".join(lines)
    # Release headings have no automatic HTML anchors on GitHub. Keep legacy
    # aliases for guides inside existing archives and use versioned anchors for
    # repository documentation and navigation across the releases list.
    prefix = "mig-" + tag.replace(".", "-") + "-"
    aliases = {"C++ SDK": "cpp-sdk", "Debian / Ubuntu SDK": "debian-ubuntu-sdk",
               "Next.js examples": "next-examples", "Godot C# examples": "godot-csharp-examples"}
    content = re.sub(r'<a name="[\w-]+"></a>\n\n', '', content)
    def explicit_heading(match):
        title = match.group(2)
        slug = aliases.get(title, re.sub(r"[^\w -]", "", title.lower()).replace(" ", "-"))
        return f'<a name="{slug}"></a>\n<a name="{prefix}{slug}"></a>\n\n{match.group(0)}'
    content = re.sub(r'^(#{2,6}) (.+)$', explicit_heading, content, flags=re.M)
    content = re.sub(r'\]\(#([\w-]+)\)',
                     lambda m: f']({REPOSITORY}/releases/tag/{tag}#user-content-{prefix}{m.group(1)})', content)
    anchors = set(re.findall(r'<a name="([\w-]+)">', content))
    for folder in (ROOT / "docs", ROOT / "examples", ROOT / "integrations", ROOT / "bindings", ROOT / "ports"):
        for path in folder.rglob("*.md"):
            for anchor in re.findall(rf"releases/tag/{re.escape(tag)}#user-content-([\w-]+)", path.read_text(encoding="utf-8")):
                if anchor not in anchors:
                    raise ValueError(f"Release section missing for {path}: {anchor}")
    for anchor in re.findall(rf"releases/tag/{re.escape(tag)}#user-content-([\w-]+)", (ROOT / "readme.md").read_text(encoding="utf-8")):
        if anchor not in anchors:
            raise ValueError(f"README release section missing: {anchor}")
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(content, encoding="utf-8")
    print(f"Wrote {output}: {len(entries)} downloads, documentation anchors verified")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("directory", type=Path, help="Validated candidate artifact directory")
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    generate(args.directory, args.output)
