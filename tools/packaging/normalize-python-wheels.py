"""Normalize and verify wheel RECORD files after build or auditwheel repair."""
import argparse
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "lib"))
from wheel_record import normalize_wheel


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("wheels", type=Path, nargs="+")
    for wheel in parser.parse_args().wheels:
        normalize_wheel(wheel)
        print(f"Normalized and verified {wheel.name}")
