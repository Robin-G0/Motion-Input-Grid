# MIG Controller privacy notice

[English](PRIVACY.md) | [Français](PRIVACY.fr.md)

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
are used locally to identify the site; presentation text and browsing history are
not collected or uploaded. Commands are ignored while a text field is focused.

Opening the optional Studio link navigates to the public MIG website, governed by
that website's behavior. Installing/updating through a browser store is handled by
the browser and the store. The extension does not require a MIG account.

For questions or privacy bugs, use the project's
[issue tracker](https://github.com/Robin-G0/Motion-Input-Grid/issues).
