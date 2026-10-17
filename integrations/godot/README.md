# Motion Input Grid (MIG) Godot add-on

[English](README.md) | [Français](README.fr.md)

**Download the integration:** [Windows x64 (zip)](https://github.com/Robin-G0/Motion-Input-Grid/releases/tag/v1.1.0#user-content-mig-v1-1-0-godot-integration) · [Linux x64 (zip)](https://github.com/Robin-G0/Motion-Input-Grid/releases/tag/v1.1.0#user-content-mig-v1-1-0-godot-integration) · [Linux ARM64 (zip)](https://github.com/Robin-G0/Motion-Input-Grid/releases/tag/v1.1.0#user-content-mig-v1-1-0-godot-integration).

> [!IMPORTANT]
> **Preview runtime package; supply your own camera/landmark provider.** For a first trial,
> use the [Godot demos](../../examples/godot/README.md) and their synthetic mode.
> Verify your editor, real provider and exports: [support matrix](../../docs/reference/support.md).

Extract the matching `motion-input-grid-<version>-<platform>-godot.zip` at the root of a Godot
4.3+ project. The archive provides `addons/mig`, its GDExtension, the C ABI library
and licenses. Keep native libraries outside the PCK when exporting. The add-on
accepts landmarks from your observation provider; it does not open a camera.

```gdscript
var tracker := MigTrackerNative.new()
tracker.open(FileAccess.get_file_as_string("res://profile.json"))
var events := tracker.update(timestamp_ms, sequence, aspect, body, hands, hand_count, world_mask)
for index in range(events):
    print(tracker.event_action(index), tracker.event_id(index))
tracker.close()
```

Reuse buffers containing 264 body floats and 252 hand floats. Serialize calls on
one owning thread, check negative update results and `get_error()`, and close the
tracker when its owner leaves the scene. Coordinates remain anatomical/unmirrored.
`active(index)`, `coordinate(joint, system)`, `reset(recalibrate)` and
`import_json(json)` delegate to the existing C ABI.

Build `native/` with `GODOT_CPP_DIR` pointing to godot-cpp `godot-4.3-stable`
and `CMAKE_PREFIX_PATH` pointing to a matching installed MIG C ABI SDK.
The complete checkout also supports building the SDK as a dependency.
The bridge sources live here; the runnable projects stay in
[examples/godot](../../examples/godot/README.md).

[Distribution guide](../../docs/getting-started/packages.md) · [C ABI](../../docs/reference/c-abi.md).
