# C# bridge

[English](README.md) | [Français](README.fr.md)

`MigTracker.cs` wraps ABI version 1 of `mig-c` for Unity and Godot .NET.
Copy it into the project and stage the matching native library for the editor
and each export architecture. No NuGet package is published by this repository.

| Step | API and contract |
| --- | --- |
| Create | Construct the tracker with **schema-v2 JSON** |
| Feed | Reuse `MigTracker.Packet.Empty()` arrays and submit fresh observations with `Update(ref packet, callback)` |
| React | The callback receives copied action/input strings |
| Read a coordinate | `TryCoordinate` needs at least four floats and returns freshness/confidence |
| Import | `ImportJson` validates before replacing and resets recognition on success |
| Close | Call `Dispose()` on scene disable/exit |

> [!IMPORTANT]
> **One owning thread per tracker.** Never update the same handle concurrently.

Packet body/hand layout, coordinate spaces, borrowed lifetimes and capability
limits are in [C API](../../docs/reference/c-abi.md). Start with
[Unity](../../examples/unity/README.md) or [Godot](../../examples/godot/README.md).
These components demonstrate both imported profiles and raised-wrist feedback;
an actual observation provider is still needed outside synthetic mode.
