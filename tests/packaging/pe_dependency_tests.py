"""Exercise PE import parsing and rejection of developer-environment fallback."""
from pathlib import Path
import struct
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "tools/lib"))
from pe_dependencies import pe_imports, audit_windows


def fixture(path, imports=(), delayed=(), forwarder=None):
    data = bytearray(4096)
    def write(offset, value, fmt="I"):
        struct.pack_into("<"+fmt, data, offset, value)
    data[:2] = b"MZ"; write(0x3c, 0x80); data[0x80:0x84] = b"PE\0\0"
    write(0x84, 0x8664, "H"); write(0x86, 1, "H"); write(0x94, 240, "H")
    optional = 0x98
    write(optional, 0x20b, "H"); write(optional+24, 0x140000000, "Q")
    write(optional+60, 0x200); write(optional+108, 16)
    section = optional+240
    write(section+8, 0xe00); write(section+12, 0x1000); write(section+16, 0xe00); write(section+20, 0x200)
    for index, names, rva, stride in [(1, imports, 0x1100, 20), (13, delayed, 0x1200, 32)]:
        if not names: continue
        write(optional+112+index*8, rva); write(optional+116+index*8, (len(names)+1)*stride)
        for i, name in enumerate(names):
            position = rva-0x1000+0x200+i*stride
            name_rva = 0x1500+index*0x20+i*0x60
            if index == 13: write(position, 1)
            write(position+(4 if index == 13 else 12), name_rva)
            start = name_rva-0x1000+0x200
            data[start:start+len(name)+1] = name.encode()+b"\0"
    if forwarder:
        write(optional+112, 0x1800); write(optional+116, 0x100)
        exports = 0xa00
        write(exports+20, 1); write(exports+28, 0x1840); write(0xa40, 0x1860)
        data[0xa60:0xa60+len(forwarder)+1] = forwarder.encode()+b"\0"
    path.write_bytes(data)


class PeDependencyTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(); self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.payload = self.root / "payload"; self.payload.mkdir()
        self.system = self.root / "System32"; self.system.mkdir()

    def test_imports_delay_loads_and_export_forwarders_are_parsed(self):
        exe = self.payload / "controller.exe"
        fixture(exe, ["KERNEL32.dll"], ["libmediapipe.dll"], "KERNELBASE.Sleep")
        imports = pe_imports(exe)
        self.assertEqual(imports["imports"], ["kernel32.dll"])
        self.assertEqual(imports["delay_imports"], ["libmediapipe.dll"])
        self.assertEqual(imports["forwarded_dlls"], ["kernelbase.dll"])

    def test_all_bundled_dlls_are_roots_even_if_loaded_dynamically(self):
        fixture(self.payload / "controller.exe", ["kernel32.dll"])
        fixture(self.payload / "libmediapipe.dll", ["vcruntime140.dll"])
        fixture(self.payload / "vcruntime140.dll", ["kernel32.dll"])
        fixture(self.system / "kernel32.dll")
        report = audit_windows(self.payload, self.system)
        self.assertEqual(report["modules"]["vcruntime140.dll"]["source"], "bundled")
        self.assertEqual(report["modules"]["kernel32.dll"]["source"], "windows")

    def test_developer_runtime_in_system32_cannot_satisfy_an_unbundled_dependency(self):
        fixture(self.payload / "controller.exe", ["vcruntime140.dll"])
        fixture(self.system / "vcruntime140.dll")
        with self.assertRaisesRegex(ValueError, "Unbundled/non-OS"):
            audit_windows(self.payload, self.system)

    def test_unbundled_delayed_dependency_is_also_rejected(self):
        fixture(self.payload / "controller.exe", (), ["developer-only.dll"])
        fixture(self.system / "developer-only.dll")
        with self.assertRaisesRegex(ValueError, "Unbundled/non-OS"):
            audit_windows(self.payload, self.system)


if __name__ == "__main__":
    unittest.main()
