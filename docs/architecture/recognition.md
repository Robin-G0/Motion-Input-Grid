# Recognition and coordinates

[English](recognition.md) | [Français](recognition.fr.md)

> [!TIP]
> **A missed gesture?** Check [sampling gaps and observation age](#low-frame-rates-and-demo-paths) first.
> A 180 ms sampling gap and a 250 ms-old packet are different failure conditions.

## Grid and coordinate spaces

The image carries normalized unmirrored anatomical indices. Aspect correction
prevents horizontal camera dimensions changing distances. Valid shoulders provide
a torso axis, center and width. Calibration collects a stable median baseline;
each cell is 20% of the current shoulder width, smoothed with a 35 ms time constant.
The 27x27 grid has boundaries [-9,18), origin cells -9..17 and anchor [4.5,3.5].
Body space follows the torso center/axis. Calibrated space keeps the baseline
center/axis and follows current scale so jumps/crouches remain ordinary constraints.
After gaps over 180 ms, scale adopts the fresh observation immediately.
UI projection and inverse hit testing share one transform; a stroke freezes its view.

### Depth and mirroring

Body image depth is hip-relative; hand image depth is wrist-relative. Optional
world body coordinates are meters relative to hips, while hand world coordinates
are relative to hand center. Keep these origins separate. Shoulder width ratios
can provide an approach proxy, not a physical camera distance or metric trajectory.
Unknown depth stays absent. Preview mirror reflects X once; recognition Mirror
separately swaps anatomy and reflects rules about x=4.5.

## Recognition model

Inputs have whole-input guards/fingers plus up to 64 steps. Independent regions
do not merge because they overlap. Visited accumulates visits, Simultaneous
requires current occupancy, Ordered has parallel anatomical lanes. Explicit
numbers group alternatives; unnumbered lanes follow array order. Low tolerance
links one High region. Forbidden crossing fails the attempt.

One High firing group can be Trigger or purple Interaction. Trigger validates
the preceding prefix; following rules are authoring follow-through metadata.
Interaction additionally requires current occupancy, known sign and continuous
hold up to 60000 ms. It cannot fire from a swept crossing alone. Input/step/local
finger rules apply with their own stability/grace. Missing fingers never bypass rules.
Normal variants arbitrate ambiguous same-wrist hits; Test isolates an input.
After activation, terminal conditions expose `output_active` independently of
the persistent Test highlight. Release/rearm and cooldown prevent duplicate events.

### Hand assignment and commands

Native association uses pose wrists to assign detected hands, rejecting ambiguity.
Thumb, V, OK, Open palm and Fist classification is shared by commands and
Interaction. A matching Interaction reserves its hand from global commands.
Restart/Recalibrate/RecordToggle are separate controls with validation, a deliberate
release latch and fixed 1000 ms recovery; loss of tracking is not a deliberate release.

## Low frame rates and demo paths

| Limit | Value | Meaning |
| --- | --- | --- |
| Path observation interval | ≤ 180 ms | A larger gap ends the sweep |
| Interaction-only hold interval | ≤ 500 ms | Actual occupancy and matching sign are still required; mixed path/Interaction inputs retain 180 ms continuity |
| Recognized packet age | ≤ 250 ms | Compared with current time, independently of capture intervals |

The engine tests the segment between consecutive visible positions against
regions in `constraints.cpp::crossing()`, with ordered contact positions per anatomical
lane. A fresh sample need not land in every intermediate cell. Sweeps require valid
tracking with at most 180 ms between observations; larger gaps end an active path
rather than drawing a trajectory through unknown movement. Interaction-only holds allow
500 ms gaps but require actual occupancy/sign, so swept transit cannot satisfy dwell.
Packets older than 250 ms are rejected even if their sampling interval is small.

The example profiles use broad start/finish regions and preserve upward order.
`example-motion` exercises both wrists at 33/100/160/180 ms intervals, skips intermediate
rows and checks isolated terminal poses, reverse motion, rearm and 181 ms discontinuity.

For missed actions, distinguish inference age from sampling gap, check shoulder/wrist
confidence, and verify aspect and single display mirroring. C++ overlays use the actual
engine grid. Python `grid_lines()` reconstructs a display grid from raw shoulders,
while engine scale is smoothed: changing shoulder spacing can briefly offset those
outlines. Account for this display difference when diagnosing missed actions.

