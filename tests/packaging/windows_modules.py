"""Observe DLLs actually loaded by the launcher's Controller child (Windows only)."""
import ctypes
import hashlib
from ctypes import wintypes as w
from pathlib import Path
import time


class ProcessEntry(ctypes.Structure):
    _fields_ = [("size", w.DWORD), ("usage", w.DWORD), ("pid", w.DWORD),
                ("heap", ctypes.c_size_t), ("module", w.DWORD), ("threads", w.DWORD),
                ("parent", w.DWORD), ("priority", w.LONG), ("flags", w.DWORD), ("name", w.WCHAR*260)]


class ModuleEntry(ctypes.Structure):
    _fields_ = [("size", w.DWORD), ("id", w.DWORD), ("pid", w.DWORD),
                ("global_usage", w.DWORD), ("process_usage", w.DWORD), ("base", ctypes.c_void_p),
                ("base_size", w.DWORD), ("handle", w.HMODULE), ("name", w.WCHAR*256), ("path", w.WCHAR*260)]


def observe(process, cache, system, timeout=45):
    kernel = ctypes.WinDLL("kernel32", use_last_error=True)
    kernel.CreateToolhelp32Snapshot.argtypes = [w.DWORD, w.DWORD]
    kernel.CreateToolhelp32Snapshot.restype = w.HANDLE
    kernel.CloseHandle.argtypes = [w.HANDLE]
    for name, entry in [("Process32FirstW", ProcessEntry), ("Process32NextW", ProcessEntry),
                        ("Module32FirstW", ModuleEntry), ("Module32NextW", ModuleEntry)]:
        getattr(kernel, name).argtypes = [w.HANDLE, ctypes.POINTER(entry)]
        getattr(kernel, name).restype = w.BOOL
    def entries(flags, pid, entry_type, prefix):
        snapshot = kernel.CreateToolhelp32Snapshot(flags, pid)
        if snapshot == ctypes.c_void_p(-1).value:
            return  # Process exit and loader updates can race with a snapshot.
        try:
            entry = entry_type(); entry.size = ctypes.sizeof(entry_type)
            available = getattr(kernel, prefix+"FirstW")(snapshot, ctypes.byref(entry))
            while available:
                yield entry
                available = getattr(kernel, prefix+"NextW")(snapshot, ctypes.byref(entry))
        finally:
            kernel.CloseHandle(snapshot)
    observed = {}
    deadline = time.monotonic()+timeout
    while process.poll() is None:
        if time.monotonic() >= deadline:
            process.kill(); process.wait()
            raise TimeoutError("Controller diagnostics timed out")
        children = [p.pid for p in entries(2, 0, ProcessEntry, "Process32")
                    if p.parent == process.pid and p.name.lower() == "motion-input-grid-controller.exe"]
        for pid in children:
            # Parent IDs can outlive parents and PIDs can be reused between
            # snapshots. Confirm the exact child image before auditing modules.
            modules = [(m.name.lower(), Path(m.path)) for m in entries(8 | 16, pid, ModuleEntry, "Module32")]
            if not any(path == cache / "motion-input-grid-controller.exe" for _, path in modules):
                continue
            for name, path in modules:
                if path.is_relative_to(cache):
                    source, relative = "validated-cache", path.relative_to(cache)
                elif path.is_relative_to(system):
                    source, relative = "windows", path.relative_to(system)
                else:
                    raise AssertionError(f"Non-bundled/non-Windows DLL loaded: {path}")
                if name not in observed:
                    observed[name] = {"source": source, "path": relative.as_posix(),
                        "sha256": hashlib.sha256(path.read_bytes()).hexdigest()}
        time.sleep(.01)
    if process.returncode:
        raise RuntimeError(f"Controller diagnostics exited with {process.returncode}")
    return observed
