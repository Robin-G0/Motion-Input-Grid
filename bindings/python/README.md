# Motion Input Grid (MIG) Python package

[English](https://github.com/Robin-G0/Motion-Input-Grid/blob/main/bindings/python/README.md) | [Français](https://github.com/Robin-G0/Motion-Input-Grid/blob/main/bindings/python/README.fr.md)

## Install from PyPI

```sh
python -m pip install motion-input-grid
python -c "from mig import Tracker; print('MIG OK')"
```

The distribution name is `motion-input-grid`; the import remains `mig`.
Prefer a Python 3.10+ virtual environment. Wheels cover Windows x64 and
Linux x64/ARM64 with glibc 2.35+. On other platforms, pip may build the
sdist, requiring a C++20 compiler and CMake 3.25+. To select a version:
`python -m pip install motion-input-grid==1.0.2`.

Local alternative: `python -m pip install /path/to/motion_input_grid-1.0.2-<tags>.whl`.
To build from a full checkout: `python -m pip install ./bindings/python`.

## Submit observations

Save a Motion Input Grid Studio profile as `profile.json`. Pass `None` to select the bundled
engine or an explicit path to an external SDK. This example submits **one frame**;
your application should feed the tracker each new observation. One frame alone
does not calibrate or complete a movement.

Python accesses the C++ engine through standard-library ctypes; no Python
inference dependency is required. Wheels include the positions C ABI and
licenses: `mig-c.dll` on Windows, `libmig-c.so.1` on Linux. No camera estimator
or models are included. The sdist contains the canonical engine and JSON headers;
rebuilding requires CMake 3.25+ and a C++20 compiler. Linux builds use GCC and
its runtime copyright notices.

```python
from pathlib import Path
from mig import Packet, Tracker

profile = Path("profile.json").read_text(encoding="utf-8")
with Tracker(None, profile) as tracker:
    frame = Packet(timestamp_ms=20, sequence=1, aspect=16 / 9)
    frame.set_body(11, 0.65, 0.45)
    frame.set_body(12, 0.35, 0.45)
    frame.set_body(15, 0.4, 0.6)
    for action, input_id in tracker.update(frame):
        print(action, input_id)
```

## Lifecycle and camera

Use increasing timestamps in milliseconds and increasing sequence numbers.
Calibration requires roughly one second with both shoulders visible.
Positions use unmirrored anatomical MediaPipe indices; missing points have zero
confidence. Keep each tracker on one owning thread and close it explicitly.

`start_camera(runtime_directory)` and `poll_camera()` optionally use a native
camera-enabled SDK plus its MediaPipe runtime and models. Poll already updates
recognition; consume `events()` afterward without submitting the frame twice.
Action callbacks are logical events; keyboard injection is the host's choice.

See the repository's [examples](https://github.com/Robin-G0/Motion-Input-Grid/tree/main/examples)
and [ABI contract](https://github.com/Robin-G0/Motion-Input-Grid/blob/main/docs/reference/c-abi.md) for body
and hand XYZ packets, capture ownership, Pygame and Tkinter integration.

[Complete source walkthrough](https://github.com/Robin-G0/Motion-Input-Grid/blob/main/docs/getting-started/examples.md) · [Bootstrap](https://github.com/Robin-G0/Motion-Input-Grid/blob/main/docs/getting-started/bootstrap.md).
