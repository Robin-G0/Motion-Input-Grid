"""Check the actual downloaded launcher icon, not its extracted child process."""
import ctypes as c
from ctypes import wintypes as w
from pathlib import Path
import struct


def verify_icon(executable):
    kernel = c.WinDLL("kernel32", use_last_error=True)
    kernel.LoadLibraryExW.argtypes = [w.LPCWSTR, w.HANDLE, w.DWORD]
    kernel.LoadLibraryExW.restype = w.HMODULE
    kernel.FindResourceW.argtypes = [w.HMODULE, c.c_void_p, c.c_void_p]
    kernel.FindResourceW.restype = w.HRSRC
    kernel.LoadResource.argtypes = [w.HMODULE, w.HRSRC]
    kernel.LoadResource.restype = w.HGLOBAL
    kernel.SizeofResource.argtypes = [w.HMODULE, w.HRSRC]
    kernel.SizeofResource.restype = w.DWORD
    kernel.LockResource.argtypes = [w.HGLOBAL]
    kernel.LockResource.restype = c.c_void_p
    kernel.FreeLibrary.argtypes = [w.HMODULE]
    module = kernel.LoadLibraryExW(str(executable), None, 0x2 | 0x20)
    assert module, "Cannot inspect the launcher resources"
    try:
        def resource(kind, name):
            found = kernel.FindResourceW(module, name, kind)
            assert found, f"Missing launcher resource {kind}/{name}"
            size = kernel.SizeofResource(module, found)
            loaded = kernel.LoadResource(module, found)
            pointer = kernel.LockResource(loaded)
            assert pointer and size
            return c.string_at(pointer, size)
        expected = (Path(__file__).resolve().parents[2] / "assets/apps/motion-input-grid-controller.ico").read_bytes()
        group = resource(14, 101)  # RT_GROUP_ICON, application icon
        assert group[:6] == expected[:6], "Launcher must include every Controller icon size"
        count = struct.unpack_from("<H", expected, 4)[0]
        for index in range(count):
            entry = 6 + index * 16
            compiled = 6 + index * 14
            assert group[compiled:compiled+12] == expected[entry:entry+12]
            size, offset = struct.unpack_from("<II", expected, entry+8)
            identifier = struct.unpack_from("<H", group, compiled+12)[0]
            assert resource(3, identifier) == expected[offset:offset+size], "Wrong MIG icon pixels"
    finally:
        kernel.FreeLibrary(module)
    shell = c.WinDLL("shell32", use_last_error=True)
    shell.ExtractIconExW.argtypes = [w.LPCWSTR, c.c_int, c.POINTER(w.HICON), c.POINTER(w.HICON), w.UINT]
    shell.ExtractIconExW.restype = w.UINT
    large, small = w.HICON(), w.HICON()
    extracted = shell.ExtractIconExW(str(executable), 0, c.byref(large), c.byref(small), 1)
    user = c.WinDLL("user32")
    user.DestroyIcon.argtypes = [w.HICON]
    try:
        assert extracted >= 1, "Windows shell found no application icon"
        assert large and small, "Windows shell cannot extract the downloaded file's icon"
    finally:
        if large: user.DestroyIcon(large)
        if small: user.DestroyIcon(small)
    print(f"PASS: downloaded launcher embeds all {count} original MIG icon frames and Windows extracts both icon sizes", flush=True)
