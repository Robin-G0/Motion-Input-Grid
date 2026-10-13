"""Regression coverage for repaired wheels and integrity failures before publication."""
import base64
import csv
import hashlib
import io
from pathlib import Path
import sys
import tempfile
import unittest
import warnings
import zipfile

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "tools/lib"))
from wheel_record import normalize_wheel, validate_wheel


class WheelRecordTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.wheel = Path(self.directory.name) / "example.whl"

    def make_wheel(self, directories=False, damage=None):
        files = {"mig/__init__.py": b"# package\n", "mig/_native/core.so": b"native payload",
                 "example-1.dist-info/METADATA": b"Name: example\nVersion: 1\n"}
        if directories:
            files["mig/"] = b""
            files["example-1.dist-info/"] = b""
        output = io.StringIO(newline="")
        writer = csv.writer(output, lineterminator="\r\r\n" if directories else "\n")
        for name, data in files.items():
            digest = base64.urlsafe_b64encode(hashlib.sha256(data).digest()).rstrip(b"=").decode()
            if damage == "missing" and name == "mig/__init__.py":
                continue
            writer.writerow((name, "sha256=" + digest, len(data)))
        if damage == "duplicate":
            writer.writerow(("mig/__init__.py", "sha256=invalid", 0))
        if damage == "extra":
            writer.writerow(("absent.py", "sha256=invalid", 0))
        if damage == "corrupt":
            files["mig/__init__.py"] += b"changed"
        if damage == "hash":
            files["mig/__init__.py"] = b"# changed\n"[:len(files["mig/__init__.py"])]
        record = "example-1.dist-info/RECORD"
        writer.writerow((record, "", ""))
        files[record] = output.getvalue().encode()
        if damage == "signature":
            files[record + ".jws"] = b"signature"
        with zipfile.ZipFile(self.wheel, "w", compression=zipfile.ZIP_DEFLATED) as archive:
            for name, data in files.items():
                archive.writestr(name, data)
            if damage == "zip-duplicate":
                with warnings.catch_warnings():
                    warnings.simplefilter("ignore", UserWarning)
                    archive.writestr("mig/__init__.py", b"duplicate")
        return files

    def test_valid_wheel(self):
        self.make_wheel()
        validate_wheel(self.wheel)

    def test_published_directory_and_crcrlf_regression(self):
        original = self.make_wheel(directories=True)
        with self.assertRaises(ValueError):
            validate_wheel(self.wheel)
        normalize_wheel(self.wheel)
        validate_wheel(self.wheel)
        with zipfile.ZipFile(self.wheel) as archive:
            self.assertFalse(any(member.is_dir() for member in archive.infolist()))
            self.assertNotIn(b"\r", archive.read("example-1.dist-info/RECORD"))
            for name, data in original.items():
                if not name.endswith(("/", "/RECORD")):
                    self.assertEqual(data, archive.read(name))
        first = self.wheel.read_bytes()
        normalize_wheel(self.wheel)
        self.assertEqual(first, self.wheel.read_bytes())

    def test_normalization_never_hides_integrity_failures(self):
        for damage in ("missing", "duplicate", "extra", "corrupt", "hash", "zip-duplicate"):
            with self.subTest(damage=damage):
                self.make_wheel(directories=True, damage=damage)
                before = self.wheel.read_bytes()
                with self.assertRaises(ValueError):
                    normalize_wheel(self.wheel)
                self.assertEqual(before, self.wheel.read_bytes())

    def test_signed_record_is_not_rewritten(self):
        self.make_wheel(damage="signature")
        validate_wheel(self.wheel)
        before = self.wheel.read_bytes()
        with self.assertRaisesRegex(ValueError, "signed RECORD"):
            normalize_wheel(self.wheel)
        self.assertEqual(before, self.wheel.read_bytes())


if __name__ == "__main__":
    unittest.main()
