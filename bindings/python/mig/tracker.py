"""One explicitly owned native tracker; serialize calls on its owning thread."""
import ctypes
import ctypes.util
import os
from pathlib import Path


class Packet(ctypes.Structure):
    """Unmirrored MediaPipe indices. Missing landmarks have confidence zero.

    Each body joint has x, y, z, confidence, world XYZ, world-valid (0/1).
    Each hand joint has image XYZ and world XYZ. See docs/reference/c-abi.md.
    """

    _fields_ = [
        ("timestamp_ms", ctypes.c_int64),
        ("sequence", ctypes.c_uint64),
        ("aspect", ctypes.c_float),
        ("hand_count", ctypes.c_uint32),
        ("hand_world_mask", ctypes.c_uint32),
        ("body", ctypes.c_float * (33 * 8)),
        ("hands", ctypes.c_float * (2 * 21 * 6)),
    ]

    def set_body(self, joint, x, y, z=0.0, confidence=1.0, world=None):
        """Set one body joint; pass world=(x,y,z) only when measured."""
        if not 0 <= joint < 33:
            raise ValueError("Body joint must be between 0 and 32")
        offset = joint * 8
        self.body[offset:offset + 8] = (
            x, y, z, confidence, *(world or (0.0, 0.0, 0.0)), int(world is not None)
        )


def load_library(path=None):
    """Declare every ABI signature, including pointer return values on 64-bit."""
    bundled = Path(__file__).parent / "_native" / ("mig-c.dll" if os.name == "nt" else "libmig-c.so.1")
    if path:
        name = str(Path(path).resolve())
    elif bundled.is_file():
        name = str(bundled.resolve())
    else:
        name = ctypes.util.find_library("mig-c")
    if not name:
        name = "mig-c.dll" if os.name == "nt" else "libmig-c.so.1"
    library = ctypes.CDLL(name)
    handle = ctypes.c_void_p
    integer = ctypes.c_int
    unsigned = ctypes.c_uint
    string = ctypes.c_char_p
    signatures = {
        "mig_abi_version": (unsigned, []),
        "mig_packet_size": (ctypes.c_size_t, []),
        "mig_last_error": (string, []),
        "mig_create": (handle, [string]),
        "mig_destroy": (None, [handle]),
        "mig_load": (integer, [handle, string]),
        "mig_export": (ctypes.c_size_t, [handle, ctypes.c_void_p, ctypes.c_size_t]),
        "mig_update": (integer, [handle, ctypes.POINTER(Packet)]),
        "mig_event_count": (unsigned, [handle]),
        "mig_event_action": (string, [handle, unsigned]),
        "mig_event_id": (string, [handle, unsigned]),
        "mig_active": (integer, [handle, unsigned]),
        "mig_coordinate": (integer, [handle, integer, integer, ctypes.POINTER(ctypes.c_float)]),
        "mig_hand_coordinate": (
            integer, [handle, integer, integer, integer, ctypes.POINTER(ctypes.c_float)]
        ),
        "mig_reset": (None, [handle, integer]),
        "mig_camera_start": (integer, [handle, string, unsigned]),
        "mig_camera_poll": (integer, [handle, ctypes.POINTER(Packet)]),
        "mig_camera_stop": (None, [handle]),
    }
    for name, (result, arguments) in signatures.items():
        function = getattr(library, name)
        function.restype = result
        function.argtypes = arguments
    if library.mig_abi_version() != 1 or library.mig_packet_size() != ctypes.sizeof(Packet):
        raise RuntimeError("Incompatible MIG native library/packet ABI")
    if function := getattr(library, "mig_camera_start_model", None):
        function.restype = integer
        function.argtypes = [handle, string, unsigned, string]
    if function := getattr(library, "mig_camera_image", None):
        function.restype = ctypes.c_int
        function.argtypes = [ctypes.c_void_p, ctypes.POINTER(ctypes.POINTER(ctypes.c_uint8)),
                             ctypes.POINTER(ctypes.c_uint), ctypes.POINTER(ctypes.c_uint)]
    return library


class Tracker:
    """Use with Tracker(library_path, json_text) as tracker to release resources."""

    def __init__(self, library_path, json_text):
        self.library = load_library(library_path)
        self._coordinate_buffer = (ctypes.c_float * 4)()
        self.handle = None
        self.handle = self.library.mig_create(self._json_bytes(json_text))
        if not self.handle:
            self._raise_error()

    def _raise_error(self):
        raise RuntimeError(self.library.mig_last_error().decode("utf-8", errors="replace"))

    @staticmethod
    def _json_bytes(json_text):
        if "\0" in json_text:
            raise ValueError("JSON contains an embedded NUL")
        return json_text.encode("utf-8")

    def _require_open(self):
        if not self.handle:
            raise RuntimeError("Tracker is closed")

    def _check(self, result):
        if result < 0:
            self._raise_error()
        return result

    def import_json(self, json_text):
        """Atomic strict-v2 import. Successful import stops an active camera."""
        self._require_open()
        self._check(self.library.mig_load(self.handle, self._json_bytes(json_text)))

    def export_json(self):
        self._require_open()
        size = self.library.mig_export(self.handle, None, 0)
        if not size:
            self._raise_error()
        buffer = ctypes.create_string_buffer(size)
        self.library.mig_export(self.handle, buffer, size)
        return buffer.value.decode("utf-8")

    def events(self):
        """Copy current logical actions before the next native call invalidates them."""
        self._require_open()
        return self._read_events(self.library.mig_event_count(self.handle))

    def _read_events(self, count):
        return [
            (self.library.mig_event_action(self.handle, index).decode("utf-8"),
             self.library.mig_event_id(self.handle, index).decode("utf-8"))
            for index in range(count)
        ]

    def update(self, packet):
        self._require_open()
        count = self._check(self.library.mig_update(self.handle, ctypes.byref(packet)))
        return self._read_events(count)

    def coordinate(self, joint, system=0):
        """Return (x,y,z,confidence), or None; systems image=0, world=1, Y-up=2."""
        self._require_open()
        point = self._coordinate_buffer
        present = self.library.mig_coordinate(self.handle, joint, system, point)
        return tuple(point) if present else None

    def hand_coordinate(self, side, joint, system=0):
        self._require_open()
        point = self._coordinate_buffer
        present = self.library.mig_hand_coordinate(self.handle, side, joint, system, point)
        return tuple(point) if present else None

    def active(self, input_index):
        self._require_open()
        return bool(self.library.mig_active(self.handle, input_index))

    def reset(self, recalibrate=False):
        self._require_open()
        self.library.mig_reset(self.handle, int(recalibrate))

    def start_camera(self, runtime_directory, index=0, model=None):
        """Start native capture; model is "lite" (default), "full" or "heavy".

        Models other than the bundled ones must already be in the user model cache;
        the SDK never downloads. Older SDKs only support the default model.
        """
        self._require_open()
        runtime = str(Path(runtime_directory).resolve()).encode("utf-8")
        if model is None:
            self._check(self.library.mig_camera_start(self.handle, runtime, index))
            return
        function = getattr(self.library, "mig_camera_start_model", None)
        if function is None:
            raise RuntimeError("This MIG SDK lacks pose model selection; rebuild or update the SDK.")
        self._check(function(self.handle, runtime, index, str(model).encode("utf-8")))

    def poll_camera(self):
        """Synchronous native capture/inference. None on timeout, Packet otherwise.

        This already recognizes the returned frame; consume events(), not update().
        Keep this operation off GUI threads when using a real camera.
        """
        self._require_open()
        packet = Packet()
        present = self._check(self.library.mig_camera_poll(self.handle, ctypes.byref(packet)))
        return packet if present else None

    def stop_camera(self):
        self._require_open()
        self.library.mig_camera_stop(self.handle)

    def camera_image(self):
        """Copy the last native RGB24 image on the tracker owner thread.

        Returns (width, height, bytes), or None before a successful camera poll.
        Requires a native library exporting the optional preview extension.
        """
        self._require_open()
        function = getattr(self.library, "mig_camera_image", None)
        if function is None:
            raise RuntimeError("This MIG SDK lacks camera preview; rebuild or update the SDK.")
        pixels = ctypes.POINTER(ctypes.c_uint8)()
        width, height = ctypes.c_uint(), ctypes.c_uint()
        if not function(self.handle, ctypes.byref(pixels), ctypes.byref(width), ctypes.byref(height)):
            return None
        return width.value, height.value, ctypes.string_at(pixels, width.value * height.value * 3)

    def close(self):
        if self.handle:
            self.library.mig_destroy(self.handle)
            self.handle = None

    def __enter__(self):
        return self

    def __exit__(self, *_):
        self.close()
