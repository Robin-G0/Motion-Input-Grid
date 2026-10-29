# MIG Controller browser extension

[English](README.md) | [Français](README.fr.md)

Control a presentation with wide, deliberate wrist movements. This extension
runs MIG locally and sends page keyboard events to **one selected browser tab**.
It does not send OS keys or communicate with the desktop Controller.

> [!IMPORTANT]
> **Initial version, test before presenting.** Installed-extension flows are tested
> with controlled presentation pages. Real Canva, Gamma, Google Slides and PowerPoint
> accounts, Opera and physical webcam gesture accuracy still need manual verification.
> Some viewers ignore synthetic keyboard events; the extension cannot manufacture
> trusted hardware events or trigger browser/system shortcuts.

## Build and install for testing

Requires Node 24 and npm. From this directory:

```sh
npm ci --ignore-scripts
npm run build
npm test
npm run lint
npm run package
```

| Browser | Temporary installation |
| --- | --- |
| Chrome / Chromium | Open `chrome://extensions`, enable developer mode, load unpacked `dist/chromium` |
| Opera | Open `opera://extensions`, enable developer mode, load unpacked `dist/chromium` |
| Firefox 142+ | Open `about:debugging#/runtime/this-firefox`, load temporary add-on, select `dist/firefox/manifest.json` |

Firefox temporary installation lasts until restart. Permanent installation needs
Mozilla signing. ZIPs for store review are generated in `dist/packages`; they are
**unsigned and unpublished**. Chromium requires version 121 or newer.

## First presentation

1. Open the presentation, then click the **MIG Controller** toolbar icon.
2. Check the selected target tab and detected site. Unknown pages use generic arrows.
3. Choose **Normal**, **Reversed** or import your JSON profile. Animated diagrams
   show the two presets' gestures. Click **Change** and press the new key; Escape cancels.
4. Choose **Manual**, then **Start**, or choose **Automatic** and explicitly enable it.
   Allow camera access, keep both shoulders visible and calibrate in your presenting position.
5. Make one wide sweep, then return to rest. The grey square becomes a red circle
   only while the camera is running. **Stop** disables automatic mode too.

Keep the control window open; closing it releases the camera. A packaged worker
drives frame processing independently of window rendering. Minimized-window
recognition is included in Chromium tests.

> [!TIP]
> The normal preset maps **your right hand moving right → left** to Right Arrow,
> and **your left hand moving left → right** to Left Arrow. Reversed swaps their keys.
> The preview is mirrored. Regions follow your shoulders and leave a wide gap to
> avoid conversational movements. Return to the starting side to rearm.

## Detected sites

| Site | Default keys | Automatic presentation signals |
| --- | --- | --- |
| Canva | Right / Left | Fullscreen or a visible presentation player |
| Gamma | Right / Left | `mode=present`, fullscreen or a visible presentation player |
| Google Slides | Right / Left | `/present`, `/preview` or fullscreen; follows a same-site child presentation window opened by the selected editor |
| PowerPoint web | Right / Left | Slideshow/reading viewer, visible player or fullscreen; observes permitted Office frames |
| Other accessible web pages | Right / Left | Use manual mode |

The arrow commands are intended to behave like a remote, allowing the viewer to
advance its current animation before the next slide. DOM/player signals are
best-effort and can change with the services. Use manual mode if automatic mode
does not recognize your viewer. Built-in PDF viewers and desktop apps are excluded.
Text inputs, hidden/discarded tabs and unrelated tabs do not receive commands.

## Custom profiles

The Studio link appears **above import**. Import a schema-v2 JSON profile with
keys assigned in **Once** mode. The list displays **movement name → key(s)**.
Keys can be rebound locally without changing the original JSON file.

The import is bounded to 1 MiB / 64 movements / 16 key steps per movement and
validated by the real WASM parser before replacing the current profile.
Windows/Command, Alt, function/browser-control shortcuts and text macros are
rejected. Plain letters, digits, arrows, navigation keys, Shift combinations and
selected Ctrl editing combinations are supported as page events. Ctrl+C, for
example, is delivered to page handlers; it does not invoke the browser's native copy.
Repeat/Hold profiles must first be changed to Once in Studio.

## Validation and store review

```sh
npx playwright install chromium firefox
npm run test:browser
npm run test:firefox
```

Chromium tests load the installed extension, check real packaged model/camera
startup, real WASM gesture-to-page-key delivery, protected text fields, key rebinding,
import rejection, child windows, automatic lifecycle and toolbar state. Only
gesture inference is substituted in deterministic gesture tests. Firefox smoke
testing temporarily installs the extension in a fresh headless profile and checks
CSP, worker startup, WASM, real models, camera and track cleanup.

The extension has a [separate CI category](../../.github/workflows/extensions.yml).
Extension changes do not rebuild the website or native SDKs. It consumes the pinned
published runtime. `web-ext lint` has no errors; bundled MediaPipe/runtime dynamic
imports may produce review warnings. They resolve only packaged assets, not CDN code.

Before store submission, complete the real-service checklist above, prepare genuine
screenshots and localized descriptions, publish the [privacy notice](PRIVACY.md),
review host permissions and supply reviewer reproduction steps. Accounts, signing,
store submission and publication remain manual. Store acceptance is not guaranteed.

The source and lockfile reproduce the packages. The hash-checked CSP transformation
and [third-party notices](src/THIRD-PARTY-NOTICES.md) document the bundled runtime.
