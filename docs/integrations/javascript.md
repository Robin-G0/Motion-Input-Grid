# JavaScript, React, Vue and Next.js bootstrap

[English](javascript.md) | [Français](javascript.fr.md)

<details>
<summary>On this page</summary>

- [Run an example](#run-an-example)
- [Built examples archive](#built-examples-archive)
- [Add MIG to your application](#add-mig-to-your-application)
- [How the code works](#how-the-code-works)

</details>

Motion Input Grid (MIG) browser integrations share the native recognition engine compiled to WASM.
Each framework example has two pages: raised hands with immediate feedback, and
a Motion Input Grid Studio JSON importer showing each accepted action and input identifier.
No new configuration schema or framework-specific recognition logic is added.

## Run an example

**Download a ready-to-run example:** [HTML](https://github.com/Robin-G0/Motion-Input-Grid/releases/tag/v1.1.0#user-content-mig-v1-1-0-web-examples) · [React](https://github.com/Robin-G0/Motion-Input-Grid/releases/tag/v1.1.0#user-content-mig-v1-1-0-react-examples) · [Vue](https://github.com/Robin-G0/Motion-Input-Grid/releases/tag/v1.1.0#user-content-mig-v1-1-0-vue-examples) · [Next.js](https://github.com/Robin-G0/Motion-Input-Grid/releases/tag/v1.1.0#user-content-mig-v1-1-0-next-examples).
Extract it, then run `run.cmd` or `sh run.sh` at its root with Node 22.12+.
Open the displayed URL. The commands below are for source development.

Use Node.js 22.12+ (Node 24 is tested). From the full checkout, first build WASM
as described in [browser integration](../../examples/web/README.md). Then:

```sh
npm ci
npm run prepare:javascript
npm run dev --workspace examples/react
```

Replace `examples/react` with `examples/vue` or `examples/next`. Open the localhost
URL printed by the framework. React/Vue use `/` and `/profile.html`; Next.js uses
`/` and `/profile`. The page links switch between the variants.

Press Start, keep shoulders visible for calibration, lower your hands and raise
either wrist. The shared sample follows four full-width green rows toward a
yellow trigger row. Left/right refer to anatomical hands. The mirrored camera
and moving paper-plane props help you follow the wrists; feedback text stays
unmirrored. The profile variant starts empty: import a saved Motion Input Grid Studio JSON
and perform its motion. Successful imports clear old feedback and recalibrate;
invalid imports show an error while preserving the previous configuration.

## Built examples archive

Archive preparation needs Python 3 (`python` on Windows, `python3` on Linux)
for Node ZIP extraction and the archive writer. Set `MIG_PYTHON` to choose another
Python executable; no Python installation is needed to run compiled browser pages.

```sh
node tools/bootstrap/bootstrap-browser.mjs
node tools/bootstrap/bootstrap-node.mjs
npm run build:examples
npm run package:examples
```

`build/releases/motion-input-grid-1.1.0-javascript-examples.tar.gz` contains source, docs,
compiled React/Vue pages, Next.js static export, WASM, models, licenses and a
SHA256 manifest. Extract it and run one script, with no dependency installation:

```sh
node examples/react/run.mjs
```

Vue and Next.js have the same `run.mjs`. Open `http://localhost:8820`; stop with
Ctrl+C before starting another. Each folder also has `run.cmd` (Windows x64)
and `run.sh` (Linux x64/ARM64), using bundled Node. A modern browser is required.
MediaPipe JS/WASM and models are local; Start needs no CDN download. Browser assets support x64/ARM64 through
the browser's WASM implementation, independently of the native camera SDK.
To edit/rebuild extracted sources, run `npm ci` and `npm run build:examples` in
the archive root. Its packaged runtime supplies the already compiled WASM/models.
The low-level WASM test can use `node tests/bindings/javascript/web_tests.mjs
bindings/javascript/runtime/mig.mjs` there instead of the checkout build path.

## Add MIG to your application

Install the package in your application:

```sh
npm install motion-input-grid
npx mig-copy-assets public/mig
```

The package includes WASM and models; no Emscripten build is needed. As an offline
alternative, install a release `.tgz` with `npm install /path/to/motion-input-grid-1.1.0.tgz`,
then copy its assets with the same command. See the [npm guide](../../bindings/javascript/README.md). React uses:

```jsx
import { useMIG } from 'motion-input-grid/react';

function Camera() {
    const mig = useMIG({
        assetBase: new URL('/mig/', window.location.href).href,
        onAction: ({ action }) => console.log(action)
    });
    return <>
        <button onClick={mig.start}>Start</button>
        <p>{mig.status}</p>
        <video ref={mig.video} muted playsInline />
        <canvas ref={mig.canvas} />
    </>;
}
```

Vue's `useMIG` comes from `motion-input-grid/vue`: destructure `state`, `video`,
`canvas`, `start`, `stop`, `recalibrate` and `importJSON`, attach refs in the
template and show `state.status`/`state.actions`. Pass `profileMode: true` for
an initially empty engine. Import file text with `await importJSON(json)` and
catch validation errors. See the complete components in each example folder.

For Next.js, put the camera in a `'use client'` component. Client components
also prerender on the server, so avoid browser APIs during server rendering.
The supplied component guards URL creation and starts camera/WASM only after a
user click. The React hook creates its session in an effect and releases it on
unmount, including development remounts.
[Next.js client components](https://nextjs.org/docs/app/getting-started/server-and-client-components),
[React effects](https://react.dev/reference/react/useEffect).

## How the code works

`examples/web/session.mjs` owns initialization, model loading, camera tracks,
animation requests, recognition and disposal. Its generation guard rejects
late camera results after stop; disposed sessions close late engines/models.
The tracker validates JSON atomically. `models.mjs` owns MediaPipe setup;
`packets.mjs` copies observations into WASM; `overlay.mjs` draws landmarks/props.
The plain browser example uses the same session.

`bindings/javascript/src/react.mjs` attaches state subscriptions and element
refs through effects. `vue.mjs` uses mount/unmount hooks and a shallow state ref.
Neither runs inference in a render function or puts landmarks into framework
state. One update processes one new video frame, skipping hand inference when
the imported configuration disables it. Only status changes/accepted actions
notify the UI. Call `onAction` to navigate, select or dispatch commands in your
application. These logical callbacks never inject OS keys.

React's `CameraExample.jsx` renders controls, file input, status, feedback and
preview; its two HTML entry points select mode from the URL. Vue's component
has equivalent template controls. Next.js reuses the React component behind
client boundaries and two server page routes, avoiding duplicate recognition
and UI code. Shared CSS mirrors video/canvas once and responds to system theme.
`run.mjs` uses a small localhost static server. Preparation copies canonical
runtime sources and checksummed models into the package and public folders;
packaging includes sources alongside built output.

Verification commands: `npm test`, `npm run build:examples`,
`node tests/bindings/javascript/web_tests.mjs`, `node --experimental-vm-modules tests/bindings/javascript/web_camera_tests.mjs`
and `npm run test:browser` after installing Playwright Chromium (`npx playwright
install chromium`). Set `MIG_BROWSER` to an existing Chromium/Edge executable
instead if desired. Browser tests use real WASM and synthetic observations/
camera streams; they do not establish physical camera or gesture accuracy.
`npm run test:types` checks the published declarations. Builds were checked with
React 19.3, Vue 3.5.43 and Next.js 16.3.8; older peer versions require your own
application verification.
