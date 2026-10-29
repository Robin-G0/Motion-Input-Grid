"""Regression tests for selective CI and real Git comparison semantics."""
import importlib.util
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch


ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location("ci_changes", ROOT / "tools/dev/ci-changes.py")
changes = importlib.util.module_from_spec(spec)
spec.loader.exec_module(changes)


class SelectionTests(unittest.TestCase):
    def enabled(self, *paths):
        return {job for job, enabled in changes.classify(paths).items() if enabled}

    def test_site_does_not_build_the_repository_runtime(self):
        self.assertEqual(self.enabled("site/studio/src/main.mjs"), {"site"})
        self.assertEqual(self.enabled("site/package-lock.json"), {"site"})

    def test_docs_and_illustrations_only_validate_docs(self):
        self.assertEqual(self.enabled("docs/guide.md", "docs/images/demo.png", "bindings/python/README.md"), {"docs"})

    def test_shared_native_headers_also_test_portable_consumers(self):
        self.assertEqual(self.enabled("src/apps/authoring.hpp"), {"windows", "linux", "portable", "format"})

    def test_platform_specific_ui_skips_other_platforms_and_wasm(self):
        self.assertEqual(self.enabled("src/linux-apps/window.cpp"), {"linux", "format"})
        self.assertEqual(self.enabled("tests/ui/windows/controller_ui_tests.cpp"), {"windows", "format"})

    def test_engine_and_shared_build_configuration_test_all_consumers(self):
        for path in ("src/core/src/session.cpp", "cmake/MIGDependencies.cmake", "CMakeLists.txt", "configs/default.json"):
            with self.subTest(path=path):
                self.assertTrue(changes.SOURCE <= self.enabled(path))

    def test_javascript_uses_wasm_producer_and_native_adapter_uses_native_jobs(self):
        self.assertEqual(self.enabled("examples/next/app/page.tsx"), {"web"})
        self.assertEqual(self.enabled("bindings/javascript/package.json"), {"web", "metadata"})
        self.assertEqual(self.enabled("src/native/camera.cpp"), {"windows", "linux", "format"})

    def test_mixed_changes_take_union_and_empty_changes_skip(self):
        self.assertEqual(self.enabled("docs/a.md", "src/linux-apps/window.cpp"), {"docs", "linux", "format"})
        self.assertEqual(self.enabled(), set())

    def test_platform_packaging_does_not_build_unrelated_runtimes(self):
        self.assertEqual(self.enabled("tools/packaging/package-controller.py"), {"windows", "metadata"})
        self.assertEqual(self.enabled("tools/lib/package_linux.py"), {"linux", "metadata"})
        self.assertEqual(self.enabled("tools/packaging/package-examples.py"), {"windows", "linux", "web", "metadata"})

    def test_detector_changes_run_every_check_and_unknown_paths_fail_open(self):
        for path in ("tools/dev/ci-changes.py", ".github/workflows/changes.yml", "tests/tooling/ci_changes_tests.py"):
            self.assertEqual(self.enabled(path), set(changes.JOBS))
        self.assertTrue(changes.SOURCE <= self.enabled("new-platform/build.xyz"))
        self.assertEqual(self.enabled(".clang-format"), {"format"})


class GitComparisonTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.git("init", "-b", "main")
        self.git("config", "user.name", "CI fixture")
        self.git("config", "user.email", "fixture@example.invalid")
        self.write("readme.md")
        self.base = self.commit()

    def git(self, *args):
        return changes.git(*args, root=self.root).decode().strip()

    def write(self, name, content="fixture\n"):
        path = self.root / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding="utf-8")

    def commit(self):
        self.git("add", ".")
        self.git("commit", "-m", "fixture")
        return self.git("rev-parse", "HEAD")

    def push_paths(self, head, base=None):
        return changes.changed_paths("push", {"before": base or self.base, "after": head}, self.root)

    def test_push_covers_all_commits_and_more_than_300_files(self):
        for index in range(305):
            self.write(f"site/file {index}.mjs")
        self.commit()
        self.write("src/core/new.cpp")
        paths = self.push_paths(self.commit())
        self.assertEqual(len(paths), 306)
        self.assertIn("src/core/new.cpp", paths)
        self.assertIn("site/file 304.mjs", paths)

    def test_rename_and_deletion_keep_old_paths(self):
        self.write("docs/old name.md")
        before = self.commit()
        (self.root / "site").mkdir()
        self.git("mv", "docs/old name.md", "site/new name.md")
        (self.root / "readme.md").unlink()
        self.assertEqual(set(self.push_paths(self.commit(), before)), {"docs/old name.md", "site/new name.md", "readme.md"})

    def test_pull_request_excludes_unrelated_base_branch_commits(self):
        self.git("checkout", "-b", "feature")
        self.write("site/feature.mjs")
        head = self.commit()
        self.git("checkout", "main")
        self.write("src/core/unrelated.cpp")
        base = self.commit()
        event = {"pull_request": {"base": {"sha": base}, "head": {"sha": head}}}
        self.assertEqual(changes.changed_paths("pull_request", event, self.root), ["site/feature.mjs"])

    def test_manual_first_push_and_missing_baseline_run_everything(self):
        self.assertIsNone(changes.changed_paths("workflow_dispatch", {}, self.root))
        self.assertIsNone(self.push_paths(self.base, "0" * 40))
        self.assertIsNone(self.push_paths(self.base, "f" * 40))

    def test_outputs_and_summary_use_actions_boolean_strings(self):
        event = self.root / "event.json"
        event.write_text(json.dumps({"before": self.base, "after": self.base}), encoding="utf-8")
        output, summary = self.root / "output", self.root / "summary"
        with patch.dict(os.environ, {"GITHUB_EVENT_NAME": "push", "GITHUB_EVENT_PATH": str(event),
                                   "GITHUB_OUTPUT": str(output), "GITHUB_STEP_SUMMARY": str(summary)}), \
                patch.object(Path, "cwd", return_value=self.root):
            changes.main()
        self.assertEqual(output.read_text().splitlines(), [f"{job}=false" for job in changes.JOBS])
        self.assertIn("Compared 0 changed paths", summary.read_text())


if __name__ == "__main__":
    unittest.main()
