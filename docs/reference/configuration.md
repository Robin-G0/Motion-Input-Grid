# MIG configuration format, schema v2

[English](configuration.md) | [Français](configuration.fr.md)

> [!TIP]
> **Need a working profile?** Import the [complete HI example](#complete-studio-hi-example).
> Read individual sections when editing a field; this page is a reference, not a required first lesson.

<details>
<summary>On this page</summary>

- [Document and coordinate system](#document-and-coordinate-system)
- [Action output modes](#action-output-modes)
- [Independent spatial constraints and steps](#independent-spatial-constraints-and-steps)
- [Finger scopes and global controls](#finger-scopes-and-global-controls)
- [Purple Interaction cells](#purple-interaction-cells)
- [Recording, limits and validation](#recording-limits-and-validation)
- [Example: generic Jump](#example-generic-jump)
- [Editor presentation and live scaling](#editor-presentation-and-live-scaling)
- [Motion Input Grid Controller profile list](#motion-input-grid-controller-profile-list)

</details>

The standalone camera examples use
[`raised-hands.json`](../../examples/common/raised-hands.json): separate left/right
wrist inputs in body space, with four full-width green Required rows followed by
a yellow Trigger row. Each `[x,y,width,height]` region is a horizontal strip;
numbered ordered rows require an upward path, rather than a Python height check.
Hand inference is enabled for the finger overlay, but no finger sign is required
to raise a wrist. These examples emit logical events and bind no keyboard keys.

### Parser and replacement contract

**Only schema version 2 is accepted.** Older versions and legacy_path fields are rejected;
there is no migration or legacy recognition engine. Unknown versions and fields fail
before replacing the active document.
`load_configuration(path)` and `parse_configuration(json_text)` use the same strict
validator and 1 MiB / 32-level limits. `serialize_configuration(config)` exports the
same v2 document without filesystem access; `save_configuration` uses it for atomic
file replacement. On Windows, temporary sharing/locking conflicts are retried for
up to 500 ms. Persistent failures preserve the saved profile and report the OS error.
Native and WebAssembly consumers import Motion Input Grid Studio profiles
without migration or a separate JavaScript schema. Failed web imports retain the
current engine. See [integration examples](../integrations/overview.md).

Linux Qt applications, Python ctypes and Unity/Godot/Unreal C ABI consumers use
this same schema-v2 parser/engine. No language-specific JSON format was added.
Runtime packets/handles and keyboard/window consent are not serialized. Successful
C ABI imports stop capture; invalid imports preserve it. Linux Advanced edits all fields
through its complete-profile editor. See [C ABI](c-abi.md) and [Linux UI limits](../getting-started/linux.md).

## Import review

Desktop file/command-line imports validate first, then display a scrollable review of
every movement, ordered chord/text action and Single press/Hold/Repeat mode. Accepting
the review imports the profile; Keyboard output stays off until enabled separately.
Cancel keeps the previous configuration. Chord keys are simultaneous; numbered
actions run sequentially. Text is quoted with escaped newlines/tabs, so the display
preserves the sequence. Hold executes its prefix once and owns the last chord;
Repeat displays its interval. User-authored delays are not currently supported.

The **System interaction** heuristic covers Windows/Super, Alt+F4, Alt+Tab, Alt+Esc,
Alt+Space, Ctrl+Alt+Delete/Backspace/function keys, Ctrl+Shift+Esc, Sleep and launch keys,
including left/right modifiers. It cannot determine the effect in every focused
application. Text can also initiate behavior after a shortcut; review the entire
sequence. A supported definition does not guarantee an OS accepts an injected
shortcut (for example, secure attention) or that the X11 layout can emit every key.

Central limits in `mig/core/input.hpp`: 256 actions, 1,024 total serialized chord-key
entries and 16,384 total UTF-8 text bytes per input. Example profiles currently have
at most one keyboard action, so these limits retain substantial headroom. Duplicate,
reserved, undefined, mouse/gamepad and Unicode-packet key codes are rejected. UTF-8
must be valid. Existing 1 MiB/depth-32 configuration bounds still apply. SDKs validate
the same schema; desktop review is an application UI responsibility.

## Document and coordinate system

Root fields are `schema_version: 2`, required `inputs` (0..64), optional
`tracking: {"hands": false}`, and optional `controls`. Both applications use this
same persisted Hands switch, including after loading a profile. Applying
hand gesture bindings or an input with finger rules enables it in hands-enabled builds.
Finger rules require hand observations;
missing observations never silently bypass a configured rule.

### Input fields

Each input requires stable `id`, display `name`, and logical `action`, each at most
80 UTF-8 bytes. Input, step and constraint IDs, names, actions and tolerance
references cannot contain NUL (`\u0000`), because native consumers use
NUL-terminated strings. Optional
fields are `keyboard` (an ordered array of text/chord actions; omitted or empty
means logical event only), `mirror`
(false), `space` (`calibrated`, default, or `body`), `max_duration_ms` (0..10000,
default 0: no time limit), `cooldown_ms` (0..10000, default 0: no cooldown),
whole-movement `constraints` and `fingers`, ordered `steps`, reviewed
`recordings`, `action_mode` (`single_press`, default, `hold`, `repeat`) and
`repeat_interval_ms` (20..60000, default 200).

Cooldown starts when this input fires and suppresses both its normal and mirrored
variants until the deadline. It does not replace the release/rearm latch: holding
a completed movement still cannot emit additional recognition events. Repeat mode
replays keyboard output from the accepted live activation independently of cooldown.
Restart clears this runtime
deadline. An explicit positive time limit remains available in Advanced mode and starts
when an attempt begins. Newly authored inputs have no movement time limit.
The global hand-command recovery delay remains separate and fixed at 1000 ms.

### Keyboard sequence syntax

`keyboard` contains up to 256 objects, each with exactly one of `text` (UTF-8)
or `keys` (1..255 unique Windows virtual keys, each 1..255). The former eight-key
limit is removed. Keys may repeat across successive objects, but repeating a key
inside one simultaneous chord is invalid. Text totals at most 16384 UTF-8 bytes;
invalid UTF-8 and NUL are rejected. An empty text object is a no-op.

```json
"keyboard": [
  {"text": "Hello world"},
  {"keys": [13]},
  {"keys": [17, 67]},
  {"keys": [67]},
  {"keys": [67]}
]
```

### Keyboard execution and cancellation

Both apps execute this sequence in the foreground application when **Keyboard: On**.
Text uses Windows Unicode input; chords press modifiers first and release keys in
reverse order after 80 ms in Single press. Actions have a 20 ms separation. Accepted
sequences run serially (up to 16 queued per input); terminal Hold shortcuts can coexist.
Shared keys use ownership counts, so releasing one input never releases another's
modifier. Text waits while another action owns a modifier, preventing it from
affecting later text.
Text is dispatched in small batches without blocking capture or the UI.
Stop, reset, disabling output, stale tracking, modal dialogs, the keyboard editor
and Test cancel pending sequences and release output. Test never sends keys.
Keyboard consent and View overlays are UI state, not persisted profile fields.

The **Keys / Ctrl+K** field and **Edit keys** window accept:

- `"Hello world" _ Enter`: type the quoted text, then press Enter.
- `Ctrl + C`: press the linked keys together.
- `A _ A _ "done" _ Ctrl + S`: repeated keys, text and a shortcut in order.
- `None`: logical event only.

Operators inside quotes are literal characters. Quoted text supports `\"`, `\\`,
`\n`, `\r`, `\t`. Key names include `Alt+F4`, `Space`, `Left`, `F1`..`F24`,
and `VK:65`; `Plus` names the plus key. Recognized keys/text appear in outlined
boxes; the separate editor scrolls longer previews and blocks invalid expressions.
The former input-level `key` and `keys` fields are rejected; there is no compatibility
reader. Schema v1 remains unsupported.

## Action output modes

The editor's **Action mode** selector applies to the selected input. **Repeat ms**
appears for Repeat. These settings apply to the entire input and are persisted:

```json
"action_mode": "repeat",
"repeat_interval_ms": 375,
"keyboard": [{"keys": [17, 67]}]
```

- **Single press** executes the keyboard sequence once on the accepted trigger.
  Keeping the movement held does not replay it.
- **Hold** executes preceding sequence actions once, then keeps its final shortcut
  pressed until the live trigger conditions end. Thus `Ctrl + C` holds Ctrl and C;
  `"Ready" _ Enter _ Shift` types/sends once, then holds Shift. A nonempty Hold
  sequence must end with a shortcut; text-only Hold is rejected with an error.
- **Repeat** executes the complete sequence immediately, then repeats at the selected
  start-to-start interval while the live conditions remain valid. A running sequence
  always finishes before another repetition starts; delayed ticks never accumulate
  catch-up repetitions. For short intervals, the chord pulse is shortened to half
  the interval (maximum 80 ms), with a gap up to 20 ms. Timing follows the UI timer.

An accepted action stays live while its firing group's High/Low region is currently
occupied and its input/step/local finger rules and Interaction sign remain valid.
Green prerequisites are not revisited during the hold. Without an explicit firing
region, an Ordered final step uses the final Required group in each landmark lane;
Visited/Simultaneous final steps require current occupancy of their Required groups.
Forbidden guards, lost landmarks/signs/fingers, tracking gaps or stale observations
end the activation. A swept trigger with no final occupancy produces a Single press
event but does not start Hold/Repeat. Mirror preserves the activating anatomical hand.
The accepted activation cannot resume output after release without a new trigger.

Stop, Restart, Recalibrate, document replacement, disabling Keyboard, entering Test,
dialogs and stale tracking cancel pending work and release held keys. Test results
can stay highlighted while live output is already inactive. The main input row shows
the selected mode/interval and remains highlighted during a live Hold/Repeat.
Logical recognition events still emit once; portable SDK hosts can consume
`Engine::action_active(index)` or `InputProgress::output_active` to implement their
own output adapters. These runtime flags never enter JSON.

The 27x27 grid has boundaries -9..18, valid cell origins -9..17, and shoulder
anchor [4.5,3.5]. `[x,y]` denotes a unit cell; `[x,y,width,height]` denotes a region.
Coordinates and extents are integers; regions cannot cross the grid boundaries.
The minimum edges are included and maximum edges excluded. Each cell side follows
20% of the current aspect-corrected shoulder width. `body` follows the torso centre
and axis. `calibrated` keeps the calibrated centre and axis while following current
shoulder scale, allowing generic height changes such as Jump and Crouch.
Coordinates are anatomical engine coordinates; the camera preview is mirrored.

## Independent spatial constraints and steps

Each constraint requires input-unique `id`, registered `landmark`, `cell`, `type`
(`required`, `forbidden`, `trigger`, `interaction`), and `priority` (`high`, `low`). Optional fields
are `tolerance_for`, local `fingers`, and `order` (0..1024, default 0).
Interaction requires the additional `interaction` settings object described below.
Spatial overlaps remain independent.

- Required must be visited by the specified landmark.
- Forbidden invalidates the active attempt when crossed, at either priority.
  Whole-movement Forbidden guards apply throughout; step guards apply in that step.
- Interaction is a purple firing region with an explicit hand sign and optional
  continuous hold, described below. It shares the single firing group with Trigger.
- Trigger fires once when its prerequisites are satisfied. Triggers belong to
  steps; at most one High firing group (Trigger or Interaction) is permitted per input. Independent
  unnumbered Triggers each count as a group. In an ordered step,
  Required constraints after the Trigger are follow-through and do not delay firing.
  Later steps do not delay firing either. Without a Trigger, completion fires.
- Low Required/Trigger/Interaction references a same-type, same-landmark High constraint in
  the same scope through `tolerance_for`. It provides an alternative region rather
  than an additional mandatory visit. Low Forbidden may be independent or refer
  to a matching High guard. High constraints cannot reference tolerance targets.

A generic input needs 1..64 steps. Each step requires a unique `id`, nonempty
`constraints`, and at least one High Required, Trigger or Interaction. Optional `mode` defaults
to `visited`; `hold_ms` is 0..1000 (default 0); `fingers` is optional.

| Mode | Meaning |
| --- | --- |
| `visited` | Required visits accumulate in any order within the step. |
| `simultaneous` | All Required regions must be occupied together. |
| `ordered` | Constraint array order applies independently to each landmark; different landmarks progress in parallel. |

### Numbered alternatives

In an ordered step, a positive `order` explicitly numbers a High Required/Trigger
region. Regions with the same **step, anatomical landmark and number** form an
alternative group: reaching any one region validates that number. The numbers
advance in increasing order, independently of their positions in the JSON array.
Different landmarks still have separate lanes and prerequisites. Forbidden and Low
constraints have `order: 0`; Low tolerance continues to reference its own High region.
All members of a numbered group must use the same type. Local finger rules apply
to the actual region visited, including its linked tolerance. Only contacted regions
are highlighted, not the whole row. Multiple numbered yellow regions can form the
single Trigger group.

An entirely unnumbered lane (`order` omitted or 0) retains independent visits in
array order. Mixing numbered and unnumbered High positive constraints in one lane
is rejected. The editor numbers the existing lane when a manual number is chosen.
Switching the step to Visited/Simultaneous explicitly removes its order numbers;
the resulting profile still uses the same spatial constraints.

For example, a general right-hand raise can use these Required alternatives in
one Ordered step (with unique IDs and High priority on each constraint):

```json
[
  {"id":"bottom_a","landmark":"right_wrist","cell":[1,5],"type":"required","priority":"high","order":1},
  {"id":"bottom_b","landmark":"right_wrist","cell":[2,5],"type":"required","priority":"high","order":1},
  {"id":"top_a","landmark":"right_wrist","cell":[1,3],"type":"required","priority":"high","order":2},
  {"id":"top_b","landmark":"right_wrist","cell":[2,3],"type":"required","priority":"high","order":2}
]
```

One bottom cell followed by one top cell completes the input; there is no need to
traverse each horizontal row. Choose **Order: 1**, draw the bottom row, then
**Order: 2** and draw the top row. A manual numbered brush also reassigns an existing
same-type square without stacking another constraint. Auto retains path numbering;
when a lane is already numbered it allocates subsequent numbers. Forbidden remains X.

Steps progress in array order, at most one step per observation. Input-level
Required visits are accumulated prerequisites; input-level Forbidden is a guard.
Stable finger rules apply alongside spatial requirements. A held Trigger or
completed movement cannot emit repeatedly; normal mode rearms after leaving the
start region. Test results remain locked until Restart. Restart clears progress
without changing calibration; Recalibrate also replaces the body anchor.

### Supported landmarks

The central landmark registry in `mig/core/input.hpp` supports all 33 pose
landmarks, derived `head`, and `left_hand`/`right_hand` aliases for the pose wrists.
Head uses the midpoint of visible ears, falling back to the nose. Names include
`nose`, `left_eye_inner`, `left_eye`, `left_eye_outer` (and right equivalents),
`left_ear`, `right_ear`, `mouth_left`, `mouth_right`, and left/right `shoulder`,
`elbow`, `wrist`, `hand`, `pinky`, `index`, `thumb`, `hip`, `knee`, `ankle`, `heel`,
`foot_index`. Mirror reflects positions about x=4.5 and exchanges anatomical
left/right landmarks and finger hands; head and nose retain their identity.

## Finger scopes and global controls

Each finger rule requires `hand` (`left`/`right`), `finger`
(`thumb`/`index`/`middle`/`ring`/`pinky`), and `pose` (`extended`/`closed`).
Optional `stable_ms` is 50..500 (default 100); `grace_ms` is 0..300 (default 150).
A scope permits at most ten rules and no duplicate hand/finger binding.
`inputs[].fingers` applies throughout the movement, `steps[].fingers` while
advancing that step, and `constraints[].fingers` when validating that region.
An empty list imposes no rule. Extension >=0.7 means extended, <=0.3 closed;
confidence must be >=0.6. Stability must be acquired before grace can bridge a
brief mismatch. Native extension is a joint-angle abstraction; uncertain anatomical
hand assignment is rejected. Human accuracy still requires camera validation.

### Global application controls

Application controls are separate from finger input rules. Optional `restart`,
`recalibrate`, and `record_toggle` each contain `gesture`
(`none`/`thumb`/`v`/`ok`/`open_palm`/`fist`)
and `hand` (`left`/`right`). Defaults disable each binding. Thumb requires only
the thumb extended; V requires only index and middle extended. `validation_ms`
is 100..1000 (default 250). `post_gesture_delay_ms` must equal 1000.
The one-second suppression starts at validation, cancels recognition state,
and suppresses recording samples. A held command remains latched; a deliberate
known release is necessary before another activation. Lost hands are not release.
Each gesture/hand pair can bind only one application action; duplicate enabled
bindings are rejected. Choosing a previously assigned sign in the controls editor
removes the other assignment, preventing default Right V recalibration from also
firing when Right V is reassigned to recording.

Global V commands require index/middle >=0.7, ring/pinky <=0.4 and thumb <=0.55
(a partially curled thumb is accepted). Thumb commands retain the strict >=0.7 /
<=0.3 pattern. All five observations must be known. These command tolerances do
not change persisted finger constraints. Command continuity tolerates up to 500 ms
between observations; the app accepts command results up to 500 ms old. Movement
recognition, overlays and keyboard freshness retain the tighter 250 ms limit.
`record_toggle` remains a valid schema field for the retained recorder backend;
current Studio does not expose recording tools. The main status and logs expose
command recognition/recovery.

## Purple Interaction cells

Only `type: "interaction"` requires an `interaction` object. Other constraint
types reject that object. Interaction cells belong to steps and fire the same
logical action/keyboard shortcut as yellow Trigger cells. An input can have at
most one High firing group across both types. Numbered alternatives retain their
own hand/sign/hold settings. Existing finger rules still apply at every scope.

```json
{
  "id": "confirm", "landmark": "left_wrist", "cell": [4, 5],
  "type": "interaction", "priority": "high",
  "interaction": {"hand": "left", "gesture": "ok", "hold_ms": 400}
}
```

`hand` is anatomical `left` or `right`; `gesture` is `thumb`, `v`, `ok`,
`open_palm` or `fist` (`none` is invalid). `hold_ms` is 0..60000 and defaults to
0 (immediate). The designated landmark must currently occupy the region while
the chosen hand matches the sign. Sweeping across the region is insufficient.
The hold starts once the movement's prerequisites and step hold are satisfied.
Leaving the region, losing the sign/observations, missing required landmarks,
stale tracking, Restart or discontinuity resets it. Inputs containing only
Interaction and Forbidden constraints allow up to 500 ms between hand observations;
movement paths and spatial sweep interpolation retain the 180 ms maximum gap.
Keyboard output still requires fresh results (250 ms). An occupied Interaction
region with its matching sign reserves that anatomical hand from global commands,
including while held/cooling down, so a default recalibration binding cannot
interrupt the input. Outside the region, global commands work normally.
Finger rules retain their explicit configured grace period. Low tolerance regions
must inherit the High target's identical Interaction settings; the combined
High/tolerance area shares that target's timer. Each numbered High alternative
has its own timer. Mirror swaps the hand and landmark. The normal release/rearm
latch and input cooldown apply after firing.

OK uses the 3D thumb-tip/index-tip distance divided by palm width (index MCP to
pinky MCP), corrected for image aspect. It requires ratio <=0.25, known contact
confidence >=0.6, and middle/ring/pinky extension >=0.7. Missing or degenerate
palm/contact observations reject OK. Open palm requires all five extensions >=0.7;
Fist requires all five <=0.3. All five fingers must have confidence >=0.6.
These classifiers serve global commands, status and Interaction cells.

### Editing and feedback

Use the current platform guide for [Windows Interaction editing](../getting-started/windows.md)
or [Linux Advanced JSON](../getting-started/linux.md). Explicit `hand`, `gesture`
and `hold_ms` values stay in the constraint; left/right always refer to the user's
own anatomy. Live progress distinguishes missing observations, a sign mismatch,
additional finger-rule mismatch and elapsed/required hold duration.

For pure Interaction inputs, input-level finger mismatch resets the hold and waits
for recovery instead of permanently locking the attempt. It never bypasses that rule.

**Details** lists each bound finger, scope, pose, stable/grace time and Interaction
hand/sign/hold alongside the keyboard sequence.

The main sidebar highlights each accepted trigger in green for 900 ms, including
Test events. It is independent of keyboard/log switches, keyed by stable input ID
and never enters JSON. Stop or document replacement clears the highlight.

## Recording, limits and validation

> [!NOTE]
> **Current Studio does not expose recording tools.** The schema retains reviewed
> traces for existing profiles; those points never become recognition rules implicitly.

`recordings` entries store `{ "landmark": "head", "points": [[4.5,0.5]] }`.
Each input permits at most **34 traces**, each with **2,048 finite points** inside
`[-9,18)`. The retained recorder backend samples synchronously at up to 20 Hz for
60 seconds with a frozen coordinate basis; conversion must fit 64 steps.
These backend limits do not describe an available recording toolbar.

Files are bounded to 1 MiB and nesting depth 32. IDs/names/actions are at most
80 bytes. There are at most 1024 constraints per scope and 4096 per input.
Unknown enums/landmarks, duplicate IDs/bindings, invalid cells, unsupported schema,
misplaced Triggers and inconsistent tolerance references reject the entire load.
Saving validates and replaces atomically. Camera images, highlighted cells,
current steps, gesture latches and live recorder state are never serialized.

## Example: generic Jump

These cells are an editable example rather than a universal user calibration.
Crouch can use the same three landmarks with lower Required regions. There is
no Jump/Crouch branch in the engine.

```json
{
  "schema_version": 2,
  "tracking": {"hands": false},
  "controls": {
    "restart": {"gesture": "thumb", "hand": "left"},
    "recalibrate": {"gesture": "v", "hand": "right"},
    "record_toggle": {"gesture": "thumb", "hand": "right"},
    "validation_ms": 250,
    "post_gesture_delay_ms": 1000
  },
  "inputs": [{
    "id": "jump", "name": "Jump", "action": "jump", "keyboard": [{"keys": [32]}],
    "mirror": false, "space": "calibrated", "max_duration_ms": 0, "cooldown_ms": 0,
    "steps": [{
      "id": "rise", "mode": "simultaneous",
      "constraints": [
        {"id": "head_high", "landmark": "head", "cell": [4,-2,1,3], "type": "required", "priority": "high"},
        {"id": "left_rise", "landmark": "left_shoulder", "cell": [6,1], "type": "required", "priority": "high"},
        {"id": "right_rise", "landmark": "right_shoulder", "cell": [2,1], "type": "required", "priority": "high"}
      ]
    }]
  }]
}
```

A Low contour entry could be
`{"id":"head_margin","landmark":"head","cell":[5,0],"type":"required","priority":"low","tolerance_for":"head_high"}`
in the same step. To require an extended index at a Trigger, add
`"fingers":[{"hand":"right","finger":"index","pose":"extended"}]`
to that Trigger constraint. To require it throughout, put the list on the input.
## Editor presentation and live scaling

The editor projects the same anatomical grid used by recognition. Body view uses
the snapshot’s basis, aspect, centre, axis and shoulder scale; inverse hit testing
uses that same transform. A drawing stroke freezes the view until release.
Full grid exposes all **27 × 27 cells**, including regions outside the camera image.

| Visual marker | Schema meaning |
| --- | --- |
| Green Required | Spatial prerequisite |
| Yellow Trigger | Firing region |
| Red Forbidden / X | Guard that invalidates an attempt |
| Purple Interaction | Firing region with a hand sign and optional dwell |
| Low contour | Alternative tolerance linked to a High region, not another required visit |
| Order number | Progress within one anatomical landmark lane |

**Colours supplement labels and symbols.** Theme, visibility, inspector tabs,
selection and viewport are UI state, not profile fields. Layers group existing
constraints by landmark; they add neither a JSON array nor another recognition model.

### Reassigning a layer

In current Windows Studio, changing the tracked point **immediately reassigns its
existing zones** and updates the movement. A destination collision preserves both
drawings. IDs, cells, order, tolerance links and finger/Interaction settings remain intact.
Explicit anatomical sign/finger hands and captured trace identity are preserved;
**review hand-specific rules when changing sides**. File > Save persists the document.

The separate body-parts, recording and Undo/Redo toolbar options are removed.
See the current [Windows editing workflow](../getting-started/windows.md)
and [Linux guide](../getting-started/linux.md) for platform controls.

### Startup and integration behavior

Normal application startup is an empty configuration, with Right V assigned to
Recalibrate (Hands remains off until enabled). Bundled `configs/default.json` is
an example that must be opened explicitly or passed with `--config`; its three
sample cells are never forced into newly authored inputs. Applying remote bindings
enables Hands and persists the setting. Recalibrate clears calibration/progress
and retains the fixed one-second command recovery and held-gesture latch.

`tracking.hands` also controls whether the bundled browser camera example runs hand inference.
Hosts may still supply explicit hand observations to the positions-only engine.

The visual examples now have separate raised-hands and profile-import entry points.
Profile importers initially use an empty `inputs` array and report the imported
action/id verbatim. A successful import replaces the engine and recalibrates;
failed validation preserves the previous profile. Python performs import and camera
restart on its capture owner thread because successful `mig_load` stops capture.
The C++ examples keep their camera source while replacing the recognition engine.
All camera profile importers follow `tracking.hands` when deciding whether to run
their hand model; raised-hands demos enable it for visualization. Text feedback, profile
file paths and demo/import mode are presentation state, not JSON schema fields.
Native Motion Input Grid Controller/C-ABI capture rejects recognition older than 250 ms using the
current monotonic clock; hosts submitting their own packets own their time source.

React, Vue and Next.js use the same schema-v2 profile through the browser session.
Their profile pages start empty, follow `tracking.hands`, and preserve the active
profile after invalid imports. Successful imports clear displayed actions and
recalibrate without restarting the video stream. Framework, theme, asset URLs and
feedback are host presentation settings; no fields were added to JSON. Accepted
callbacks are logical application events, not desktop key injection or a Hold/
Repeat scheduler. See [JavaScript integration](../integrations/javascript.md).

MIG 1.1.0 uses schema version 2. See [bootstrap](../getting-started/bootstrap.md) and [example code](../getting-started/examples.md).

## Motion Input Grid Controller profile list

The Motion Input Grid Controller keeps its named profile list in a separate `profiles.json`, with
`version: 1`, `selected` (zero-based index, or -1) and a `profiles` array of
`{ "id": "1", "name": "Game" }` entries. Numeric IDs identify managed files
`1.json`, `2.json`, etc.; these remain normal schema-v2 configurations. The list
is bounded to 64 entries and 64 KiB, names to 256 UTF-8 bytes. Imports and list
updates use atomic replacement. Camera visibility, verification and keyboard consent
are session settings and do not change motion JSON. See [Motion Input Grid Controller](../guides/controller.md).

## Complete Studio HI example

The complete [studio-hi.json](../../configs/studio-hi.json) profile is the small example used by the interactive website tutorial. Import it directly into Studio or Controller. It tracks the anatomical left wrist in body space: visit the lower green band, then the upper yellow band to emit `next_slide` and press Right Arrow once. Region sizes are a starting point to test with your camera.

```json
{
  "schema_version": 2,
  "tracking": {"hands": false},
  "inputs": [{
    "id": "hi", "name": "HI", "action": "next_slide", "space": "body",
    "cooldown_ms": 700,
    "keyboard": [{"keys": [39]}],
    "action_mode": "single_press",
    "steps": [{
      "id": "wave", "mode": "ordered",
      "constraints": [
        {"id": "start", "landmark": "left_wrist", "cell": [-4, 4, 18, 4],
         "type": "required", "priority": "high", "order": 1},
        {"id": "finish", "landmark": "left_wrist", "cell": [-4, -3, 18, 6],
         "type": "trigger", "priority": "high", "order": 2}
      ]
    }]
  }]
}
```

> [!IMPORTANT]
> **Omitting `keyboard` or using `[]` sends no keys.** The profile’s logical action name does not imply a keyboard binding.

| Binding | Result |
| --- | --- |
| `[{"keys":[17,39]}]` | One simultaneous Ctrl+Right shortcut |
| `[{"keys":[17]},{"keys":[39]}]` | Press/release Ctrl, then press/release Right |
| `action_mode: "hold"` | Keep only the final chord held while activation is valid |
| `action_mode: "repeat"` | Repeat the sequence while activation is valid |

There is no implicit key or custom delay field. `blocking` is not a profile field:
use `type: "forbidden"` constraints. Only **`schema_version: 2`** is supported.
