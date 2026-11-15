"""Run inside Emscripten 4.0.15 with CMake 3.31.10 to rebuild the bundled MIG grid accessor."""
from pathlib import Path
import hashlib
import json
import shutil
import subprocess

extension = Path(__file__).resolve().parents[1]
source_root = extension.parents[1]
upstream = source_root / "upstream/mig-1.1.0"
if not upstream.is_dir():
    upstream = source_root
build = source_root / "build/extension-grid-runtime"
subprocess.run([
    "emcmake", "cmake", "-S", str(upstream), "-B", str(build),
    "-DCMAKE_BUILD_TYPE=Release", "-DMIG_BUILD_WEB=ON", "-DMIG_BUILD_TESTS=OFF",
    "-DMIG_BUILD_CONFIGURATOR=OFF", "-DMIG_BUILD_CONTROLLER=OFF", "-DMIG_INSTALL=OFF",
    "-DCMAKE_EXE_LINKER_FLAGS=-sDYNAMIC_EXECUTION=0",
], check=True)
subprocess.run(["cmake", "--build", str(build), "--parallel", "3"], check=True)
target = extension / "runtime-grid"
target.mkdir(exist_ok=True)


def source_hash(name):
    return hashlib.sha256((upstream / name).read_bytes().replace(b"\r\n", b"\n")).hexdigest()


for name in ("mig.mjs", "mig.wasm"):
    shutil.copyfile(build / "web" / name, target / name)
shutil.copyfile(upstream / "examples/web/mig-tracker.mjs", target / "mig-tracker.mjs")
provenance = {
    "base_release": "MIG 1.1.0", "emscripten": "4.0.15", "cmake": "3.31.10",
    "dynamic_execution": False,
    "change": "Engine-owned grid accessor and cooldown release rearming; explicit duration limits and freshness safeguards retained.",
    "source_normalization": "LF",
    "source_sha256": source_hash("src/web/bindings.cpp"),
    "recognition_sha256": {name: source_hash(name)
                           for name in ("src/core/include/mig/core/engine.hpp", "src/core/src/engine.cpp",
                                        "src/core/src/constraints.cpp")},
    "sha256": {name: hashlib.sha256((target / name).read_bytes()).hexdigest()
               for name in ("mig.mjs", "mig.wasm", "mig-tracker.mjs")},
}
(target / "provenance.json").write_text(json.dumps(provenance, indent=2) + "\n", encoding="utf-8")
print("Rebuilt the engine-owned grid runtime. Run npm run build next.")
