# Current execution pipeline

[English](lifecycle.md) | [Français](lifecycle.fr.md)

> [!IMPORTANT]
> **One owner per engine/capture session.** Copy borrowed data before sending it to another thread.
> Stop joins the inference owner; an upstream inference call must return before shutdown can finish.

This page describes implemented ownership. [Architecture](overview.md)
describes module boundaries; [performance](performance.md) separates measured
recognition costs from native estimation and UI work.

## Build artifacts

`MIG::core` and `MIG::format` are portable C++ static libraries. Optional
`MIG::hands` supplies geometry, `MIG::native` supplies camera/estimation and
`MIG::face` is only a scaffold. `MIG::c` builds `mig-c.dll`/`libmig-c.so.1` for
serialized language consumers. Windows apps are Win32/GDI; Linux apps are Qt6.
The official `libmediapipe.dll`/`.so` is loaded by absolute path. Pinned Lite/Full
pose models and optional hand model live beside packaged runtimes.
Apps default to Lite, native Pose defaults to Full; both estimate 33 body joints.

## Windows live path

```text
Media Foundation capture, timestamp mapped to monotonic clock
  -> reused RGB/BGRX buffers, four ref-counted leases
  -> latest-frame mailbox, wake inference owner
  -> pose + explicitly requested hands on the same image/time
  -> bounded portable observation conversion
  -> freshness, calibration, compiled constraints, arbitration
  -> immutable revision-tagged snapshot + bounded accepted events
  -> UI drawing and opt-in Single/Hold/Repeat output scheduler
```

The main preview reads latest capture independently. Last-reader release under
a mutex prevents buffer reuse while inference or drawing reads it. Pool state
survives leases at shutdown. Native task results/snapshots may allocate; only
the compiled engine's update path is allocation-free in the regression workload.
Profile/capability/calibration revisions discard in-flight old results.
No unbounded frame backlog or UI inference loop is used.

## Linux and integrated hosts

Linux's worker owns synchronous V4L2 capture, tasks, engine and commands. It
publishes copied latest images/observations and at most 64 timestamped events.
Profile changes stop/join before replacement. UI widgets stay on the main thread.
Single-plane YUYV capture negotiates modes up to 720p and uses bounded poll waits.

### Positions and native SDK hosts

Positions hosts supply fresh unmirrored packets without models/camera. Native
hosts optionally estimate RGB or poll capture. `CaptureRuntime` balances Windows
COM/Media Foundation ownership. ABI capture start/poll/stop/destroy stays on one
owner thread; successful import stops it, invalid import preserves it. A poll
already recognizes its packet; preview pixels expire at the next poll.
Python viewers copy pixels/events before publishing to a worker mailbox.

### Browser sessions

Browser sessions own models, WASM, stream and cancellation generations. Start
requests capture; Stop releases tracks; Dispose releases all resources. Work is
performed once per fresh video frame. React/Vue state receives status/actions,
not landmark arrays; Next's SSR never opens browser resources.

## Recognition, capability and output

The 27x27 grid preserves anchor [4.5,3.5], scales each cell to 20% current shoulder
width and uses a 35 ms filter. Body/Calibrated normal/mirror projections are fixed
engine storage. Preview mirrors once; input Mirror independently swaps anatomy.
Body depth and hand depth retain separate origins and optional metric coordinates.

Both apps restore `tracking.hands` from the profile. Explicit UI requests and
applying finger/gesture bindings enable it; integrated Pose requires
`set_hands_enabled(true)`. False means no hand task creation/inference, not merely
hidden bones. OFF builds reject unsupported hand packets/requests.

Recognition evaluates inputs before global commands. Occupied Interaction cells
with matching signs reserve that hand from commands. Interaction-only holds and
commands permit 500 ms observation gaps; paths/sweeps permit 180 ms. Native
recognition/output freshness is 250 ms; command results are limited to 500 ms.
The engine emits one accepted event and updates independent live terminal state.

### Desktop output ownership

ActionOutput serializes transient sequences, owns terminal Hold chords with key
reference counts and repeats without queued overlap/catch-up bursts. Text waits
for foreign modifiers to release. The user explicitly enables output. Windows
Unicode uses SendInput; Linux XTest uses the current X11 layout, no native Wayland.
Test, dialogs, Stop, reset, lost conditions and stale data cancel/release output.
SDKs provide logical events and active state; they never inject desktop keys.

## Shutdown and verification

Stop wakes/cancels capture, joins owners and releases tasks, buffers and output.
An opaque upstream inference call must return before join; it has no application
cancellation guarantee. JSON reads are bounded to 1 MiB/depth 32 and save uses
isolated same-directory staging with atomic replacement.

### What validation establishes

CTest covers semantics, conversion, capabilities, leases and blank-frame native
lifecycles. Browser/GUI tests use synthetic observations. ASan/UBSan covers the
portable build. None proves real camera accuracy or third-party leak freedom.
MIG does not record/upload frames, but upstream telemetry connections have been
observed. Local browser assets remove CDN loading, not every possible upstream
network attempt. Remaining hardware/editor checks are in
[release preparation](../reference/support.md).
