# C++ recognition API

[English](cpp.md) | [Français](cpp.fr.md)

> [!TIP]
> **Integrating a game?** Run the short update loop below, then read the ownership and live-state contracts.
> Installation commands are in the [C++ quick start](../getting-started/cpp.md).

To install just the library and link it to your project, follow the
[C++ SDK / CMake guide](../getting-started/cpp.md). It covers archives, source builds,
`cmake --install` and generated Makefiles on Linux.

Link `MIG::core` for positions recognition and optionally `MIG::format` to load
configurations. Public headers are `mig/core/engine.hpp` and
`mig/format/configuration.hpp`. These exports do not depend on MediaPipe or Windows
camera types. The optional exported `MIG::native` Windows/Linux adapter supplies camera
and estimator types separately; it does not enlarge the portable positions core.
See [the native consumer](../../examples/native-consumer/CMakeLists.txt) and
[hand capability contract](../guides/hands.md). A complete threaded session facade
remains planned.
### Optional coordinate queries

`mig/core/coordinates.hpp` adds O(1), allocation-free XYZ access and borrowed spans.
Frame points retain optional image depth and hip-relative world metres independently
of 2D recognition. `WorldHeightUp` flips world Y for height-based game logic. Missing
XYZ returns `nullopt`; coordinate validity never invents depth for 2D-only hosts.
The hands library supplies equivalent joint access and anatomical association indices.
JSON text import/export and the Emscripten website wrapper share the native v2 parser
and engine. See [SDL2/SFML/web examples and coordinate units](../integrations/overview.md).

## Minimal update loop

```cpp
mig::Engine engine(mig::load_configuration("profile.json"));
// Supply 33 points in anatomical MediaPipe pose index order.
// Unobserved points have confidence=0; image coordinates are unmirrored [0,1].
mig::Frame frame;
frame.timestamp_ms = monotonic_capture_time_ms;
frame.sequence = next_sequence;
frame.aspect = float(image_width) / image_height;
// ... fill frame.points ...
for (const auto event : engine.update(frame, monotonic_now_ms)) {
    const auto& motion = engine.configuration().motions[event.motion];
    game_dispatch(motion.id);
}
```

## Ownership and timing

`update` is noexcept and working storage is reserved during construction.
Segment geometry is compiled at construction; hot-path validation, grid update,
recognition and arbitration live in separate source modules. The [real-time regression](../../tests/core/realtime_tests.cpp) checks that the mixed-space
update workload performs no ordinary C++ allocations; this does not cover native inference. Future/stale packets do not advance source watermarks.
The returned span belongs to the engine and is invalidated by its next update.
Events reference the immutable configuration's motion index and carry the trigger
observation timestamp, not an interpolated crossing time. Caller supplies timestamps
from one monotonic clock domain; use `recalibrate()` when changing source/session.
Drive one engine instance from one thread. `grid()` exposes calibration and the
body coordinate conversions for preview. Call conversions only when grid is valid.

## Coordinate contract

Tracking requires valid shoulders; each path requires its selected wrist. Model
indices 11/12 are left/right shoulders and 15/16 left/right wrists. The body grid's
x-axis points image-right for a front-facing subject, independent of the anatomical
member ID. The grid uses origin `[4.5,3.5]` and 0.2 current shoulder widths/cell
(`Grid::cell_shoulder_ratio`), smoothed with the same 35 ms time constant as the
centre/axis. The calibration baseline stays fixed for the approach proxy.
The editor draws 27x27 cells from `Grid::min_cell` (-9) to `Grid::max_cell` (18),
preserving saved coordinates and the small cell size while covering wider gestures.

The native applications mirror only the displayed image and overlays. This does
not change the SDK input contract or anatomical indices. Their pointer editing
applies the inverse display transform before converting into grid coordinates.

## Events and held actions

The SDK emits one-shot recognition events and separately exposes live terminal
state through `action_active(motion_index)` / `InputProgress::output_active`. This
state becomes true only after an accepted activation, remains true while terminal
High/Low occupancy and scoped finger/sign conditions match, and clears on exit,
lost tracking, guards or Restart. Ordered paths without a firing region use the
final Required group in each landmark lane. The persistent Test `triggered` flag
does not imply that an action is still physically held. Hosts can implement Hold
or Repeat using the Motion's `action_mode` and `repeat_interval_ms`; the SDK does
not inject keys. Keyboard scheduling/watchdog belongs to the native applications.

> [!WARNING]
> **The host must release output when frames stop arriving.** The core cannot update
> `output_active` while it is not called; implement an application freshness watchdog.

Constructors/loaders validate and
throw descriptive errors; prepare replacement instances outside the real-time loop.

[examples/sdk-consumer](../../examples/sdk-consumer/CMakeLists.txt) demonstrates
`find_package(MIG CONFIG REQUIRED)` against an installed SDK and synthetic input.
