# Real-time performance and verification

[English](performance.md) | [Français](performance.fr.md)

> [!IMPORTANT]
> **Engine time is not camera-to-action latency.** The benchmark excludes capture,
> model inference, rendering and OS key delivery. No end-to-end latency number is established here.

The portable engine ingests positions and produces logical events. Camera/model
inference, language marshalling, GUI rendering and key delivery are separate costs.

## Work and ownership

Let J be 34 body landmarks (33 model points plus derived `head`), M up to 64 inputs, K up to 4,096 constraints per input,
F the compiled finger rules and N the captured pixels. Each scope is limited to
1,024 constraints and each input to 64 steps. JSON input is limited to 1 MiB and
32 levels of nesting. Configuration construction/validation is a cold operation.

| Stage | Work | Storage and ownership |
| --- | --- | --- |
| Capture conversion | O(N) | Reused RGB image capacity; BGRX generated only for display consumers |
| Native inference | Pose cost plus optional hand cost | Native tasks/images/results owned by the inference thread; upstream allocations remain |
| Observation conversion | O(J + 42) | Fixed body/hand values; optional world coordinates |
| Calibration/grid | O(1) per update; median selection once | Fixed 90-sample width buffer, live shoulder scale and fixed reference anchor |
| Landmark projection | O(J) per used space/mirror combination | Four reusable fixed projections per engine, at most four combinations |
| Recognition | Worst O(MK + F), with repeated group/tolerance checks | Independent compiled candidates/progress/timers, bounded events; no update-time C++ new allocations in the regression workload |
| Windows frame transfer | Bounded latest-frame mailboxes | Four leased capture buffers; final-reader release under a mutex prevents reuse races |
| Linux frame transfer | One latest image, at most 64 pending events | Worker owns native tasks; copied Qt image crosses the mailbox |
| Windows painting | O(display pixels + visible overlays) | Two reusable window buffers, resized only with the window; temporary pens/brushes remain |
| JSON import/export | O(bytes), plus bounded model validation | Atomic validated replacement; immutable runtime definitions |
| Keyboard delivery | Bounded sequence queue and motion states | Separate scheduler; shared modifiers are released when their last action ends |

Strict thresholds, half-open cell boundaries, sweep continuity, finger stability,
interaction dwell and release semantics are preserved by the optimizations.
Fast-math flags, model substitutions and reduced hand sampling are not introduced.

## Measuring

```sh
cmake -S . -B build/bench -G Ninja -DCMAKE_BUILD_TYPE=Release \
    -DMIG_BUILD_CONFIGURATOR=OFF -DMIG_BUILD_CONTROLLER=OFF \
    -DMIG_BUILD_BENCHMARKS=ON
cmake --build build/bench
build/bench/tests/benchmarks/mig-engine-benchmark
```

The synthetic benchmark performs 100,000 updates per case, including frame setup,
without camera, inference or UI costs. It includes inactive/latched periods and is not a worst-case
4,096-constraint scan. Compare accepted event counts as well as timings, and take
several interleaved samples on the same machine/compiler before drawing conclusions.

[The realtime test](../../tests/core/realtime_tests.cpp) compares 64 mixed-space/mirrored inputs against isolated engines
over calibration, movement, missing landmarks and stale frames. It checks progress,
events and active outputs while counting ordinary C++ allocations during update.
Other tests cover scoped fingers, interactions, alternative rows, sweep ordering,
long holds, stale timestamps, output modes and native ownership. ASan/UBSan covers
the portable build; it does not establish leak freedom in the external estimator.

For webcam performance, measure capture timestamps, result age, inference time,
rendering and capture-to-key latency on the target hardware. Native controllers
reject recognition older than 250 ms; command gestures use a 500 ms freshness cap.
Desktop applications default to the Lite CPU model; the native `Pose` class defaults
to Full. Users and developers can select Lite, Full or Heavy (see the
[Controller guide](../guides/controller.md#views) and the
[npm guide](../../bindings/javascript/README.md#pose-model-selection)). All variants
predict all 33 pose joints; ignoring leg constraints does not reduce the model's work.
See the [official pose model guide](https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker).

| Variant | File size | Expected cost | Use |
| --- | --- | --- | --- |
| Lite | 5.8 MB, bundled | Lowest latency | Default; sufficient for wrist/shoulder routes |
| Full | 9.4 MB, bundled natively, fetched on demand in browsers | Roughly twice Lite | Steadier landmarks when CPU headroom exists |
| Heavy | 30.7 MB, fetched on demand and cached | Several times Lite | Most precise landmarks; precision does not imply more reliable commands |

Model files are verified against their pinned SHA-256 before loading, and
downloads are published atomically after verification. Inference time is
dominated by the model and the delegate: the native build uses the CPU delegate,
the browser can request `GPU` (WebGL) and falls back to CPU when it fails.
Controllers skip the hand model unless a profile uses finger rules, hand signs
or hand commands (`uses_hand_observations`), which removes a second task
graph from each frame for body-only profiles.

Native inference remains the main profiling target. SIMD pixel conversion, estimator
thread scheduling and model quality/rate changes require hardware measurements and
accuracy checks before adoption. Neither microbenchmarks nor blank-frame smoke tests
establish human gesture accuracy or seated/standing performance.

Browser sessions can cap inference independently of rendering, select capture constraints and disable unused overlay drawing. See [browser performance controls](../../bindings/javascript/README.md#browser-performance-controls). Pose-only sessions defer hand-model initialization. These reduce scheduled work; they do not establish lower device temperature or end-to-end latency without hardware measurement.
