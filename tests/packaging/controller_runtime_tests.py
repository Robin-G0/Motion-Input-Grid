"""Run real Controller diagnostics through a single-file downloaded artifact.

Usage: python controller_runtime_tests.py path/to/controller.exe-or.run
The source release must be built with MIG_BUILD_TESTS=ON.
"""
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile


def main():
    source = Path(sys.argv[1]).resolve()
    windows = source.suffix.lower() == ".exe"
    checks = ["--help", "--ui-test", "--infer-test", "--hands-test"] if windows else ["--ui-test"]
    environment = dict(os.environ, QT_QPA_PLATFORM="offscreen")
    with tempfile.TemporaryDirectory(prefix="MIG isolated portable check ") as temporary:
        directory = Path(temporary)
        portable = directory / ("Controller.exe" if windows else "Controller.run")
        shutil.copy2(source, portable)
        for check in checks:
            command = [str(portable), check] if windows else ["sh", str(portable), check]
            subprocess.run(command, cwd=directory, env=environment, check=True, timeout=45)
            print(f"PASS: {check}", flush=True)
        remaining = list(directory.iterdir())
        if remaining != [portable]:
            raise AssertionError(f"Unexpected files beside the downloaded Controller: {remaining}")
    print("PASS: Controller runs from a folder containing only its downloaded file")


if __name__ == "__main__":
    main()
