# Rebuild MIG Controller 0.1.0 for source review

This source archive contains readable extension sources at `extensions/controller/`, root license/build files, and the matching MIG runtime source release under `upstream/mig-1.1.0/`. It excludes `.git`, local audit reports, credentials, node_modules and generated dist/build directories. Local additions/modifications needed for this submission are included; the provenance manifest records their hashes, not just a Git HEAD that would omit uncommitted files.

## Reproduce the installable extension files

Requirements: Node.js 24, npm 11, an internet connection for the locked public npm dependencies, and a writable working directory. Windows PowerShell can use `npm.cmd` for each command below. Linux/macOS use `npm`. No compiler or Python is required for this extension build.

```sh
cd extensions/controller
npm ci --ignore-scripts --no-audit --no-fund
npm run build
npm test
npm run lint
npm run package
```

Outputs: `dist/chromium` (Chrome and Opera) and `dist/firefox`. Compare the extracted submitted ZIP with the corresponding output directory file by file using SHA-256; archive timestamps are not a content difference. `file-hashes.json` in the submission kit inventories each submitted file. This extension build copies the public npm runtime, generates manifests and PNG icons, copies privacy/license files and applies `scripts/csp-runtime.mjs`. It does not compile the checkout's C++ or access a CDN during extension execution.

The Chromium ZIP and Opera ZIP are byte-identical copies under different names. Firefox has the event-page background and Mozilla-specific metadata. The `src/_locales` directory contains public descriptions; other UI strings are in `src/copy.mjs`.

## Source and provenance of bundled binaries

The runtime is `motion-input-grid@1.1.0` from the npm lockfile. Its MIG `mig.wasm` bytes remain unchanged. The original generated `mig.mjs` is hash-checked before two dynamic-invoker factory families are replaced with static implementations. `runtime-provenance.json` gives the original/deployed hashes and hashes of all MediaPipe/runtime assets.

Readable MIG sources are supplied from release `v1.1.0` (commit `1c7724896b581894acf6bb55aed654bcb631501a`), not the potentially newer core sources beside the extension. The five public JS runtime sources were compared byte-for-byte with that release. The npm lockfile records the downloaded package's integrity. The review build above reproduces the delivered file tree using those released binaries. The preparation does not assert that the precompiled WASM was independently rebuilt bit-for-bit from C++.

If an independent native-to-WASM rebuild is required, use the included release sources and its original toolchain rather than the current root core:

```sh
cd upstream/mig-1.1.0
# Install/activate Emscripten SDK 4.0.15 (official emsdk instructions).
# Use CMake 3.31.10 as in the release workflow.
cmake -P tools/bootstrap/bootstrap-web.cmake
node tools/bootstrap/bootstrap-browser.mjs
emcmake cmake -S . -B build/web -DMIG_BUILD_WEB=ON -DMIG_BUILD_TESTS=OFF -DMIG_BUILD_CONTROLLER=OFF -DMIG_BUILD_CONFIGURATOR=OFF
cmake --build build/web --parallel 2
# Output: build/web/web/mig.mjs and mig.wasm.
```

Toolchain source: https://github.com/emscripten-core/emsdk and https://github.com/emscripten-core/emscripten/tree/4.0.15 . MediaPipe 0.10.35 sources and released runtime/model URLs are listed in `extensions/controller/store/REVIEWER-NOTES.md`. All executable assets are local in the installable archive; build-time downloads are separate from runtime networking. Third-party MediaPipe WASM is an unmodified released dependency; readable upstream sources are linked by release tag.

## Reproduce the submission kit (optional, not needed to build the extension)

With Python 3 and either Playwright Chromium (`npx playwright install chromium`) or Microsoft Edge installed:

```sh
cd extensions/controller
npm run prepare:stores
```

That creates `dist/store-submission/mig-controller-0.1.0/`. Generating another upstream source archive requires the Git tag to be present; inside this extracted source package the prepared `upstream/mig-1.1.0/` directory is used as fallback. No screenshot of the product is generated. SVG promotional artwork is rendered locally with Playwright.
