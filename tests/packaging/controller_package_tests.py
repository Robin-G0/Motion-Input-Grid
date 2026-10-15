"""Check portable bundle selection, manifests and self-extracting metadata."""
import importlib.util
import io
import json
import re
from pathlib import Path
import sys
import tarfile
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location("controller_package", ROOT / "tools/packaging/package-controller.py")
package = importlib.util.module_from_spec(spec)
spec.loader.exec_module(package)


class ControllerPackageTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.work = Path(self.temporary.name)
        self.source = self.work / "source"
        for name in ["models", "licenses"]:
            (self.source / name).mkdir(parents=True)
        for name in ["pose_landmarker_lite.task", "pose_landmarker_full.task", "hand_landmarker.task"]:
            (self.source / "models" / name).write_bytes(b"test model")
        (self.source / "licenses/MediaPipe-LICENSE").write_text("test license")

    def test_windows_omits_studio_sdk_and_shared_sdk_library(self):
        for name in ["motion-input-grid-controller.exe", "motion-input-grid-studio.exe", "libmediapipe.dll", "mig-c.dll"]:
            (self.source / name).write_bytes(b"test native runtime")
        redist = self.work / "crt"
        redist.mkdir()
        for name in ["vcruntime140.dll", "msvcp140.dll", "vcruntime140_1.dll"]:
            (redist / name).write_bytes(b"test CRT")
        payload = self.work / "payload"
        package.controller_payload(self.source, payload, "windows", redist)
        manifest = json.loads((payload / "controller-manifest.json").read_text())["files"]
        self.assertIn("models/hand_landmarker.task", manifest)
        self.assertIn("vcruntime140.dll", manifest)
        self.assertNotIn("mig-c.dll", manifest)
        self.assertFalse(any("studio" in name or "sdk" in name for name in manifest))
        generated = self.work / "generated"
        package.windows_resources(payload, generated)
        self.assertIn("RCDATA", (generated / "payload.rc").read_text())
        self.assertIn("models/pose_landmarker_lite.task", (generated / "payload.hpp").read_text())
        original_header = (generated / "payload.hpp").read_text()
        payload_hash = re.search(r'payload_hash\[\] = "([a-f0-9]{64})"', original_header)[1]
        relocated = self.work / "other payload"
        import shutil
        shutil.copytree(payload, relocated)
        package.windows_resources(relocated, generated)
        self.assertIn(payload_hash, (generated / "payload.hpp").read_text(), "Directory address must not depend on the build location")
        (relocated / "models/hand_landmarker.task").write_bytes(b"changed model")
        package.windows_resources(relocated, generated)
        self.assertNotIn(f'payload_hash[] = "{payload_hash}"', (generated / "payload.hpp").read_text())

    def test_missing_windows_crt_is_rejected(self):
        for name in ["motion-input-grid-controller.exe", "libmediapipe.dll"]:
            (self.source / name).write_bytes(b"test")
        with self.assertRaisesRegex(ValueError, "--redist"):
            package.controller_payload(self.source, self.work / "payload", "windows")

    def test_linux_self_extracting_file_has_executable_controller_and_no_studio(self):
        for name in ["bin", "lib", "plugins"]:
            (self.source / name).mkdir()
        (self.source / "bin/motion-input-grid-controller").write_bytes(b"test controller")
        (self.source / "bin/motion-input-grid-studio").write_bytes(b"test Studio")
        (self.source / "libmediapipe.so").write_bytes(b"test runtime")
        payload = self.work / "payload"
        package.controller_payload(self.source, payload, "linux")
        output = self.work / "controller.run"
        package.linux_file(payload, output)
        header, archive = output.read_bytes().split(b"__MIG_PAYLOAD__\n", 1)
        self.assertIn(b"umask 077", header)
        self.assertIn(b"--runtime", header)
        with tarfile.open(fileobj=io.BytesIO(archive)) as tar:
            names = tar.getnames()
            self.assertIn("models/hand_landmarker.task", names)
            self.assertIn("controller-manifest.json", names)
            self.assertEqual(tar.getmember("bin/motion-input-grid-controller").mode, 0o755)
            self.assertNotIn("bin/motion-input-grid-studio", names)
            self.assertTrue(all(not name.startswith("/") and ".." not in Path(name).parts for name in names))


if __name__ == "__main__":
    unittest.main()
