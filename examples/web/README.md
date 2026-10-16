# Web camera tutorial

[English](README.md) | [Français](README.fr.md)

[**Download this example**](https://github.com/Robin-G0/Motion-Input-Grid/releases/tag/v1.1.0#user-content-mig-v1-1-0-web-examples) (tar.gz).

## What this example demonstrates

Raise either wrist through the green region into yellow to receive
**Left/Right hand raised!**. The profile page imports Motion Input Grid Studio JSON and
displays logical action/input IDs. Actions stay in your application.

## Quick Start

1. Extract `*-browser-web-standalone.tar.gz`. Have Node.js 22.12+ and
   a modern browser installed; Linux and Windows are supported by this server.
2. Run `node run.mjs` in this folder, or use `run.cmd` / `sh run.sh`.
3. Open `http://localhost:8820`, click **Start camera**, and grant camera permission.
4. Keep both shoulders visible, lower your hands into green, then raise into yellow.
5. Visit `/profile.html` to import JSON; click Stop and use Ctrl+C to stop the server.

> [!TIP]
> **To try the built archive, use `run.cmd` or `sh run.sh` directly.**
> Models, WASM and MediaPipe are local; no npm install or CDN is needed.
> Individual archives still need Node.js 22.12+; the combined archive supplies Node.

Allow 30–60 seconds with prerequisites installed; model loading depends on hardware.

## Folder walkthrough

| File/directory | Purpose |
| --- | --- |
| `index.html / profile.html` | Application entry and raised-hands/import mode selection. |
| `mig-tracker.mjs` | MIG integration and action callback; start studying here. |
| `camera.mjs` | Controls, video/canvas refs and visible action feedback. |
| `run.mjs`, `server.mjs` | Localhost static server; resolves files relative to this folder. |
| `run.cmd`, `run.sh` | Release launchers; independent of the working directory. |
| `./` | Release HTML/CSS/JS and local MIG assets (web uses this folder itself). |
| `default.json` or `./mig/default.json` | Schema-v2 two-wrist demo profile. |
| `models/`, `vision/` or `./mig/` | Local pose/hand models, Vision runtime and MIG WASM. |
| `licenses/`, `LICENSE` | Redistribution notices in the release. |
| `style.css` | Mirrored preview and unmirrored text panel. |

## Code walkthrough

1. `mig-tracker.mjs` imports `createMIG` from the local `mig.mjs` WASM loader.
   `MIGTracker.create(json)` constructs the native tracker and validates JSON.
2. `session.mjs`, `MIGSession.createTracker()`, fetches local `default.json`.
   `camera.mjs` constructs a session and supplies its application callbacks.
3. Start calls `session.start(video, canvas)` after a click. `models.mjs` loads
   local MediaPipe tasks; `session.mjs` obtains a camera stream and infers fresh frames.
4. `MIGTracker.update(pose, hands, timestampMs, aspect, onAction)` uses
   `packets.mjs` to copy unmirrored results, then calls native `update()` once.
5. It copies `eventAction()` and `eventId()` before callbacks. `camera.mjs`
   logs the action, dispatches `mig-action` and updates the text panel.
6. The profile input reads at most 1 MiB, then calls `session.importJSON(text)`.
   Invalid imports retain the previous rules; valid imports recalibrate.
7. Stop releases stream tracks. Page teardown calls `session.dispose()` to
   close models and delete the WASM tracker, including partial startup failures.

`coordinate(15, 2)` supplies optional world wrist XYZ in metres, Y up. Missing
world observations return no coordinate. Feed empty detection results on loss
and reacquire WASM buffer views after importing a profile. `active(index)` supports
held commands; your application schedules Hold/Repeat behavior.

## Dependencies and source rebuild

External runtime prerequisites: Node.js 22.12+, modern browser and webcam with
camera permission. Optional development dependencies: npm plus the framework
versions in `package.json`. `session.mjs`, `packets.mjs`, `models.mjs` and `overlay.mjs` are local
source modules: camera ownership, observation conversion, model loading and drawing.

Copy this folder outside the repository, then use these commands to edit/rebuild:

```sh
npm install motion-input-grid
npx mig-copy-assets .
node run.mjs
```

For plain web, `mig-copy-assets .` installs runtime assets without replacing HTML
or `camera.mjs`. For frameworks the copied `public/mig/` assets enter `./mig/`
during build. Source builds take longer than the prebuilt trial. No C++ compiler
is needed when using the npm binding. Keep the generated output and its assets together.

## Reuse and troubleshooting

Start with `mig-tracker.mjs` and the profile. Replace the named action callback;
the DOM/component styles and paper-plane props are optional. Keep observation
anatomy unmirrored, aspect correct, timestamp monotonic and sequence increasing.
Mirror only presentation. Rules require starting in green; standing in yellow
alone does not fire. Intervals over 180 ms need hardware profiling.

- Camera permission requires localhost or HTTPS, not `file://`.
- Missing assets: retain all model/WASM folders; source builds need the asset copy step.
- Port 8820 occupied: stop the other example server before starting this one.
- Import error: fix the displayed schema error; the old configuration still runs.
- Preview integrations and synthetic tests do not establish webcam accuracy.

[Public JavaScript API](../../bindings/javascript/README.md) ·
[Configuration](../../docs/reference/configuration.md).
