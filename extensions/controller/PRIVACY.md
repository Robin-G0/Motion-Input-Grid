# MIG Controller privacy notice

[English](PRIVACY.md) | [Français](PRIVACY.fr.md)

Publisher: **Motion Input Grid**. Last updated: **1 November 2026**.

MIG Controller processes the camera video **on your device** to recognize movements.
It does not record video, upload video or landmark positions, or send telemetry.
Its JavaScript, WebAssembly and recognition models are packaged with the extension.

Camera access starts after you explicitly enable manual or automatic control and
grant the browser permission. Automatic mode follows the selected presentation.
Stop or close the controller window to release the camera. The toolbar shows a
red circle while the camera is active, and a grey square when inactive.

Settings, imported profiles, language and key assignments are saved in the browser's
local extension storage. Uninstalling the extension removes that storage. You can
also clear extension data using your browser. The extension does not use cloud sync.

Host permissions allow the supported presentation sites to report presentation
state and receive page keyboard events. Other accessible pages use the temporary
access granted when you click the extension icon. The selected tab's URL/title
are used locally to identify the site and available accessible tabs can be shown
in the target picker. Content scripts check local URL, DOM, visibility and
fullscreen state; these checks do not export presentation documents or create a
persistent browsing-history log. None of these data is uploaded to the publisher.
Commands are ignored while a recognized text field is focused.

Camera pixels and derived positions are processed in memory for movement recognition,
not identification of people. No video recording, analytics, advertising, data sale
or publisher-operated server is used. Local settings/profiles persist until cleared
or removed; observations are not saved as recordings. Websites may perform their own
normal requests in response to page commands, under their own policies.

Opening the optional Studio link navigates to the public MIG website, governed by
that website's behavior. Installing/updating through a browser store is handled by
the browser and the store. The extension does not require a MIG account.

For questions, deletion requests concerning a support conversation or privacy bugs,
contact **robin.g0.dev@gmail.com** or use the project's
[issue tracker](https://github.com/Robin-G0/Motion-Input-Grid/issues).
Contacting support voluntarily sends the information you include through your email
provider or GitHub; it is used to answer your request. Do not post camera images or
private presentation content in public issues. The publisher cannot access or delete
your extension's local profiles remotely: clear extension data in your browser.
