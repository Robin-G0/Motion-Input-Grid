# Permissions and data-flow reference

This is an explanation of the manifest actually built by `scripts/build.mjs`, not a request for additional permissions.

| Permission | Code / reason |
|---|---|
| `storage` | `controller.mjs` / `background.mjs`: mode, language, profiles and per-site key preferences in `storage.local`. |
| `activeTab` | Toolbar-triggered access to the selected accessible page, including generic manual controls outside configured services. |
| `scripting` | `background.mjs`: inject packaged `content.js` into the selected tab and accessible frames. |
| `https://*.canva.com/*` | Canva editor/viewer routes and presentation state. |
| `https://gamma.app/*`, `https://*.gamma.app/*` | Gamma editor/presentation routes. |
| `https://docs.google.com/presentation/*` | Google Slides only, not all Google Docs documents. |
| `https://*.officeapps.live.com/*` | Office PowerPoint viewer frames on varying subdomains; runtime accepts PowerPoint-related viewer hosts. |
| `https://*.sharepoint.com/*` | Tenant-specific PowerPoint document presentations; runtime requires a PowerPoint hint in the URL. |
| `https://powerpoint.office.com/*`, `https://powerpoint.cloud.microsoft/*` | PowerPoint web application hosts. |
| `https://onedrive.live.com/*` | PowerPoint document links hosted by OneDrive; runtime filters for PowerPoint hints. |
| Camera browser prompt | `MIGSession.start` requests `getUserMedia({video:…, audio:false})`. No microphone permission; no camera manifest permission is invented. |

There is no `tabs`, `history`, `cookies`, `clipboardRead`, `nativeMessaging`, `<all_urls>` or persistent microphone permission in the manifest. Tab APIs expose only metadata allowed by existing host access/activeTab; available tabs can be shown in the target picker. Content scripts on declared sites can observe presentation state, but background commands require the selected target/session. Their checks inspect local DOM/visibility/fullscreen state; they do not scrape/export presentation documents.

Settings and imported profiles persist locally. Camera pixels, pose results, target-tab identity and presentation-state observations are used locally; there is no publisher endpoint. Synthetic key events may cause the presentation website to perform its own normal navigation/network activity, governed by that site's policy. The Studio link and user-initiated support emails/issues are external activities, separate from extension telemetry (there is none).

Broad Office/SharePoint URL patterns may receive store scrutiny; do not claim they grant access only to `.pptx` files at the manifest level. Their runtime filters narrow use, not the browser's permission prompt. If reviewers require narrower hosts or optional permissions, changing the manifest is a separate product change to implement and test, not a justification to hide the current permission scope.
