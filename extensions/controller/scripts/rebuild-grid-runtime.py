"""Run inside Emscripten 4.0.15 with CMake 3.31.10 to rebuild the bundled MIG grid accessor."""
from pathlib import Path
import hashlib
import json
import shutil
import subprocess

extension = Path(__file__).resolve().parents[1]
source_root = extension.parents[1]
upstream = source_root / "upstream/mig-1.1.0"
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
for name in ("mig.mjs", "mig.wasm"):
    shutil.copyfile(build / "web" / name, target / name)
shutil.copyfile(upstream / "examples/web/mig-tracker.mjs", target / "mig-tracker.mjs")
provenance = {
    "base_release": "MIG 1.1.0", "emscripten": "4.0.15", "cmake": "3.31.10",
    "dynamic_execution": False,
    "change": "Read-only grid accessor in src/web/bindings.cpp; recognition sources unchanged.",
    "source_sha256": hashlib.sha256((upstream / "src/web/bindings.cpp").read_bytes()).hexdigest(),
    "sha256": {name: hashlib.sha256((target / name).read_bytes()).hexdigest()
               for name in ("mig.mjs", "mig.wasm", "mig-tracker.mjs")},
}
(target / "provenance.json").write_text(json.dumps(provenance, indent=2) + "\n", encoding="utf-8")
print("Rebuilt the engine-owned grid runtime. Run npm run build next.")
