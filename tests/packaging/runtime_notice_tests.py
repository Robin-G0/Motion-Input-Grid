"""Exercise real first-install UI through the single downloaded executable."""
import ctypes as c
from ctypes import wintypes as w
import os
from pathlib import Path
import subprocess
import tempfile
from windows_gui import user, kernel, windows, wait_for, click, close, text


def check_notice(portable, environment, directory, expect_notice, runtime=None, cancel=False):
    process = subprocess.Popen([str(portable)], env=environment, cwd=directory)
    try:
        if expect_notice:
            notice = wait_for(lambda: windows("MIGRuntimeNotice", pid=process.pid))[0]
            field = user.GetDlgItem(notice, 100)
            actual = Path(text(field))
            assert actual.parent == Path(environment["LOCALAPPDATA"]) / "MotionInputGrid/runtime"
            assert len(actual.name) == 64
            assert user.GetWindowLongW(field, -16) & 0x800, "Path must be read-only"
            assert not actual.exists(), "Notice must precede extraction/publication"
            user.OpenClipboard.argtypes = [w.HWND]
            user.GetClipboardData.argtypes = [w.UINT]; user.GetClipboardData.restype = w.HANDLE
            kernel.GlobalLock.argtypes = [w.HANDLE]; kernel.GlobalLock.restype = c.c_void_p
            kernel.GlobalUnlock.argtypes = [w.HANDLE]
            user.SendMessageW(notice, 0x111, 101, 0)
            def copied():
                if not user.OpenClipboard(None): return False
                try:
                    memory = user.GetClipboardData(13)
                    if not memory: return False
                    pointer = kernel.GlobalLock(memory)
                    if not pointer: return False
                    try: return c.wstring_at(pointer) == str(actual)
                    finally: kernel.GlobalUnlock(memory)
                finally: user.CloseClipboard()
            wait_for(copied)
            if cancel:
                close(notice); assert process.wait(timeout=10) == 0
                assert not actual.exists()
                return actual
            click(notice, 1)
            runtime = actual
        main = wait_for(lambda: windows("MIGNativeWindow", image=runtime / "motion-input-grid-controller.exe"))[0]
        assert not windows("MIGRuntimeNotice", pid=process.pid)
        close(main)
        assert process.wait(timeout=15) == 0
        return runtime
    finally:
        if process.poll() is None:
            # Stop only descendants of our own isolated launcher on a failed assertion.
            subprocess.run(["taskkill", "/PID", str(process.pid), "/T", "/F"], capture_output=True)
            process.wait(timeout=10)


def run(portable):
    with tempfile.TemporaryDirectory(prefix="MIG runtime notice ") as directory:
        root = Path(directory); local = root / "local"; local.mkdir()
        environment = dict(os.environ, LOCALAPPDATA=str(local), MIG_TEST_PROFILE_DIRECTORY=str(root / "profiles"))
        runtime = check_notice(portable, environment, root, True, cancel=True)
        runtime = check_notice(portable, environment, root, True)
        from controller_runtime_tests import snapshot, verify_cache
        verify_cache(runtime); before = snapshot(runtime)
        check_notice(portable, environment, root, False, runtime)
        assert snapshot(runtime) == before, "Reuse must not rewrite any runtime files"
        (runtime / ".complete").unlink()
        # Invalid directories still exist until quarantined. Move this incomplete
        # tree aside only after observing the notice, unlike a fresh install.
        # check_notice expects absence before installation, so assert separately.
        process = subprocess.Popen([str(portable)], env=environment, cwd=root)
        try:
            notice = wait_for(lambda: windows("MIGRuntimeNotice", pid=process.pid))[0]
            assert Path(text(user.GetDlgItem(notice, 100))) == runtime
            click(notice, 1)
            main = wait_for(lambda: windows("MIGNativeWindow", image=runtime / "motion-input-grid-controller.exe"))[0]
            close(main); assert process.wait(timeout=15) == 0; verify_cache(runtime)
        finally:
            if process.poll() is None:
                subprocess.run(["taskkill", "/PID", str(process.pid), "/T", "/F"], capture_output=True)
                process.wait(timeout=10)
        print("PASS: real runtime notice, copy path, cancel, first install, silent reuse and recreation")


if __name__ == "__main__":
    import sys
    run(Path(sys.argv[1]).resolve())
