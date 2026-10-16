"""Check documentation failures using isolated bilingual guide fixtures."""
import importlib.util
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location("check_docs", ROOT / "tools/dev/check-docs.py")
docs = importlib.util.module_from_spec(spec)
spec.loader.exec_module(docs)


class DocumentationTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)
        self.guide = self.root / "docs/guide.md"
        self.guide.parent.mkdir()
        self.guide.with_name("guide.fr.md").write_text("# Guide\n", encoding="utf-8")
        self.content = "[English](guide.md) | [Français](guide.fr.md)\n\n# Guide\n"
        root_patch = patch.object(docs, "ROOT", self.root)
        root_patch.start()
        self.addCleanup(root_patch.stop)

    def check_content(self, content):
        self.guide.write_text(content, encoding="utf-8")
        return docs.check(self.guide)

    def test_valid_translation_and_fragment(self):
        self.assertEqual(self.check_content(self.content + "[Here](#guide)\n"), [])

    def test_missing_file_and_fragment_are_reported(self):
        errors = self.check_content(self.content + "[Missing](lost.md) [Bad](#absent)\n")
        self.assertTrue(any("lost.md" in error for error in errors))
        self.assertTrue(any("missing anchor" in error for error in errors))

    def test_translation_file_and_switch_are_both_required(self):
        self.guide.with_name("guide.fr.md").unlink()
        errors = self.check_content("# Guide\n")
        self.assertTrue(any("missing translation" in error for error in errors))
        self.assertTrue(any("missing language link" in error for error in errors))

    def test_code_samples_do_not_create_links(self):
        self.assertEqual(self.check_content(self.content + "```md\n[Sample](lost.md)\n```\n"), [])

    def test_em_dash_is_reported_in_either_language(self):
        errors = self.check_content(self.content + "Text \u2014 texte.\n")
        self.assertTrue(any("em dash" in error for error in errors))


if __name__ == "__main__":
    unittest.main()
