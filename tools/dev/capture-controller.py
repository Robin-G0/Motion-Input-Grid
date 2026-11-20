"""Capture actual diagnostic-build Controller windows with an isolated profile library.

Usage: python tools/dev/capture-controller.py build/onboarding-native/bin/motion-input-grid-controller.exe ../website/site/studio/controller/images
This opens real windows, imports configs/studio-hi.json through the actual review,
then enables keyboard consent without starting camera capture or emitting keys.
"""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "tests/packaging"))
from windows_gui import user, windows, wait_for, click, close, screenshot, text


def main():
    executable = Path(sys.argv[1]).resolve()
    output = Path(sys.argv[2]).resolve(); output.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="MIG actual UI capture ") as temporary:
        environment = dict(os.environ, MIG_TEST_PROFILE_DIRECTORY=str(Path(temporary) / "profiles"))
        def launch(arguments):
            return subprocess.Popen([str(executable), *arguments], env=environment, cwd=ROOT)
        process = launch([])
        try:
            main = wait_for(lambda: windows("MIGNativeWindow", pid=process.pid))[0]
            wait_for(lambda: user.GetDlgItem(main, 104))  # Import profile
            screenshot(main, output / "open.png")
            close(main); assert process.wait(timeout=10) == 0
        finally:
            if process.poll() is None: process.kill(); process.wait()
        process = launch(["--config", str(ROOT / "configs/studio-hi.json")])
        try:
            review = wait_for(lambda: windows("MIGImportReview", pid=process.pid))[0]
            screenshot(review, output / "import.png")
            click(review, 1)
            main = wait_for(lambda: windows("MIGNativeWindow", pid=process.pid))[0]
            wait_for(lambda: not windows("MIGImportReview", pid=process.pid))
            click(main, 116)  # Keys
            wait_for(lambda: text(user.GetDlgItem(main, 116)) == "Keyboard: On")
            screenshot(main, output / "activate.png")
            close(main); assert process.wait(timeout=10) == 0
        finally:
            if process.poll() is None: process.kill(); process.wait()
    metadata = {"application": "Motion Input Grid Controller", "version": (ROOT / "VERSION").read_text().strip(),
        "executable_sha256": hashlib.sha256(executable.read_bytes()).hexdigest(),
        "method": "Win32 PrintWindow capture of real application windows; no image compositing",
        "states": {"open.png": "Empty profile library; keyboard off", "import.png": "Actual HI profile import review",
                   "activate.png": "HI profile imported; keyboard consent on; capture not started"},
        "profile": "configs/studio-hi.json", "platform": "Windows x64",
        "regenerate": "python tools/dev/capture-controller.py <diagnostic Controller.exe> <website image directory>"}
    (output / "capture.json").write_text(json.dumps(metadata, indent=2)+"\n")


if __name__ == "__main__":
    main()
