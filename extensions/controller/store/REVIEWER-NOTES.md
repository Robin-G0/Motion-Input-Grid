# Reviewer notes — MIG Controller 0.1.0

Publisher: Motion Input Grid. Contact: robin.g0.dev@gmail.com.
Experimental desktop browser extension. No MIG account or payment; a webcam and camera permission are required. Do not enable Android. Camera processing, JavaScript, models and WebAssembly are bundled locally. No native messaging, desktop input injector, analytics, advertisements or remote executable code.

## Account-free review path

The source/submission kit contains `reviewer-demo.html` and `examples/reviewer-profile.json` outside the installable extension. They are review fixtures, not a website contacted by the extension.

```sh
# In the extracted kit, inside the directory containing reviewer-demo.html:
python -m http.server 8765 --bind 127.0.0.1
```

1. Install the extension using the store review environment. Open `http://127.0.0.1:8765/reviewer-demo.html`.
2. Click the extension toolbar icon on that page. Check that its target is the demo tab. Select Normal and Manual, then Start. Approve camera access.
3. Stand/sit facing the camera with both shoulders visible. Allow stable calibration, then follow the animations: your right hand moves from your right to your left for Next; your left hand moves from your left to your right for Previous. The preview is mirrored. Use broad movements and return to the starting/rest position between repetitions.
4. The counter in the demo changes. This exercises actual local camera/model/WASM recognition and the page content script; the demo contains no fake pose detector.
5. Focus the text area in the demo. Recognized input must not navigate the counter while that field is focused. Blur it to resume.
6. Click Change and assign Space to one gesture. It advances the demo counter. Import `examples/reviewer-profile.json` to check movement names/key mappings. Only Once profiles with browser-safe keys are accepted.
7. Stop, close the controller window or move to a different active tab. Verify no page navigation from that session; stop/close releases camera tracks and restores the grey-square icon.

The generic demo validates manual mode. To review automatic mode, use an actual supported presentation service: select its editor tab with the toolbar, choose Automatic, arm it, and enter/leave presentation mode. Google Slides may open a child window; keep the original selected editor as its opener. Canva/Office detection may depend on their viewer DOM/iframes. User-provided presentation accounts can be used; there is no extension login and no reviewer credential is included or required for the local demo.

## Known limitations and actual evidence

- User report received 2026-11-01: Opera + Canva presentation control worked. After leaving/re-entering the camera view, it temporarily stopped responding for a few seconds and resumed. Browser/OS versions, control mode and duration were not supplied. This is not claimed fixed or attributed to a proven cause.
- Hold/Repeat output, text macros, OS hotkeys, desktop PowerPoint and built-in PDF viewers are deliberately excluded.
- Keys are DOM KeyboardEvents with `isTrusted=false`. A service ignoring them can be recognized by host name without being operationally compatible. Firefox/Chrome live SaaS testing and macOS/Linux hardware testing are not represented as completed.
- Leaving the camera view removes reliable observations; show both shoulders and recalibrate if recognition does not recover. The extension does not promise immediate recovery or hardware-independent accuracy.

## Code and generated assets

Read `BUILD-REVIEW.md` in the source archive. Extension-owned sources are readable in `extensions/controller/src/`; there is no first-party minifier. `scripts/build.mjs` generates the platform manifest/icons and copies the npm runtime. `scripts/csp-runtime.mjs` transforms the two dynamic-invoker factory families in the pinned Emscripten glue into static invokers; its input SHA-256 is checked. This transformation is disclosed, not presented as an untouched third-party file.

- MIG npm runtime: `motion-input-grid@1.1.0`, https://www.npmjs.com/package/motion-input-grid/v/1.1.0
- MIG readable sources: https://github.com/Robin-G0/Motion-Input-Grid/tree/v1.1.0 (commit `1c7724896b581894acf6bb55aed654bcb631501a`). Included under `upstream/mig-1.1.0/` in the source archive. Session/tracker/packet/model-loader/overlay JS bytes were compared with that tag.
- Emscripten glue origin: https://github.com/emscripten-core/emscripten/tree/4.0.15 ; static paths in `src/lib/libembind.js` and `src/lib/libemval.js`.
- MediaPipe original runtime: https://registry.npmjs.org/@mediapipe/tasks-vision/-/tasks-vision-0.10.35.tgz ; readable sources: https://github.com/google-ai-edge/mediapipe/tree/v0.10.35 . Exact asset hashes are in `runtime-provenance.json` in the submission kit.
- Pose model: https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task
- Hand model: https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task
- nlohmann/json source: https://github.com/nlohmann/json/tree/v3.11.3 . Runtime license files retain all other notices.

No CDN code is loaded during extension use. The optional Studio link opens the public MIG site in a separate tab; it is not imported as extension code. `wasm-unsafe-eval` permits bundled WASM compilation, not arbitrary remote JavaScript.

Firefox declares no off-device collection/transmission using `data_collection_permissions.required=["none"]`. This is not a claim that camera pixels, target URLs or local settings are never processed locally. Google disclosure guidance includes local handling; use the separate Chrome answers.
