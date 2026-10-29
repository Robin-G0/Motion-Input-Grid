# Optional native hand and finger tracking

[English](hands.md) | [Français](hands.fr.md)

## First try

> [!TIP]
> **A simple wrist route is enough to start.** Finger tracking is optional.
> Begin with the [presentation guide](presentations.md) or [Studio Web](studio-web.md).

| You want to… | What to do |
| --- | --- |
| Recognize a wrist route | Draw **Required** then **Trigger**; keep your shoulders visible. |
| Add a finger or sign condition | Use a hands-enabled build and finger settings / a purple **Interaction** region. |
| Hide hands on screen | Change the overlay; it does not disable tracking requested by the profile. |

> [!WARNING]
> **Occluded fingers remain uncertain**, even when the model returns positions.
> Test with keyboard output off and check sign release as well as activation.
> Automated tests do not measure accuracy on your hand.

<details>
<summary>On this page</summary>

- [Run](#run)
- [Data contract](#data-contract)
- [Runtime and verification](#runtime-and-verification)

</details>

Windows and Linux applications estimate hand and finger positions with native
MediaPipe Hand Landmarker. Finger geometry supplies scoped rules, recognized signs
and application controls.
See [schema v2](../reference/configuration.md) and [authoring](../getting-started/windows.md).

## Run

Rerun the build script without `-SkipBootstrap` once to obtain the hand model and
matching headers. Subsequent builds may skip bootstrap.

```powershell
powershell -ExecutionPolicy Bypass -File tools/build/build-windows.ps1
.\build\windows\bin\motion-input-grid-studio.exe --hands
# Stop the first application's camera before starting the other:

.\build\windows\bin\motion-input-grid-controller.exe --config profile.json
```

Both applications use **Hands ON/OFF** and the same saved
`"tracking": {"hands": true}` switch. Loading/undoing a profile restores that switch.
In the Motion Input Grid Studio, `--hands` sets it initially. Applying gesture bindings or an
input with finger rules enables Hands in an ON build; Save persists the setting.
Absent flags mean body-only.
The Motion Input Grid Controller's `--hands` flag is accepted only for diagnostics, not normal use.

Click Start camera. The main video is unobstructed; rule diagnostics appear in the separate editor.
Hand tracking does not require shoulder calibration; body path
recognition still does. Without an explicit host request, the hand model is not loaded or run.

### Display and association

The editor displays yellow hand bones/joints alongside body markers. Main status
shows detected hands and available anatomical finger observations. Finger assignment
requires visible pose wrists/shoulders and rejects ambiguous associations.

<details>
<summary>Advanced: global commands, thresholds and build options</summary>

### Global commands and thresholds

Extension checks both thumb MCP/IP or finger PIP/DIP bends, preventing a folded
thumb with straight IP from invalidating a V gesture. Thumb and V can independently
bind Restart, Restart calibration (Recalibrate), and Record. Apply enables inference;
hold the sign for at least the configured validation period (250 ms by default).
Fresh startup offers Right V for Recalibrate; turn Hands on to use it.
Reassigning Right V to Record removes that default recalibration binding. One sign
controls one action. Global V accepts thumb extension <=0.55 and ring/pinky <=0.4,
with index/middle >=0.7; this accommodates a naturally curled thumb. Input finger
rules remain unchanged. Commands tolerate up to 500 ms between valid observations
instead of requiring a frame every 180 ms, retain the validation interval and
held latch, and accept only command results up to 500 ms old. The main status
shows each hand's recognized sign or unknown observations. View can independently
show/hide yellow hand skeletons and body dots in the main window. Recording signs
need an open editor and use its current landmark selection/coordinate basis.
`-DMIG_BUILD_HANDS=OFF` removes the native hand code, linkage and model packaging;
requesting `--hands` then reports an error.

</details>

## Data contract

`mig/hands/frame.hpp`, exported by `MIG::hands`, defines portable fixed-capacity
observations without MediaPipe headers or video buffers. The internal native
`Pose::hand_frame()` returns its latest result by reference: copy before the next
inference or transferring to another thread.

Windows games can now link the optional exported `MIG::native` adapter and include
`mig/native/pose.hpp`. `Pose(directory)` defaults to body-only; the game explicitly
calls `set_hands_enabled(true)` when desired and `false` to release the task. These
calls and inference belong to the same owner thread. This is a synchronous estimator
adapter, not yet a complete threaded game session facade. The adapter can be built
without GUI apps using `MIG_BUILD_NATIVE_RUNTIME=ON` and both app switches OFF.

- Up to two hands, each with exactly 21 positions in MediaPipe index order.
  Named indices cover wrist and finger joints; tips are 4, 8, 12, 16 and 20.
- `x/y` are unmirrored normalized image coordinates. `z` uses the model's
  wrist-relative normalized depth convention, not metres or camera distance.
  Do not mix it with the torso shoulder-width proxy.
- Timestamp, sequence and image aspect match the body/video observation.
- Only `[0,count)` is valid. Results reset for every inference: missing hands do
  not reuse old positions. Wrong counts, non-finite positions, magnitudes above
  16 and scores outside `[0,1]` are rejected.
- `model_side` is the raw classifier label, not a calibrated anatomical assignment.
  `handedness_score` is a classification score, NOT per-joint confidence.
  Array order is not identity; no persistent tracking ID is promised.

Hand rules require hand-local geometry, anatomical association where relevant,
hysteresis, temporal validation and release-on-loss. An occluded finger is not
necessarily reliable just because a model returns its position.

## Runtime and verification

Body and hands share the same RGB image and timestamp, sequentially on the
existing inference worker. The latest-frame camera slot stays bounded. Hands add
inference cost; target hardware latency/accuracy still needs human testing.
No recording/upload is added. RAII releases native results, images, both model
handles and the DLL. Upstream Clearcut metrics connection attempts were observed;
zero network traffic and leak-free operation are not established by these tests.
See [the performance and safety audit](../architecture/performance.md).

### Verify

```powershell
ctest --test-dir build/windows -C Release --output-on-failure
.\build\windows\bin\motion-input-grid-controller.exe --hands-test
.\build\windows\bin\motion-input-grid-controller.exe --camera-test --hands
.\build\windows\bin\motion-input-grid-controller.exe --session-test --hands
```

The hands smoke test creates/closes both models three times, infers nine blank
frames and checks empty hand results with matching metadata. Portable tests check
indices and invalid observations. Camera/session tests are explicit opt-in and
do not inject keyboard input. None establishes human finger accuracy.
Historical refactor verification passed all nine tests and three real webcam session cycles
with hands enabled. A separate hands-disabled build passed its seven tests,
packaged no hand model and explicitly rejected the hands flag.

### Recognized signs

The shared core classifier now recognizes Thumb, V, OK, Open palm and Fist.
OK requires thumb/index tip contact (3D distance <=25% of palm width), with the
other three fingers extended. Native conversion publishes `Frame.hand_contacts`
alongside fingers from the same anatomical wrist association and source frame;
host integrations must supply this evidence for OK. Unknown contact never counts
as OK or deliberate global-command release. Open palm/Fist use known extended/
closed observations on all five fingers. These signs are available for global
commands and purple Interaction cells. Advanced edits Interaction hand/sign/hold and
scoped finger stable/grace times. Synthetic tests cover all five geometry-to-command
paths on both anatomical sides; human accuracy remains a separate measurement.

Model v1 SHA256:
`fbc2a30080c3c557093b5ddfc334698132eb341044ccee322ccf8bcf3607cde1`.
References: [official native API](https://github.com/google-ai-edge/mediapipe/blob/v0.10.35/mediapipe/tasks/c/vision/hand_landmarker/hand_landmarker.h),
[model coordinate guide](https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker).
