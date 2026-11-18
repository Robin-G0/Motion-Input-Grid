"""Keep release download navigation complete and tied to the validated inventory."""
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location("catalogue", ROOT / "tools/release/release-catalogue.py")
catalogue = importlib.util.module_from_spec(spec)
spec.loader.exec_module(catalogue)


class CatalogueTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.directory = Path(self.temporary.name)
        suffixes = ["windows-x64-native.zip", "controller-windows-x64.exe",
                    "browser-extension-chromium.zip", "browser-extension-firefox.zip",
                    "windows-x64-sdk.zip", "vcpkg-overlay.tar.gz", "source.tar.gz",
                    "controller-windows-x64.exe.dependencies.json"]
        suffixes += [f"windows-x64-{name}-standalone.zip" for name in
                     ["python-tkinter", "pygame", "sdl2", "sfml", "sdk-consumer", "native-consumer",
                      "godot-gdscript", "godot-csharp", "unity", "unreal"]]
        suffixes += [f"browser-{name}-standalone.tar.gz" for name in ["web", "react", "vue", "next"]]
        suffixes += ["windows-x64-godot.zip", "windows-x64-unreal.zip", "windows-x64-unity.tgz"]
        names = [f"motion-input-grid-1.2.0-{suffix}" for suffix in suffixes]
        names += ["motion-input-grid-1.2.0.tgz", "motion_input_grid-1.2.0.tar.gz",
                  "motion_input_grid-1.2.0-py3-none-win_amd64.whl", "motion-input-grid_1.2.0_amd64.deb"]
        self.manifest = {"version": "1.2.0", "tag": "v1.2.0",
                         "artifacts": [{"name": name, "bytes": 2048} for name in names]}
        self.output = self.directory / "notes.md"

    def generate(self):
        (self.directory / "release-manifest.json").write_text(json.dumps(self.manifest))
        catalogue.generate(self.directory, self.output)
        return self.output.read_text(encoding="utf-8")

    def test_every_package_has_one_direct_link_and_navigation_is_versioned(self):
        content = self.generate()
        for entry in self.manifest["artifacts"]:
            url = f"{catalogue.REPOSITORY}/releases/download/v1.2.0/{entry['name']}"
            self.assertEqual(content.count(f"]({url})"), 1, entry["name"])
        self.assertIn("# Motion Input Grid v1.2.0", content)
        self.assertIn('name="mig-v1-2-0-browser-extensions"', content)
        self.assertIn('name="cpp-sdk"', content)
        self.assertIn("| Platform / package | Download | Size |", content)
        self.assertNotIn("unchanged from 1.0.2", content)

    def test_an_unknown_new_download_cannot_be_silently_omitted(self):
        self.manifest["artifacts"].append({"name": "motion-input-grid-1.2.0-new.zip", "bytes": 1})
        with self.assertRaisesRegex(ValueError, "Unlisted release files"):
            self.generate()

    def test_duplicate_inventory_entries_are_rejected(self):
        self.manifest["artifacts"].append(self.manifest["artifacts"][0])
        with self.assertRaisesRegex(ValueError, "Duplicate catalogue entry"):
            self.generate()

    def test_mismatched_version_cannot_produce_broken_download_urls(self):
        self.manifest["tag"] = "v1.1.0"
        with self.assertRaisesRegex(ValueError, "matching version"):
            self.generate()


if __name__ == "__main__":
    unittest.main()
