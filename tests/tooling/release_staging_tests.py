"""Protect published releases and reject stale/duplicate release outputs."""
import importlib.util
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location("stage_assets", ROOT / "tools/release/stage-assets.py")
stage = importlib.util.module_from_spec(spec)
spec.loader.exec_module(stage)


class ReleaseStagingTests(unittest.TestCase):
    def test_relative_input_paths_are_absolute_when_gh_runs_from_repository_root(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            archive = root / "motion-input-grid-1.2.0.tgz"
            archive.write_bytes(b"fixture")
            relative = Path(os.path.relpath(root))
            with patch.object(stage, "draft"), patch.object(stage, "release_version", return_value="1.2.0"), patch.object(stage, "gh") as gh:
                stage.upload("v1.2.0", relative, False)
                self.assertIn(str(archive.resolve()), gh.call_args.args)

    def test_published_release_is_never_overwritten(self):
        with patch.object(stage, "gh", return_value=json.dumps({"isDraft": False, "tagName": "v1.2.0"})):
            with self.assertRaisesRegex(ValueError, "draft"):
                stage.draft("v1.2.0")

    def test_draft_must_match_checked_out_commit(self):
        data = {"isDraft": True, "tagName": "v1.2.0", "targetCommitish": "different"}
        with patch.object(stage, "gh", return_value=json.dumps(data)), patch.object(stage.subprocess, "check_output", return_value="current"):
            with self.assertRaisesRegex(ValueError, "commit"):
                stage.draft("v1.2.0")

    def test_upload_filters_collections_and_only_final_uploads_inventory(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            names = ["motion-input-grid-1.2.0.tgz", "motion-input-grid-1.2.0-javascript-examples.tar.gz",
                     "motion-input-grid-1.2.0-browser-web-standalone.tar.gz", "SHA256SUMS", "release-manifest.json"]
            for name in names:
                (root / name).write_bytes(b"fixture")
            with patch.object(stage, "draft"), patch.object(stage, "release_version", return_value="1.2.0"), patch.object(stage, "gh") as gh:
                stage.upload("v1.2.0", root, False)
                arguments = gh.call_args.args
                self.assertIn(str(root / names[0]), arguments)
                self.assertIn(str(root / names[2]), arguments)
                self.assertNotIn(str(root / names[1]), arguments)
                self.assertNotIn(str(root / "SHA256SUMS"), arguments)
                stage.upload("v1.2.0", root, True)
                self.assertIn(str(root / "SHA256SUMS"), gh.call_args.args)
                self.assertIn(str(root / "release-manifest.json"), gh.call_args.args)

    def test_stale_or_unknown_outputs_are_rejected_before_any_upload(self):
        for name in ["motion-input-grid-1.1.0.tgz", "unexpected-1.2.0.zip"]:
            with self.subTest(name=name), tempfile.TemporaryDirectory() as directory:
                root = Path(directory)
                (root / name).write_bytes(b"fixture")
                with patch.object(stage, "draft"), patch.object(stage, "release_version", return_value="1.2.0"), patch.object(stage, "gh") as gh:
                    with self.assertRaises(ValueError):
                        stage.upload("v1.2.0", root, False)
                    gh.assert_not_called()


if __name__ == "__main__":
    unittest.main()
