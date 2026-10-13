# Motion Input Grid (MIG) Unreal runtime plugin

[English](README.md) | [Français](README.fr.md)

**Download the integration:** [Windows x64 (zip)](https://github.com/Robin-G0/Motion-Input-Grid/releases/tag/v1.1.0#user-content-mig-v1-1-0-unreal-integration) · [Linux x64 (zip)](https://github.com/Robin-G0/Motion-Input-Grid/releases/tag/v1.1.0#user-content-mig-v1-1-0-unreal-integration) · [Linux ARM64 (zip)](https://github.com/Robin-G0/Motion-Input-Grid/releases/tag/v1.1.0#user-content-mig-v1-1-0-unreal-integration).

**Preview.** Editor/player export and live-provider validation remain required. See the [support matrix](../../docs/reference/support.md).

Extract the matching `motion-input-grid-<version>-<platform>-unreal.zip` into your project's
`Plugins` directory. Enable **Motion Input Grid**, rebuild your C++ project, then
add `UMIGTrackerComponent` to an actor. The plugin contains runtime wrapper
sources, the C ABI header, its platform library/import library and licenses.
It targets Unreal Engine 5 desktop Windows/Linux, including Linux ARM64 packages.
Editor compilation and exported games require verification in your engine version.

Call `ImportJson` before submitting observations. `SubmitFrame(const mig_packet&)`
accepts anatomical landmark packets on the game thread; `OnAction` broadcasts
copied action/input strings so callbacks can import/reset/close safely. `IsActive`,
`Reset` and `Close` expose the C ABI lifecycle. Invalid imports preserve the old
configuration; failed updates return false. Recognition stays in MIG's C++ engine.

The `ThirdParty` payload is generated from an installed SDK. It contains no
estimator, static engine copies, UI demo or camera models. Windows requires the
matching VC++ runtime. Supply your own landmark provider. Use the archive matching
your target; combine separately built platform payloads before a multi-platform
game export. The [Unreal demos](../../examples/unreal/README.md) remain separate.

[Distribution](../../docs/getting-started/packages.md) · [C ABI packet layout](../../docs/reference/c-abi.md).
