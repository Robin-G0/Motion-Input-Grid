#!/usr/bin/env python3
"""Build-time artifact extraction only; the resulting SDK uses no Python runtime."""
import hashlib
import pathlib
import re
import sys
import urllib.request
import zipfile

arguments = [argument for argument in sys.argv[1:] if not argument.startswith("--")]
root = pathlib.Path(arguments[0] if arguments else "build/native-linux-deps").resolve()
# The Heavy pose model is downloaded on demand by the applications; bundle it only when asked.
include_heavy = "--include-heavy" in sys.argv
root.mkdir(parents=True, exist_ok=True)
version = "0.10.35"


def download(url, target, sha256=None):
    target.parent.mkdir(parents=True, exist_ok=True)
    if not target.exists():
        urllib.request.urlretrieve(url, target)
    if sha256 and hashlib.sha256(target.read_bytes()).hexdigest() != sha256:
        raise RuntimeError(f"SHA256 mismatch: {target}")


archive = root / "mediapipe.whl"
download("https://files.pythonhosted.org/packages/32/8f/1bc57dbc9b7b03c8f875aac23380ec57e9002cc02fe6720045fb263f3966/mediapipe-0.10.35-py3-none-manylinux_2_28_x86_64.whl",
         archive, "db9a579df48cffe9570cd3e93f6a5d2dd089a1103b846c60c5b5de8a21c38db0")
with zipfile.ZipFile(archive) as package:
    for member in ["mediapipe/tasks/c/libmediapipe.so",
                   "mediapipe-0.10.35.dist-info/licenses/LICENSE"]:
        (root / pathlib.PurePosixPath(member).name).write_bytes(package.read(member))

pending = ["mediapipe/tasks/c/vision/pose_landmarker/pose_landmarker.h",
           "mediapipe/tasks/c/vision/hand_landmarker/hand_landmarker.h"]
seen = set()
while pending:
    relative = pending.pop()
    if relative in seen:
        continue
    seen.add(relative)
    target = root / "include" / relative
    download(f"https://raw.githubusercontent.com/google-ai-edge/mediapipe/v{version}/{relative}", target)
    pending.extend(re.findall(r'#include\s+"(mediapipe/[^"\r\n]+)"', target.read_text()))
download("https://raw.githubusercontent.com/nlohmann/json/v3.11.3/single_include/nlohmann/json.hpp",
         root / "include/nlohmann/json.hpp",
         "9bea4c8066ef4a1c206b2be5a36302f8926f7fdc6087af5d20b417d0cf103ea6")
download("https://raw.githubusercontent.com/nlohmann/json/v3.11.3/LICENSE.MIT", root / "nlohmann-LICENSE")
for category, variant, digest in [
    ("pose_landmarker", "pose_landmarker_lite", "59929e1d1ee95287735ddd833b19cf4ac46d29bc7afddbbf6753c459690d574a"),
    ("pose_landmarker", "pose_landmarker_full", "5134a3aad27a58b93da0088d431f366da362b44e3ccfbe3462b3827a839011b1"),
    ("hand_landmarker", "hand_landmarker", "fbc2a30080c3c557093b5ddfc334698132eb341044ccee322ccf8bcf3607cde1"),
] + ([("pose_landmarker", "pose_landmarker_heavy", "64437af838a65d18e5ba7a0d39b465540069bc8aae8308de3e318aad31fcbc7b")]
     if include_heavy else []):
    download(f"https://storage.googleapis.com/mediapipe-models/{category}/{variant}/float16/1/{variant}.task",
             root / "models" / f"{variant}.task", digest)
print(f"Linux x86_64 native artifacts ready: {root}")
