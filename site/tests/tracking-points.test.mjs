import assert from "node:assert/strict";
import { test } from "node:test";
import { handPosition } from "../src/hand-focus.mjs";
import { bodyPresent } from "../src/body-presence.mjs";
import { CameraSwipes } from "../src/camera-swipes.mjs";

function session(points) {
    return { coordinate: index => points[index] ?? null };
}

test("each hand averages its own reliable pose points without mixing sides", () => {
    const camera = session({
        15: { x: .4, y: .5, confidence: .9 },
        17: { x: .42, y: .48, confidence: .8 },
        19: { x: .44, y: .46, confidence: .9 },
        21: { x: .8, y: .1, confidence: .9 },
        16: { x: .7, y: .6, confidence: .9 },
        18: { x: .72, y: .62, confidence: .2 },
        20: { x: NaN, y: .6, confidence: 1 }
    });
    const left = handPosition(camera, 15);
    assert.ok(Math.abs(left.x - .42) < 1e-9);
    assert.ok(Math.abs(left.y - .48) < 1e-9);
    assert.deepEqual(handPosition(camera, 16), { x: .7, y: .6 });
});

test("coherent pose hand points keep a sweep working when the wrist is occluded", () => {
    const swipes = new CameraSwipes();
    const events = [];
    for (const [time, x] of [[0, .5], [200, .5], [350, .62], [500, .74]]) {
        const camera = session({
            17: { x, y: .49, confidence: .9 },
            19: { x, y: .51, confidence: .9 },
            21: { x, y: .5, confidence: .9 }
        });
        events.push(...swipes.update(camera, time));
    }
    assert.deepEqual(events, ["next_slide"]);
    assert.equal(handPosition(session({ 17: { x: .5, y: .5 } }), 15), null);
});

test("low-confidence shoulders cannot keep presence active", () => {
    const camera = score => session({
        11: { x: .35, y: .5, confidence: score },
        12: { x: .65, y: .5, confidence: score }
    });
    assert.equal(bodyPresent(camera(.79), .8), false);
    assert.equal(bodyPresent(camera(.9), .8), true);
    assert.equal(bodyPresent(camera(NaN), .8), false);
    assert.equal(bodyPresent(session({ 11: { x: .5, y: .5, confidence: 1 } }), .8), false);
});
