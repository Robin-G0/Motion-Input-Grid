# Vue camera tutorial

[English](README.md) | [Français](README.fr.md)

[**Download this example**](https://github.com/Robin-G0/Motion-Input-Grid/releases/tag/v1.1.0#user-content-mig-v1-1-0-vue-examples) (tar.gz).

## What this example demonstrates

Raise either wrist through the green region into yellow to receive
**Left/Right hand raised!**. The profile page imports Motion Input Grid Studio JSON and
displays logical action/input IDs. Actions stay in your application.

## Quick Start

1. Extract `*-browser-vue-standalone.tar.gz`. Have Node.js 22.12+ and
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
| `src/main.mjs` | Application entry and raised-hands/import mode selection. |
| `src/example_usage.mjs` | MIG integration and action callback; start studying here. |
| `src/CameraExample.vue` | Controls, video/canvas refs and visible action feedback. |
| `run.mjs`, `server.mjs` | Localhost static server; resolves files relative to this folder. |
| `run.cmd`, `run.sh` | Release launchers; independent of the working directory. |
| `dist/` | Release HTML/CSS/JS and local MIG assets (web uses this folder itself). |
| `default.json` or `dist/mig/default.json` | Schema-v2 two-wrist demo profile. |
| `models/`, `vision/` or `dist/mig/` | Local pose/hand models, Vision runtime and MIG WASM. |
| `licenses/`, `LICENSE` | Redistribution notices in the release. |
| `vite.config.mjs`, `index.html`, `profile.html` | Build both entry pages. |
| `src/style.css` | Rounded controls, light/dark theme and mirrored preview. |

## Code walkthrough

1. `src/example_usage.mjs` imports `useMIG` from `motion-input-grid/vue`.
   `useMotionInput(profileMode)` supplies local asset URLs and `handleDetectedAction`.
2. The public composable creates its session during setup.
   `assetBase` contains `default.json`, `mig.mjs`, `mig.wasm`, `vision/` and `models/`.
   Import mode starts empty. Camera/model work starts only after a user click.
3. `src/CameraExample.vue` connects video/canvas refs and calls `start()`, `stop()` and `recalibrate()`.
4. The binding's `runtime/session.mjs` owns acquisition; `runtime/mig-tracker.mjs`,
   `MIGTracker.update()`, copies observations and retrieves each action/ID once per
   fresh frame. These readable files are included in the bundled dependency.
5. `handleDetectedAction(event)` receives copied logical strings. Replace its
   logging with a game command. Reactive action snapshots drive the visible panel.
6. `importProfile()` bounds JSON to 1 MiB and calls `importJSON(text)`; validation
   preserves the old profile on failure and recalibrates on success.
7. Vue unmount disposes the session automatically.
   Stop releases camera tracks; disposal also closes model tasks and WASM.

Keep inference outside reactive render/update functions; one owning session processes fresh video frames.

## Dependencies and source rebuild

External runtime prerequisites: Node.js 22.12+, modern browser and webcam with
camera permission. Optional development dependencies: npm plus the framework
versions in `package.json`. `dependencies/motion-input-grid/` in the individual archive contains the
public binding and its readable `src/` and `runtime/` modules. `package.json`
uses this local package for source rebuilds; raw source folders use the published npm package.

Copy this folder outside the repository, then use these commands to edit/rebuild:

```sh
npm install
npx mig-copy-assets public/mig
npm run build
node run.mjs
```

For plain web, `mig-copy-assets .` installs runtime assets without replacing HTML
or `camera.mjs`. For frameworks the copied `public/mig/` assets enter `dist/mig/`
during build. Source builds take longer than the prebuilt trial. No C++ compiler
is needed when using the npm binding. Keep the generated output and its assets together.

## Reuse and troubleshooting

Start with `src/example_usage.mjs` and the profile. Replace the named action callback;
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
