# Understand and modify the examples

[English](examples.md) | [Français](examples.fr.md)

<details>
<summary>On this page</summary>

- [Profile and coordinate conventions](#profile-and-coordinate-conventions)
- [Python/Tk and Pygame](#pythontk-and-pygame)
- [SDL2 and SFML](#sdl2-and-sfml)
- [Plain browser, React, Vue and Next.js](#plain-browser-react-vue-and-nextjs)
- [Unity, Godot and Unreal](#unity-godot-and-unreal)
- [Safe customization](#safe-customization)

</details>

To use the libraries without compiling them, install
`python -m pip install motion-input-grid` (Python) or
`npm install motion-input-grid` (browser/React/Vue/Next.js), then run
`npx mig-copy-assets public/mig` for browser assets.
[Python](../../bindings/python/README.md) · [JavaScript](../../bindings/javascript/README.md).

Desktop applications and the Python camera runtime remain separate native
archives; prebuilt examples include their dependencies.

Every camera viewer follows the same sequence:

```text
load profile -> acquire observation -> update MIG -> dispatch actions -> draw
on exit: stop capture and release the tracker before closing the UI
```

UI code never implements a second gesture recognizer.
[Bootstrap](bootstrap.md) lists launch commands and both variants.

> [!TIP]
> **Change the action handler first.** In Python, open `example_usage.py`; in
> SDL2/SFML, open `example_usage.hpp`; in the browser, supply `onAction`.
> The capture and lifecycle details below explain how the rest fits together.

## Profile and coordinate conventions

`examples/common/raised-hands.json` contains two independent wrist paths.
Required regions are green; the terminal Trigger is yellow. Numeric orders
group alternatives for one wrist, not additional simultaneous visits.
Shoulder calibration maps the image to the grid; current shoulder width changes
scale as the user approaches. The full camera frame is fitted without cropping.
Image coordinates are normalized, Y down. Raw body world coordinates are meters
relative to hips, Y down; `WorldHeightUp` access negates Y for upward height.
They are not camera position. Mirror only presentation X (`1-x`).
MIG input mirroring separately swaps anatomy and rules. Never mirror packets.

## Python/Tk and Pygame

`main.py` is the raised-hands entry; `profile.py` calls the same viewer with
`profile_mode=True`. Each folder owns `application.py`, `example_usage.py` and
local `support/` display/resource helpers. `example_usage.py` explicitly imports
installed `mig`, then the packaged binding (checkout fallback only in the repository).
`support/python_runtime.py` resolves
native libraries/models and optional environment overrides. Frozen executables
resolve from their executable's archive folder; Linux restarts once with bundled
library search paths. Bundled Linux fonts use a temporary configuration with
absolute paths; it is removed when the viewer exits. It does not mutate recognition configuration.

### Capture and profile imports

`InputSource` owns a single worker and tracker. It creates native tasks and
opens the camera on that worker, then polls frames. Generated frames are used
only in smoke mode. It copies borrowed pixels before another poll. A latest-frame
mailbox discards obsolete images while keeping bounded accepted events; an import
request is also bounded. UI `take()` consumes the latest snapshot, `notice()`
reports import status. Valid imports recalibrate and adjust hand requests;
invalid imports keep the previous profile. Fatal capture errors reach the UI.
`close()` signals and joins the worker before toolkit shutdown.

`python_view.py` supplies aspect fitting, shoulder-scaled row outlines, colors
and prop geometry. `visible_points`, `hand_lines` and `wrists` mirror image points
for presentation. `handle_detected_actions()` prints all accepted action/ID pairs, including
simultaneous actions, and returns a status string. Change that consumer to invoke
your app; keep the observation conversion intact.

### Rendering and shutdown

Tk's `Application` schedules `tick` every 20 ms. It updates the status, converts
RGB through Pillow, retains `ImageTk.PhotoImage`, then draws dots, finger bones
and wrist props. Its file picker queues import; closing stops the worker before
destroying Tk. Pygame's event loop handles resize, close, drop-file and the import
button. `pygame_view.ActionHud` caches text surfaces and hit rectangles; rendering
uses a 50 Hz limiter. Its picker creates a temporary hidden Tk root and destroys
it even on errors. `finally` closes the source before `pygame.quit()`.

## SDL2 and SFML

Both C++ viewers own their local `support/options.hpp` and `support/source.hpp`.
`main.cpp` calls the visual loop in `application.cpp`; actual MIG calls are in
`example_usage.hpp`, with `load_configuration()`, `initialize_mig()`,
`process_tracking_frame()` and `handle_detected_actions()`.
`demo::Options` resolves runtime/profile with no mandatory launch arguments.
`demo::Source` owns camera/estimator, or generated data for smoke, and keeps
reusable image buffers. `tutorial::load_configuration()` loads the demo or creates the
empty profile variant. `tutorial::process_tracking_frame()` updates the engine once, then reports
every accepted event. `demo::import_profile` validates before replacement and
updates hand capability. File errors leave the running profile unchanged.

### Graphics resources

SDL2 uses RAII for window, renderer, texture and drop-file ownership. The camera
texture is recreated only when dimensions change. Drawing sets an aspect-fitted
viewport and flips the texture once. The event loop exits before another poll
on Close. Its import button and drop-file path call the shared importer.
`ActionHud` owns font/text textures and draws feedback/button bounds.

SFML reuses an RGBA conversion buffer and texture. A negative-X sprite scale
mirrors camera pixels; the shared geometry mirrors dots and props once. The
loop handles Close/import, polls, consumes events, draws and displays. A 50 Hz
limiter avoids spinning; smoke can run headless. Its HUD caches text and bounds.
RAII destructors stop native resources on both normal exit and exceptions.

### Console consumers

SDK consumers demonstrate `find_package`, profile loading and event callbacks.
The positions consumer owns generated landmarks; the native consumer owns RGB
inference. They are contract examples without a camera UI. Their READMEs describe
the command arguments. Reuse a tracker/engine instead of constructing one per frame.

## Plain browser, React, Vue and Next.js

`mig-tracker.mjs` wraps the C ABI in WASM. `packets.mjs` converts model output;
`models.mjs` loads local vision/WASM/model assets and closes a successfully opened
pose task if hand-task creation fails. `overlay.mjs` draws the mirrored body,
fingers and paper-plane props. `session.mjs` is the shared owner, not a component.
Construction is SSR-safe. Initialize loads the engine/profile; Start alone asks
for camera permission and models. Generation guards dispose late async results.
Only new video frames are inferred. Stop releases tracks, Dispose also frees
tasks/engine; invalid bounded JSON imports preserve the old profile. Feedback
retains the latest accepted frame's actions without publishing landmarks into UI
reactive state. `coordinate`/`onFrame` provide imperative coordinate access.

### Views and framework lifecycle

Plain HTML uses `camera.mjs` to connect DOM controls/status to that session.
`index.html` loads the demo, `profile.html` starts empty. React's `src/main.jsx`
mounts `CameraExample.jsx` in StrictMode; `src/example_usage.mjs` imports the public `useMIG` hook, which owns refs/session cleanup and
the latest callback. Vue's `main.mjs` mounts `CameraExample.vue`; its composable
uses shallow state and lifecycle cleanup. Both file inputs pass text to
`importJSON`, show errors and preserve the previous profile. Shared CSS applies
system light/dark and rounded controls; text stays unmirrored.

Next's server routes `/` and `/profile` render the client `CameraExample.jsx`
boundary, which uses its local `app/CameraView.jsx` and styles. Browser URLs are guarded in prerender;
camera/model/WASM work does not execute on the server. `next.config.mjs` exports
static pages. Vite builds both React/Vue entry pages. The small `run.mjs` servers
serve built files on localhost; combined-archive launchers choose bundled Node. Individual browser archives
require installed Node 22.12+ and contain their own `server.mjs`, compiled pages
and local binding dependency for rebuilds.
Replace `onAction` with your application command; do not run inference in renders.
See [adapter setup](../integrations/javascript.md) for complete API snippets.

## Unity, Godot and Unreal

Godot has separate [C#](../../examples/godot/csharp/README.md) and
[GDScript](../../examples/godot/gdscript/README.md) folders. GDScript's small native
GDExtension wraps the same C ABI; its scenes use `submit_frame` and `motion_action`.
Both versions keep recognition in C++ and use supplied landmarks.

All engine components consume supplied packets, not a hidden background camera.
`UseSyntheticDemo` (GDScript: `use_synthetic_demo`) generates a deterministic
raise for wiring checks, including Unreal’s raised-hands component. The generic
component starts empty and imports a profile; the raised-hands subclass loads
the shared sample. `SubmitFrame` updates once, reports every action and optionally
uses wrist world coordinates to move the attached prop. The packet timestamp
and sequence must advance and finger buffers must use the documented layout.

### Engine lifecycle

Unity initializes/disposes in OnEnable/OnDisable, emits a UnityEvent and displays
an import field/status. Godot initializes in _Ready, creates a CanvasLayer panel
and FileDialog, emits MotionAction and disposes in _ExitTree. Godot converts world
Z for its scene convention. The shared C# bridge copies borrowed callback strings
before invoking managed code. Unreal creates/destroys its C handle in BeginPlay/
EndPlay, stages SDK paths in Build.cs, copies events before Blueprint callbacks,
and builds its import/status panel with UMG. Its header declares the Blueprint
event and SubmitFrame contract. Native libraries must match editor/export architecture.
Read each engine README for setup. Editor exports remain Preview and require
validation with your engine version and target platform.

## Safe customization

Change profiles, colors, props and event consumers independently. Keep all native
capture/model calls on their owning thread, never retain borrowed pixels across
polls, and preserve stop/join/dispose ordering. UI import should stay transactional.
The [C API](../reference/c-abi.md), [configuration](../reference/configuration.md) and
[pipeline](../architecture/lifecycle.md) define limits beyond these examples. Synthetic tests do
not prove real-hand accuracy, camera speed or downstream key delivery.

## Individual packages and isolation checks

An individual `*-standalone` archive puts its application, integration source,
configuration, README, runtime and licenses in one folder. Copy that complete
folder outside the repository. Native packages have their own runtime; combined
archives share models and frozen Python dependencies to avoid large duplication.
Browser individual packages require installed Node and include the local npm
binding for optional source rebuilds. Editor archives supply native ABI/bridge
files; Godot archives are complete projects, Unity is a self-contained UPM package,
and Unreal is a plugin for an external C++ project.

Release validation extracts packages into system temporary directories, launches
from their own and unrelated working directories, and checks actions/imports and
cleanup. Browser tests use real WASM with generated observations; they do not
prove camera accuracy. Editor installation/build/export and real hardware still
need the platform verification described in each tutorial.
