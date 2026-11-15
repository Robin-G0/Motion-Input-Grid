# MIG Controller store submission kit

[English](README.md) | [Français](README.fr.md)

Publisher: **Motion Input Grid**, public support: **robin.g0.dev@gmail.com**.
Prepared on **1 November 2026**. This workflow builds local files only; it does not
submit, sign, deploy, commit or push.

From `extensions/controller`, with Node 24/npm 11, Python 3 and Playwright Chromium
or Microsoft Edge installed:

```sh
npm ci --ignore-scripts
# If neither Playwright Chromium nor Edge is installed:
npx playwright install chromium
npm run prepare:stores
```

Open `dist/store-submission/mig-controller-0.1.0/`:

| Store | Installable upload | Metadata |
|---|---|---|
| Chrome | `chrome/mig-controller-chrome-0.1.0.zip` | `CHROME.md`, `listing.json`, localized listings |
| Firefox | `firefox/mig-controller-firefox-0.1.0.zip` | `FIREFOX.md`, plus the matching `mig-controller-sources-0.1.0.zip` as source code |
| Opera | `opera/mig-controller-opera-0.1.0.zip` | `OPERA.md`; submit as an extension, not a theme or GX mod |

Icons and promotional artwork are in `assets/`. The ready-to-host privacy document
is `privacy/index.html`. Hash inventories are `SHA256SUMS`, `file-hashes.json` and
`runtime-provenance.json`. `VALIDATION.json` records the isolated source rebuild.
The source-archive rebuild reuses the installed locked npm dependency; it is not
an independent recompilation of the native WASM. Read `BUILD-REVIEW.md` for both paths.

The source extraction, icon sizes, localized description limits, license files,
ZIP file trees and unchanged WASM are checked. No product screenshots are generated;
the promotional image is vector artwork, not a picture of the actual interface.

Before submission, the publisher must supply real screenshots, publish and verify
the privacy URL, complete developer-account/identity requirements and dashboard
certifications, and perform the remaining manual release checks. The privacy page
is prepared at `site/privacy/controller/index.html`; its expected URL is
`https://robin-g0.github.io/Motion-Input-Grid/privacy/controller/` after deployment.
Preparing the file does not mean it is publicly deployed. The per-store documents
link to official requirements and distinguish local data handling from off-device
transmission. Do not certify that no data is handled just because nothing is uploaded.

The reported Opera + Canva success and temporary tracking-recovery delay are kept
in `MANUAL-TESTS.md`; other browser/service combinations are not declared manually
verified. Existing store versions must use a higher version on a future update.
Store acceptance is not guaranteed by this kit or local lint results.
