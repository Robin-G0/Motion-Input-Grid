import assert from "node:assert/strict";
import { test } from "node:test";
import { cameraFrame } from "../../../src/camera/camera-framing.mjs";
import { StableCameraFrame } from "../../../src/camera/stable-camera-frame.mjs";
import { focusedWrist } from "../../../src/camera/hand-focus.mjs";

test("framing reserves a quarter at each edge and requires both visible wrists", async () => {
    for (const index of [15, 16]) {
        let hand = { x: .1, y: .9 };
        const session = { coordinate: landmark => landmark === index ? hand : null };
        assert.deepEqual(cameraFrame(session), { edges: ["bottom", "right"], centred: false });
        hand = { x: .5, y: .5 };
        assert.deepEqual(cameraFrame(session), { edges: [], centred: false });
        const both = { coordinate: landmark => landmark === index ? hand
            : [15, 16].includes(landmark) ? { x: .5, y: .5 } : null };
        assert.deepEqual(cameraFrame(both), { edges: [], centred: true });
        hand = null;
        assert.deepEqual(cameraFrame(session), { edges: [], centred: false });
    }
});

test("camera edge hysteresis separates the warning and clearing thresholds on all sides", async () => {
    for (const [edge, axis, enter, jitter, clear] of [
        ["top", "y", .24, .27, .33],
        ["bottom", "y", .76, .73, .67],
        ["right", "x", .24, .27, .33],
        ["left", "x", .76, .73, .67]
    ]) {
        const hand = { x: .5, y: .5 };
        const session = { coordinate: index => index === 15 ? hand : null };
        hand[axis] = enter;
        let frame = cameraFrame(session);
        assert.deepEqual(frame.edges, [edge]);
        hand[axis] = jitter;
        frame = cameraFrame(session, frame.edges);
        assert.deepEqual(frame.edges, [edge]);
        hand[axis] = clear;
        assert.deepEqual(cameraFrame(session, frame.edges).edges, []);
        hand[axis] = jitter;
        assert.deepEqual(cameraFrame(session).edges, []);
    }
});

test("visual camera feedback ignores brief loss and requires sustained edge changes", async () => {
    const feedback = new StableCameraFrame();
    const edge = { edges: ["top"], centred: false };
    const centre = { edges: [], centred: true };
    assert.equal(feedback.update(centre, true, 0).hasHands, true);
    assert.equal(feedback.update(centre, false, 200).hasHands, true);
    assert.equal(feedback.update(centre, false, 700).hasHands, false);
    assert.deepEqual(feedback.update(edge, true, 800).edges, []);
    assert.deepEqual(feedback.update(edge, true, 1000).edges, ["top"]);
    assert.deepEqual(feedback.update(centre, true, 1100).edges, ["top"]);
    assert.deepEqual(feedback.update(edge, true, 1300).edges, ["top"]);
    feedback.update(centre, true, 1400);
    assert.deepEqual(feedback.update(centre, true, 1950).edges, []);
    feedback.reset();
    assert.equal(feedback.hasHands, false);
});

test("framing reports an outlying second wrist even when the first is central", async () => {
    const session = { coordinate: index => index === 15 ? { x: .5, y: .5 } : { x: .55, y: .95 } };
    assert.equal(focusedWrist(session).landmark, 15);
    assert.deepEqual(cameraFrame(session, ["bottom"]), { edges: ["bottom"], centred: false });
});
