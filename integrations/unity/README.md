# Motion Input Grid (MIG) Unity UPM package

[English](README.md) | [Français](README.fr.md)

**Download the integration:** [Windows x64 (tgz)](https://github.com/Robin-G0/Motion-Input-Grid/releases/tag/v1.1.0#user-content-mig-v1-1-0-unity-integration) · [Linux x64 (tgz)](https://github.com/Robin-G0/Motion-Input-Grid/releases/tag/v1.1.0#user-content-mig-v1-1-0-unity-integration).

> [!IMPORTANT]
> **Preview runtime package; supply your own camera/landmark provider.** For a first trial,
> use the [Unity demos](../../examples/unity/README.md) and their synthetic mode.
> Verify your editor, real provider and exports: [support matrix](../../docs/reference/support.md).

Use Unity 2021.3+ on Windows/Linux x64. In Package Manager choose **Add package
from tarball** and select the matching `motion-input-grid-<version>-<platform>-unity.tgz`.
The package contains the existing `MotionInputGrid.MigTracker` .NET bridge in
the `MIG.Runtime` assembly, a native plugin restricted to its matching platform,
and Apache/MIT licenses. Windows requires a matching VC++ runtime installation.

The UPM identifier is `com.robin-g0.motion-input-grid`.

```csharp
using MotionInputGrid;

using var tracker = new MigTracker(profileJson);
var packet = MigTracker.Packet.Empty();
// Fill anatomical body/hand landmarks from your observation provider.
tracker.Update(ref packet, (action, inputId) => Debug.Log(action));
```

Keep the tracker alive across frames, reuse its packet arrays and update advancing
timestamps/sequences. Dispose it in `OnDisable` or your owner's cleanup method.
The bridge exposes `ImportJson`, `Active`, `Reset` and reusable `TryCoordinate`.
Recognition runs in the C++ engine. No camera provider, sample HUD or synthetic
recognition is included in the runtime package.

The canonical managed source remains `bindings/dotnet/MigTracker.cs`; the builder
copies it into the generated package. No second binding is maintained here.
The [Unity demos](../../examples/unity/README.md) remain separate from this package.

[Distribution](../../docs/getting-started/packages.md) · [C ABI](../../docs/reference/c-abi.md).
