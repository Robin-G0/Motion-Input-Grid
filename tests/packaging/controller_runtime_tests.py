"""Run real Controller diagnostics through a single-file downloaded artifact.

Usage: python controller_runtime_tests.py path/to/controller.exe-or.run
The source release must be built with MIG_BUILD_TESTS=ON.
"""
import os
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile


def snapshot(directory):
    return {str(path.relative_to(directory)): (path.stat().st_ino, path.stat().st_mtime_ns, path.stat().st_size)
            for path in directory.rglob("*") if path.is_file()}


def verify_cache(runtime):
    assert (runtime / ".complete").read_text() == runtime.name + "\n"
    manifest = json.loads((runtime / "controller-manifest.json").read_text())["files"]
    for name, digest in manifest.items():
        assert hashlib.sha256((runtime / name).read_bytes()).hexdigest() == digest, name
    assert (runtime / "licenses/MediaPipe-LICENSE").is_file()


def windows_cache_tests(portable, directory, environment, local_data):
    root = local_data / "MotionInputGrid/runtime"
    def launch():
        subprocess.run([str(portable), "--help"], cwd=directory, env=environment, check=True, timeout=90)
    def current():
        matches = [p for p in root.iterdir() if p.is_dir() and len(p.name) == 64 and all(c in "0123456789abcdef" for c in p.name)]
        assert len(matches) == 1, matches
        return matches[0]
    assert not root.exists()
    launch()
    runtime = current()
    verify_cache(runtime)
    original = snapshot(runtime)
    launch()
    assert snapshot(runtime) == original, "Second launch rewrote the runtime"
    print("PASS: first launch creates and second launch reuses the hash-addressed cache without rewrites", flush=True)

    # Preserve size, timestamps and the completion marker: only hashing detects
    # this corruption. Forging the cached manifest must not bypass the launcher.
    dll = runtime / "libmediapipe.dll"
    previous = dll.stat()
    data = bytearray(dll.read_bytes()); data[-1] ^= 1; dll.write_bytes(data)
    os.utime(dll, ns=(previous.st_atime_ns, previous.st_mtime_ns))
    manifest_path = runtime / "controller-manifest.json"
    manifest_stat = manifest_path.stat()
    manifest = json.loads(manifest_path.read_text())
    manifest["files"][dll.name] = hashlib.sha256(data).hexdigest()
    manifest_path.write_text(json.dumps(manifest, indent=2)+"\n")
    os.utime(manifest_path, ns=(manifest_stat.st_atime_ns, manifest_stat.st_mtime_ns))
    launch(); verify_cache(runtime)
    assert dll.stat().st_ino != original[dll.name][0], "Corrupted runtime was not replaced"
    print("PASS: corrupt DLL and forged cached manifest are rebuilt from embedded trusted hashes", flush=True)

    (runtime / ".complete").unlink()
    (runtime / "models/pose_landmarker_lite.task").unlink()
    # Simulate a launcher interrupted while preparing a different directory.
    abandoned = root / ".staging-interrupted-test"
    abandoned.mkdir(); (abandoned / "partial").write_text("incomplete")
    launch(); verify_cache(runtime)
    assert (abandoned / "partial").read_text() == "incomplete"
    print("PASS: incomplete runtime is rebuilt; abandoned staging is never accepted or deleted", flush=True)

    (runtime / "injected.dll").write_bytes(b"unexpected cached DLL")
    launch(); verify_cache(runtime)
    assert not (runtime / "injected.dll").exists()
    print("PASS: unexpected cached DLL is quarantined with the invalid runtime", flush=True)

    (runtime / ".complete").write_text("0"*64+"\n")
    launch(); verify_cache(runtime)
    print("PASS: a wrong completion marker is rejected even when all payload files are intact", flush=True)

    import _winapi
    outside = local_data / "junction target"
    outside.mkdir(); (outside / "sentinel").write_text("do not alter")
    (runtime / "models").rename(runtime / "models-original")
    _winapi.CreateJunction(str(outside), str(runtime / "models"))
    launch(); verify_cache(runtime)
    assert list(outside.iterdir()) == [outside / "sentinel"]
    assert (outside / "sentinel").read_text() == "do not alter"
    print("PASS: injected directory junction is rejected without following or deleting its target", flush=True)

    dll = runtime / "libmediapipe.dll"
    external_dll = local_data / "hardlink source.dll"
    shutil.copy2(dll, external_dll)
    expected_dll_hash = hashlib.sha256(external_dll.read_bytes()).hexdigest()
    dll.unlink(); os.link(external_dll, dll)
    launch(); verify_cache(runtime)
    assert dll.stat().st_nlink == 1
    assert hashlib.sha256(external_dll.read_bytes()).hexdigest() == expected_dll_hash
    print("PASS: hard-linked cached DLL is rejected without changing its external source", flush=True)

    # Relocate the complete tree inside this isolated test root, then race two
    # first launches against an empty target to exercise atomic publication.
    runtime.rename(root / ".saved-runtime-concurrency-test")
    processes = [subprocess.Popen([str(portable), "--help"], cwd=directory, env=environment) for _ in range(2)]
    for process in processes:
        try:
            assert process.wait(timeout=90) == 0
        finally:
            if process.poll() is None: process.kill(); process.wait()
    verify_cache(current())
    print("PASS: concurrent first launches produce one complete verified runtime", flush=True)
    return current()


def main():
    source = Path(sys.argv[1]).resolve()
    windows = source.suffix.lower() == ".exe"
    if windows:
        from windows_icon import verify_icon
        verify_icon(source)
    checks = ["--help", "--ui-test", "--infer-test", "--hands-test"] if windows else ["--ui-test"]
    environment = dict(os.environ, QT_QPA_PLATFORM="offscreen")
    with tempfile.TemporaryDirectory(prefix="MIG isolated portable check ") as temporary:
        directory = Path(temporary) / "download only"
        directory.mkdir()
        if windows:
            local_data = Path(temporary) / "local application data"
            local_data.mkdir()
            environment["LOCALAPPDATA"] = str(local_data)
            # Deliberately exclude Visual Studio, Python and other development
            # directories from the child process DLL search environment.
            system = Path(os.environ["SystemRoot"])
            environment["PATH"] = str(system / "System32") + os.pathsep + str(system)
        portable = directory / ("Controller.exe" if windows else "Controller.run")
        shutil.copy2(source, portable)
        if windows:
            cached_runtime = windows_cache_tests(portable, directory, environment, local_data)
        observed = {}
        for check in checks:
            command = [str(portable), check] if windows else ["sh", str(portable), check]
            if windows:
                from windows_modules import observe
                process = subprocess.Popen(command, cwd=directory, env=environment)
                try:
                    observed.update(observe(process, cached_runtime, system))
                finally:
                    if process.poll() is None: process.kill(); process.wait()
            else:
                subprocess.run(command, cwd=directory, env=environment, check=True, timeout=45)
            print(f"PASS: {check}", flush=True)
        if windows:
            assert "libmediapipe.dll" in observed, "Native MediaPipe loading was not observed"
            output = source.with_name(source.name + ".observed-modules.json")
            output.write_text(json.dumps(dict(sorted(observed.items())), indent=2)+"\n")
            print(f"PASS: {len(observed)} loaded modules resolve only to the verified cache or Windows", flush=True)
        remaining = list(directory.iterdir())
        if remaining != [portable]:
            raise AssertionError(f"Unexpected files beside the downloaded Controller: {remaining}")
    print("PASS: Controller runs from a folder containing only its downloaded file")


if __name__ == "__main__":
    main()
