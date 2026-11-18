"""Exercise the real upload guards for routine CI, opt-in runs and releases.

The workflows use one-line guards on uploads. actionlint validates their full YAML
and GitHub expression syntax; this dependency-free suite checks their event policy.
"""
import re
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[2]
WORKFLOWS = ROOT / ".github/workflows"


def upload_steps(filename):
    source = (WORKFLOWS / filename).read_text(encoding="utf-8")
    for block in re.split(r"(?m)^(?=            - )", source):
        if not re.search(r"uses: actions/upload-(?:artifact|pages-artifact)@", block):
            continue
        guard = re.search(r"(?m)^              if: (.+)$", block)
        name = re.search(r"(?m)^                  name: (.+)$", block)
        yield (name.group(1) if name else "github-pages"), guard.group(1) if guard else None


def allowed(expression, event, ref, publish=False, failed=False):
    if expression is None:
        return True
    expression = expression.replace("github.event_name", repr(event))
    expression = expression.replace("github.ref", repr(ref))
    expression = expression.replace("inputs.publish_artifacts", repr(publish))
    expression = expression.replace("failure()", repr(failed))
    expression = expression.replace("&&", " and ").replace("||", " or ")
    return bool(eval(expression, {"__builtins__": {}}, {"startsWith": str.startswith}))


class ArtifactPolicyTests(unittest.TestCase):
    def test_routine_pushes_prs_and_non_version_tags_never_upload_packages_or_traces(self):
        for workflow in ["ci.yml", "extensions.yml", "pages.yml"]:
            for name, guard in upload_steps(workflow):
                if name == "github-pages":
                    continue  # Explicitly retained automatic deployment exception.
                for event, ref in [("push", "refs/heads/main"), ("push", "refs/heads/feature"),
                                   ("pull_request", "refs/pull/10/merge"), ("push", "refs/tags/backup")]:
                    for failed in [False, True]:
                        with self.subTest(workflow=workflow, name=name, event=event, ref=ref, failed=failed):
                            self.assertFalse(allowed(guard, event, ref, publish=True, failed=failed))

    def test_a_manual_run_requires_explicit_opt_in_and_retains_failure_status(self):
        for workflow in ["ci.yml", "extensions.yml", "pages.yml"]:
            source = (WORKFLOWS / workflow).read_text(encoding="utf-8")
            self.assertRegex(source, r"publish_artifacts:\s+description: [^\n]+\s+type: boolean\s+required: false\s+default: false")
            for name, guard in upload_steps(workflow):
                if name == "github-pages":
                    continue
                for failed in [False, True]:
                    self.assertFalse(allowed(guard, "workflow_dispatch", "refs/heads/main", failed=failed))
                    self.assertEqual(allowed(guard, "workflow_dispatch", "refs/heads/main", publish=True, failed=failed),
                                     failed if "test-results" in name else True)

    def test_version_tags_do_not_duplicate_release_uploads_in_routine_workflows(self):
        for workflow in ["ci.yml", "extensions.yml"]:
            source = (WORKFLOWS / workflow).read_text(encoding="utf-8")
            self.assertIn("branches: ['**']", source)
            for name, guard in upload_steps(workflow):
                if "test-results" in name:
                    continue
                self.assertFalse(allowed(guard, "push", "refs/tags/v1.2.3"), name)

    def test_release_staging_uses_draft_assets_without_actions_artifacts(self):
        source = (WORKFLOWS / "release-check.yml").read_text(encoding="utf-8")
        self.assertNotIn("actions/upload-artifact@", source)
        self.assertNotIn("actions/download-artifact@", source)
        self.assertIn("stage-assets.py --create", source)
        self.assertIn("stage-assets.py --final", source)
        self.assertIn('gh release download "$RELEASE_TAG"', source)
        self.assertIn("needs: [linux, windows, javascript, source, arm64, extensions]", source)

    def test_pages_stays_automatic_on_main_and_never_deploys_a_pr(self):
        pages = dict(upload_steps("pages.yml"))
        guard = pages["github-pages"]
        self.assertTrue(allowed(guard, "push", "refs/heads/main"))
        self.assertTrue(allowed(guard, "workflow_dispatch", "refs/heads/main"))
        self.assertFalse(allowed(guard, "pull_request", "refs/pull/10/merge"))
        self.assertFalse(allowed(guard, "push", "refs/heads/feature"))
        source = (WORKFLOWS / "pages.yml").read_text(encoding="utf-8")
        deploy = source.split("    deploy:\n", 1)[1]
        self.assertIn("if: " + guard, deploy)
        self.assertIn("retention-days: 1", source)

    def test_wasm_and_framework_checks_share_a_runner_without_an_artifact_transfer(self):
        source = (WORKFLOWS / "ci.yml").read_text(encoding="utf-8")
        web = source.split("    web:\n", 1)[1].split("    checks:\n", 1)[0]
        self.assertNotIn("actions/download-artifact@", source)
        for command in ["emcmake cmake", "web_tests.mjs", "web_camera_tests.mjs", "npm test",
                        "npm run test:types", "npm run build:examples", "npm run test:browser",
                        "browser_assets_tests.mjs", "standalone_browser_tests.py"]:
            self.assertIn(command, web)
        self.assertIn("needs: [changes, format, metadata, windows, portable, linux-native, web]", source)

    def test_no_other_workflow_can_implicitly_upload_on_a_branch_push(self):
        for path in WORKFLOWS.glob("*.yml"):
            if not list(upload_steps(path.name)) or path.name in {"ci.yml", "extensions.yml", "pages.yml"}:
                continue
            events = path.read_text(encoding="utf-8").split("on:\n", 1)[1].split("\npermissions:", 1)[0]
            if "    push:" in events:
                self.assertIn("tags: ['v*.*.*']", events)
                self.assertNotIn("branches:", events)
            else:
                self.assertIn("workflow_dispatch:", events)


if __name__ == "__main__":
    unittest.main()
