"""Small Win32 UI harness, also used to capture actual product screenshots.

No simulated UI or third-party image dependencies. All handles are filtered by
process or exact executable path so unrelated application windows are untouched.
"""
import ctypes as c
from ctypes import wintypes as w
from pathlib import Path
import struct
import time
import zlib

user = c.WinDLL("user32", use_last_error=True)
kernel = c.WinDLL("kernel32", use_last_error=True)
gdi = c.WinDLL("gdi32", use_last_error=True)
callback = c.WINFUNCTYPE(w.BOOL, w.HWND, w.LPARAM)
user.EnumWindows.argtypes = [callback, w.LPARAM]
user.GetWindowThreadProcessId.argtypes = [w.HWND, c.POINTER(w.DWORD)]
user.GetClassNameW.argtypes = [w.HWND, w.LPWSTR, c.c_int]
user.GetWindowTextW.argtypes = [w.HWND, w.LPWSTR, c.c_int]
user.GetDlgItem.argtypes = [w.HWND, c.c_int]
user.GetDlgItem.restype = w.HWND
user.PostMessageW.argtypes = [w.HWND, w.UINT, w.WPARAM, w.LPARAM]
user.SendMessageW.argtypes = [w.HWND, w.UINT, w.WPARAM, w.LPARAM]
user.SendMessageW.restype = c.c_ssize_t
user.GetWindowLongW.argtypes = [w.HWND, c.c_int]
kernel.OpenProcess.argtypes = [w.DWORD, w.BOOL, w.DWORD]
kernel.OpenProcess.restype = w.HANDLE
kernel.QueryFullProcessImageNameW.argtypes = [w.HANDLE, w.DWORD, w.LPWSTR, c.POINTER(w.DWORD)]
kernel.CloseHandle.argtypes = [w.HANDLE]


def text(handle):
    value = c.create_unicode_buffer(32768)
    user.SendMessageW(handle, 0xD, len(value), c.addressof(value))
    return value.value


def windows(class_name, pid=None, image=None):
    found = []
    @callback
    def visit(handle, _):
        name = c.create_unicode_buffer(256)
        user.GetClassNameW(handle, name, len(name))
        if name.value != class_name:
            return True
        owner = w.DWORD()
        user.GetWindowThreadProcessId(handle, c.byref(owner))
        if pid is not None and owner.value != pid:
            return True
        if image is not None:
            process = kernel.OpenProcess(0x1000, False, owner.value)
            if not process:
                return True
            try:
                path = c.create_unicode_buffer(32768); size = w.DWORD(len(path))
                if not kernel.QueryFullProcessImageNameW(process, 0, path, c.byref(size)) or Path(path.value) != image:
                    return True
            finally:
                kernel.CloseHandle(process)
        found.append(handle)
        return True
    user.EnumWindows(visit, 0)
    return found


def wait_for(condition, timeout=30):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        result = condition()
        if result:
            return result
        time.sleep(.05)
    raise TimeoutError("Expected Win32 application state did not appear")


def click(window, control):
    user.PostMessageW(window, 0x111, control, 0)  # WM_COMMAND, BN_CLICKED


def close(window):
    user.PostMessageW(window, 0x10, 0, 0)


def screenshot(window, destination):
    user.ShowWindow.argtypes = [w.HWND, c.c_int]
    user.SetForegroundWindow.argtypes = [w.HWND]
    user.RedrawWindow.argtypes = [w.HWND, c.c_void_p, w.HRGN, w.UINT]
    user.GetWindowRect.argtypes = [w.HWND, c.POINTER(w.RECT)]
    user.GetWindowDC.argtypes = [w.HWND]; user.GetWindowDC.restype = w.HDC
    user.ReleaseDC.argtypes = [w.HWND, w.HDC]
    user.PrintWindow.argtypes = [w.HWND, w.HDC, w.UINT]
    gdi.CreateCompatibleDC.argtypes = [w.HDC]; gdi.CreateCompatibleDC.restype = w.HDC
    gdi.CreateCompatibleBitmap.argtypes = [w.HDC, c.c_int, c.c_int]; gdi.CreateCompatibleBitmap.restype = w.HBITMAP
    gdi.SelectObject.argtypes = [w.HDC, w.HGDIOBJ]; gdi.SelectObject.restype = w.HGDIOBJ
    gdi.GetDIBits.argtypes = [w.HDC, w.HBITMAP, w.UINT, w.UINT, c.c_void_p, c.c_void_p, w.UINT]
    gdi.DeleteObject.argtypes = [w.HGDIOBJ]; gdi.DeleteDC.argtypes = [w.HDC]
    user.ShowWindow(window, 9)
    user.SetForegroundWindow(window)
    user.RedrawWindow(window, None, None, 0x185)  # invalidate + erase + update now + children
    rect = w.RECT(); user.GetWindowRect(window, c.byref(rect))
    width, height = rect.right-rect.left, rect.bottom-rect.top
    dc = user.GetWindowDC(window); memory = gdi.CreateCompatibleDC(dc)
    bitmap = gdi.CreateCompatibleBitmap(dc, width, height); old = gdi.SelectObject(memory, bitmap)
    try:
        assert user.PrintWindow(window, memory, 2), "PrintWindow failed"
        gdi.SelectObject(memory, old)
        header = struct.pack("<IiiHHIIiiII", 40, width, -height, 1, 32, 0, width*height*4, 0, 0, 0, 0)
        info = c.create_string_buffer(header + bytes(12))
        pixels = c.create_string_buffer(width*height*4)
        assert gdi.GetDIBits(memory, bitmap, 0, height, pixels, info, 0) == height
        raw = pixels.raw
        rows = []
        for y in range(height):
            row = raw[y*width*4:(y+1)*width*4]
            rgb = bytearray(width*3)
            rgb[0::3], rgb[1::3], rgb[2::3] = row[2::4], row[1::4], row[0::4]
            rows.append(b"\0" + rgb)
        def chunk(kind, data):
            return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind+data))
        png = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", width,height,8,2,0,0,0))
        png += chunk(b"IDAT", zlib.compress(b"".join(rows))) + chunk(b"IEND", b"")
        Path(destination).write_bytes(png)
    finally:
        gdi.DeleteObject(bitmap); gdi.DeleteDC(memory); user.ReleaseDC(window, dc)
