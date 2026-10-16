"""Check first-party guide translations, language links and local Markdown targets."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "lib"))
import os
import re
from urllib.parse import unquote, urlsplit
from distribution_policy import EXCLUDED_NAMES
from release_metadata import REPOSITORY

ROOT = Path(__file__).resolve().parents[2]


def guides():
    paths = [ROOT / name for name in ("readme.md", "CONTRIBUTING.md", "SECURITY.md")]
    for directory in ("docs", "examples", "bindings", "integrations", "ports", "tests", "tools"):
        paths.extend((ROOT / directory).rglob("*.md"))
    return sorted(path for path in set(paths)
                  if not any(part in EXCLUDED_NAMES or part in ("licenses", "public")
                              for part in path.relative_to(ROOT).parts)
                  and not path.name.startswith("LICENSE"))


def anchors(path):
    content = re.sub(r"```.*?```", "", path.read_text(encoding="utf-8"), flags=re.S)
    result = set(re.findall(r'(?:id|name)=["\']([^"\']+)["\']', content))
    counts = {}
    for heading in re.findall(r"^#{1,6} +(.+?) *#* *$", content, flags=re.M):
        heading = re.sub(r"<[^>]+>", "", heading).lower()
        slug = "".join(char for char in heading
                       if char.isalnum() or char in " _-").replace(" ", "-")
        count = counts.get(slug, 0)
        counts[slug] = count + 1
        result.add(slug + (f"-{count}" if count else ""))
    return result


def check(path):
    content = path.read_text(encoding="utf-8")
    english_name = path.name.replace(".fr.md", ".md")
    french_name = english_name.removesuffix(".md") + ".fr.md"
    errors = []
    if "\u2014" in content:
        errors.append("use ordinary punctuation instead of an em dash")
    if any(ord(character) < 32 and character not in "\n\r\t" for character in content):
        errors.append("unexpected control character")
    if path.parent == ROOT:
        translations = (path.with_name(english_name), ROOT / "docs/fr" / french_name)
    elif path.parent == ROOT / "docs/fr":
        translations = (ROOT / english_name, path.with_name(french_name))
    else:
        translations = (path.with_name(english_name), path.with_name(french_name))
    for translation in translations:
        target = Path(os.path.relpath(translation, path.parent)).as_posix()
        if not translation.is_file():
            errors.append(f"missing translation: {target}")
        github_target = f"{REPOSITORY}/blob/main/{translation.relative_to(ROOT).as_posix()}"
        if f"]({target})" not in content and f"]({github_target})" not in content:
            errors.append(f"missing language link: {target}")
    outside_code = re.sub(r"```.*?```", "", content, flags=re.S)
    targets = re.findall(r"\]\(([^\s)]+)(?:\s+\"[^\"]*\")?\)", outside_code)
    targets.extend(re.findall(r"^ *\[[^]]+\]: *<?([^\s>]+)>?", outside_code, flags=re.M))
    for target in targets:
        address = urlsplit(target.strip("<>"))
        if address.scheme or target.startswith("//"):
            continue
        destination = path.parent / unquote(address.path) if address.path else path
        if not destination.exists():
            errors.append(f"missing/publicly excluded link target: {target}")
        elif address.fragment and destination.suffix == ".md":
            if unquote(address.fragment) not in anchors(destination):
                errors.append(f"missing anchor: {target}")
    return errors


def main():
    failures = 0
    paths = guides()
    for path in paths:
        for error in check(path):
            print(f"{path.relative_to(ROOT)}: {error}")
            failures += 1
    if failures:
        raise SystemExit(1)
    print(f"Verified {len(paths)} guides: English/French pairs, switches and local links.")


if __name__ == "__main__":
    main()
