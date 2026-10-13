# Python / Tkinter: camera and logical actions

[English](README.md) | [Français](README.fr.md)

**Download this example:** [Windows x64 (zip)](https://github.com/Robin-G0/Motion-Input-Grid/releases/tag/v1.1.0#user-content-python-tkinter-examples) · [Linux x64 (tar.gz)](https://github.com/Robin-G0/Motion-Input-Grid/releases/tag/v1.1.0#user-content-python-tkinter-examples).

## What this example demonstrates

A mirrored camera preview, finger outlines and wrist-following props show two
logical actions: **Left hand raised!** and **Right hand raised!**. The second
executable imports your own Motion Input Grid Studio JSON and displays its action names.

## Quick Start — prebuilt package

1. Extract this example's `*-python-tkinter-standalone` archive.
2. In the extracted folder, run `main.exe` on Windows or `./main` on Linux.
3. Keep both shoulders visible for calibration; lower your hands into green,
   then raise either wrist into yellow. Watch the action panel.
4. Close the window to release the camera. Run `profile.exe / ./profile` to import JSON.

Allow about 30–60 seconds with prerequisites installed; model loading depends
on hardware. These commands also work inside the combined archive's example folder.

## Folder walkthrough

| File or directory | Purpose |
| --- | --- |
| `main.py / profile.py` | Small application entry point; selects demo or import mode. |
| `example_usage.py` | Actual MIG initialization, recognition and action handling. |
| `application.py` | Window, input events, rendering and processing loop. |
| `configuration/raised-hands.json` | Local schema-v2 two-wrist profile. |
| `support/` | Resource lookup and display helpers; source is included locally. |
| `requirements.txt` | Dependencies for editing/running Python sources. |
| `viewer.runtime/` | Prebuilt package: shared Python, Tk/Pillow/Pygame dependencies for both variants. |
| `bindings/python/mig/` | Individual package: bundled Python MIG binding fallback. |

## Code walkthrough

1. `example_usage.py` explicitly imports `mig`, preferring an installation and
   then the packaged binding. `parse_options()` selects the local configuration.
2. `InputSource._run()` calls `load_configuration()` and `initialize_mig()` on its
   worker. `mig.Tracker(library, json)` validates the profile and owns the engine.
3. `start_tracking_camera()` calls `tracker.start_camera(runtime, camera_index)`.
4. `process_tracking_frame()` calls `poll_camera()` then `events()`. Camera polling
   already performs recognition; host/synthetic packets instead use `update(packet)`.
5. `_publish()` copies images/actions into a one-frame mailbox. The GUI calls
   `handle_detected_actions()` to display logical tuples.
6. `_import_pending()` validates imports on the same worker, with a 1 MiB limit.
7. `InputSource.close()` signals and joins the worker. Exiting the tracker context
   calls `close()` even on errors, before the application destroys its window.

## Dependencies and runtime placement

Bundled release dependencies: Python, Tk, Pillow, Pygame where applicable, the
MIG C ABI, MediaPipe, Lite pose/hand models and licenses. Keep `viewer.runtime/`
beside both executables. Individual packages have `runtime/` inside this folder;
combined archives share `runtime/` at their root. A manifest determines resource
lookup; the current working directory is irrelevant. No Python installation is
needed for the prebuilt executable.

External: Windows x64 with the VC++ runtime, or Linux x64 with glibc 2.35+ and a
desktop display. A webcam is needed for real tracking. Optional: Python 3.10+
and a camera-enabled MIG SDK to edit/run sources.

## Run or rebuild sources outside the repository

Copy this folder, install the wheel and local requirements, and point at a
camera-enabled SDK (the normal wheel alone provides positions recognition):

```sh
python -m pip install motion-input-grid -r requirements.txt
# Linux: install python3-tk and python3-pil.imagetk if Tk/Pillow Tk support is absent.
# Set MIG_LIBRARY to the camera-enabled SDK mig-c.dll / libmig-c.so.1.
# Set MIG_RUNTIME to the SDK directory containing libmediapipe and models/.
python main.py
python profile.py
```

`python main.py --smoke` generates deterministic observations and exits; this
checks action dispatch and shutdown, not camera accuracy. Pygame uses Tk for
the import file picker; drag-and-drop JSON is also supported.

## Configuration and reuse

The raised-hands profile has a broad Required region `[-9,3,27,3]`, followed by
a Trigger region `[-9,1,27,2]` for each wrist. Starting only in yellow cannot
trigger the upward path. Import mode starts without rules; invalid JSON keeps
the previous configuration, while a valid import resets calibration.

Copy the named integration file and configuration into your application. Replace
the action callback with your game command. Feed unmirrored MediaPipe-indexed
observations with their original aspect, increasing sequence and monotonic time;
submit one update per fresh frame and missing observations on tracking loss.
The preview, wrist props and action panel are optional presentation code.
Keep each tracker on one owning thread and preserve its cleanup lifecycle.
Actions stay in the application; these examples never inject desktop keys.

## Troubleshooting

- Missing library/model: retain the complete extracted folder. Source folders
  require the dependencies and setup below; they do not contain release binaries.
- Camera busy: close other camera applications and grant camera permission.
- No action: keep both shoulders visible until calibrated, lower the wrists, then
  raise through green into yellow. Samples more than 180 ms apart need profiling.
- Import rejected: fix the reported schema error; the previous rules still run.
- Closing waits for any in-flight inference before releasing the tracker.
