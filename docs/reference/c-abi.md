# Shared C ABI and language bindings

[English](c-abi.md) | [Français](c-abi.fr.md)

> [!WARNING]
> **A native poll already runs recognition.** Read its events without calling `mig_update()` again.
> Keep capture start/poll/stop/destroy on the **same owner thread**.

`MIG_BUILD_C_API=ON` builds `mig-c.dll` / `libmig-c.so` and installed `MIG::c`.
It wraps the existing C++ engine/strict JSON parser, with no recognition rewrite
in Python/C#/Unreal. Portable builds accept supplied observations; native builds
also offer explicitly requested capture. Include `mig/c/api.h`.

## Handle and memory contract

ABI version 1 uses normal native alignment, fixed-width integers and float32
arrays. Compare `mig_packet_size()` with your struct size. No C++ containers,
exceptions, bools or callbacks cross the boundary. Serialize calls per handle;
start/poll/stop/destroy native capture on the same owning thread. Destroy once.
Returned UTF-8 action/id pointers are borrowed until update/import/reset/destruction;
copy before callbacks. Error text is thread-local; copy before the next failing call.

## Observation packets

Packets carry monotonic nonnegative millisecond timestamps, increasing sequences,
positive aspect ratio, hand_count 0..2 and hand_world_mask 0..3:

| Buffer | Stride | Values |
| --- | --- | --- |
| body, 33 joints | 8 floats | image XYZ, confidence, world XYZ, world-valid 0/1 |
| hands, 2 x 21 joints | 6 floats | image XYZ, world XYZ |

Indices are anatomical/unmirrored MediaPipe indices. Detected hands are associated
with pose wrists; world mask bit N describes detected hand N. Clear packets each
frame; missing body confidence is zero. Image Z is relative to hips/wrist, not
metres. World body is hip-relative metres; hand world is hand-centre-relative.
Coordinate systems 0/1/2 mean image/world/world Y-up. Queries return absent for
invalid/missing indices. Invalid frame metadata resets recognition/live outputs;
bad individual points become missing. Hands-disabled builds reject hand packets.

## Import and export

`mig_load()` swaps only valid schema-v2 profiles. Failure preserves profile/capture;
success stops capture and resets recognition. `mig_export()` reports required
capacity including NUL, then copies only into a sufficiently large buffer.
Null query handles are safe; destroyed nonnull handles are never valid.

## Updates and native polling

`mig_update()` returns event count or -1. `mig_camera_poll()` returns -1 failure,
0 timeout or 1 new packet, and already recognizes that packet. Consume
`mig_event_count()` and events; do not update the same packet twice. Poll includes
inference latency; interactive hosts should place ownership on a worker.
Creating a tracker never opens a camera. Native capture supports Windows/Linux.
The capture adapter owns balanced Windows COM/Media Foundation initialization;
the C++ samples use the exported `CaptureRuntime` RAII helper for the same lifecycle.

## Host outputs and bindings

`mig_active()` supplies live terminal state for application Hold/Repeat commands.
The ABI never injects desktop keys; hosts own output scheduling and cancellation.
[Python](../../bindings/python/mig/tracker.py) uses explicit ctypes signatures and
context managers; [C#](../../bindings/dotnet/MigTracker.cs) uses IDisposable and copies
events before callbacks. See [example index](../../examples/README.md).

Linux installs `libmig-c.so.1` with versioned-library and development links.
Native polling evaluates freshness against the current host clock with a 250 ms
observation limit; direct updates retain the caller's packet clock contract.
Python release wheels bundle the positions-only C ABI. An explicit library path
selects an external SDK with optional native camera support.

## Borrowed camera preview

The additive ABI-1 `mig_camera_image` extension returns a borrowed packed RGB24
preview and dimensions after successful native polling. Pixels are unmirrored and
valid until the next poll/stop/import/destroy; a failed or timed-out poll invalidates
the preview. Querying never opens a camera. Python `Tracker.camera_image()` copies
the bytes on the tracker owner thread before publishing them to a GUI worker mailbox.
Older SDKs remain usable for observations; these camera viewers need the extension.

The .NET `TryCoordinate` overload accepts a reusable four-float buffer; its contents
are valid only when the method returns true. Hosts can reuse packet arrays between
updates. `SyntheticFrames.WriteLeftRaise` demonstrates that ownership pattern.
