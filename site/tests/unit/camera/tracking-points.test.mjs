import assert from "node:assert/strict";
import { test } from "node:test";
import { handPosition, focusedWrist, bothHandsVisible, bothHandsCentred, handsAtTargets } from "../../../src/camera/hand-focus.mjs";
import { bodyPresent } from "../../../src/camera/body-presence.mjs";
import { CameraSwipes } from "../../../src/camera/camera-swipes.mjs";
import { cameraFrame } from "../../../src/camera/camera-framing.mjs";

function session(points) {
    return { coordinate: index => points[index] ?? null };
}

test("desktop gestures start with two central hands and can finish beyond the central frame", () => {
    for (const direction of [1, -1]) {
        const swipes = new CameraSwipes({ startRadius: .25, requiredHands: 2 });
        const start = direction === 1 ? .7 : .3;
        const camera = x => session({ 15: { x, y: .5, confidence: .9 },
            16: { x: .5, y: .5, confidence: .9 } });
        assert.deepEqual(swipes.update(camera(start), 0), []);
        assert.deepEqual(swipes.update(camera(start), 200), []);
        assert.equal(swipes.isArmed(250, camera(start + direction * .05), 15), true);
        assert.deepEqual(swipes.update(camera(start + direction * .05), 300), []);
        assert.deepEqual(swipes.update(camera(start + direction * .1), 450),
            [direction === 1 ? "next_slide" : "previous_slide"]);
        assert.deepEqual(swipes.update(camera(start + direction * .15), 650), []);
        assert.equal(swipes.isArmed(650, camera(start + direction * .15), 15), false);
    }
});

test("desktop cannot arm outside the centre or borrow a missing second hand", () => {
    for (const other of [null, { x: .8, y: .5, confidence: .9 },
        { x: .5, y: .5, confidence: .79 }]) {
        const swipes = new CameraSwipes({ startRadius: .25, requiredHands: 2 });
        for (const [time, x] of [[0, .5], [200, .5], [350, .6], [500, .7]]) {
            const camera = session({ 15: { x, y: .5, confidence: .9 }, 16: other });
            assert.deepEqual(swipes.update(camera, time), []);
            assert.equal(swipes.isArmed(time, camera, 15), false);
        }
    }
});

test("vertical gestures can finish outside the centre but cannot start there", () => {
    for (const direction of [1, -1]) {
        const swipes = new CameraSwipes({ startRadius: .25, requiredHands: 2 });
        const start = direction === 1 ? .7 : .3;
        const camera = y => session({ 15: { x: .5, y, confidence: .9 },
            16: { x: .5, y: .5, confidence: .9 } });
        swipes.update(camera(start), 0);
        swipes.update(camera(start), 200);
        assert.deepEqual(swipes.update(camera(start + direction * .1), 350), []);
        assert.deepEqual(swipes.update(camera(start + direction * .2), 500),
            [direction === 1 ? "scroll_previous" : "scroll_presentation"]);
        assert.equal(swipes.canStart(camera(start + direction * .2)), false);
        assert.deepEqual(swipes.update(camera(start + direction * .25), 700), []);
    }
});

test("phone framing follows the central reliable wrist instead of an outlying second estimate", () => {
    for (const wrist of [15, 16]) {
        const other = wrist === 15 ? 16 : 15;
        const camera = session({ [wrist]: { x: .5, y: .5, confidence: .9 },
            [other]: { x: .95, y: .95, confidence: .9 } });
        assert.deepEqual(cameraFrame(camera, [], 1), { edges: [], centred: true });
        assert.equal(cameraFrame(camera).centred, false);
    }
});

test("phone can position and navigate with either wrist alone while ignoring the other wrist", () => {
    for (const wrist of [15, 16]) {
        const swipes = new CameraSwipes({ startRadius: .25, requiredHands: 1 });
        const camera = x => session({ [wrist]: { x, y: .5, confidence: .9 } });
        assert.equal(handsAtTargets(camera(.5), .16, 1), true);
        assert.equal(handsAtTargets(camera(.8), .16, 1), false);
        assert.deepEqual(swipes.update(camera(.5), 0), []);
        assert.deepEqual(swipes.update(camera(.5), 200), []);
        assert.equal(swipes.isArmed(300, camera(.55)), true);
        assert.equal(swipes.isArmed(300, camera(.55), wrist === 15 ? 16 : 15), false);
        assert.deepEqual(swipes.update(camera(.6), 350), ["next_slide"]);
    }
});

test("both wrists must be reliable and inside the central frame", () => {
    const valid = { x: .5, y: .5, confidence: .8 };
    for (const wrist of [15, 16]) {
        const other = wrist === 15 ? 16 : 15;
        for (const point of [null, { ...valid, confidence: .79 },
            { ...valid, confidence: NaN }, { ...valid, x: .249 },
            { ...valid, x: .751 }, { ...valid, y: .249 }, { ...valid, y: .751 }]) {
            assert.equal(bothHandsCentred(session({ [wrist]: point, [other]: valid })), false);
        }
        for (const point of [{ ...valid, x: .25, y: .25 }, { ...valid, x: .75, y: .75 }]) {
            assert.equal(bothHandsCentred(session({ [wrist]: point, [other]: valid })), true);
        }
    }
});

test("two-hand visibility and positioning require two reliable, separated wrists", () => {
    const left = { x: .65, y: .5, confidence: .9 };
    const right = { x: .35, y: .5, confidence: .9 };
    const camera = session({ 15: left, 16: right });
    assert.equal(bothHandsVisible(camera), true);
    assert.equal(handsAtTargets(camera), true);
    assert.equal(handsAtTargets(session({ 15: right, 16: left })), true);
    for (const point of [null, { ...right, confidence: .2 }, { ...right, x: -1 }]) {
        const missing = session({ 15: left, 16: point });
        assert.equal(bothHandsVisible(missing), false);
        assert.equal(handsAtTargets(missing), false);
    }
    assert.equal(handsAtTargets(session({ 15: left, 16: left })), false);
    assert.equal(handsAtTargets(session({ 15: left, 16: { ...right, y: .95 } })), false);
});

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

test("finger points can provide visual feedback but cannot authorize an absent wrist", () => {
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
    assert.deepEqual(events, []);
    assert.deepEqual(handPosition(session({
        17: { x: .5, y: .49, confidence: .9 },
        19: { x: .5, y: .51, confidence: .9 }
    }), 15), { x: .5, y: .5 });
    assert.equal(handPosition(session({ 17: { x: .5, y: .5 } }), 15), null);
});

test("finger estimates cannot replace an out-of-frame or low-confidence wrist", () => {
    for (const landmark of [15, 16]) {
        for (const anchor of [null, { x: -.1, y: .5, confidence: .9 },
            { x: 1.1, y: .5, confidence: .9 }, { x: .5, y: .5, confidence: .2 }]) {
            const swipes = new CameraSwipes();
            for (let time = 0; time <= 3000; time += 100) {
                const x = .5 + Math.sin(time / 200) * .25;
                const y = .5 + Math.cos(time / 200) * .25;
                const camera = session({
                    [landmark]: anchor,
                    [landmark + 2]: { x, y, confidence: .95 },
                    [landmark + 4]: { x, y, confidence: .95 },
                    [landmark + 6]: { x, y, confidence: .95 }
                });
                assert.deepEqual(swipes.update(camera, time), []);
                assert.equal(swipes.isArmed(time, camera, landmark), false);
            }
        }
    }
});

test("changing finger estimates cannot move a stationary visible wrist", () => {
    for (const landmark of [15, 16]) {
        const swipes = new CameraSwipes();
        for (let time = 0; time <= 3000; time += 100) {
            const finger = { x: .5 + Math.sin(time / 250) * .16, y: .5, confidence: .95 };
            const camera = session({
                [landmark]: { x: .5, y: .5, confidence: .95 },
                [landmark + 2]: finger,
                [landmark + 4]: finger,
                [landmark + 6]: finger
            });
            assert.deepEqual(swipes.update(camera, time), []);
            if (time >= 200) assert.equal(swipes.isArmed(time, camera, landmark), true);
        }
    }
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

test("a continuous-frame tracking teleport cannot trigger a camera or native action", () => {
    for (const landmark of [15, 16]) {
        for (const x of [.1, .9]) {
            const swipes = new CameraSwipes();
            let point = { x: .5, y: .5 };
            const camera = { coordinate: index => index === landmark ? point : null };
            swipes.update(camera, 0);
            swipes.update(camera, 200);
            point = { x, y: .5 };
            assert.equal(swipes.isArmed(220, camera, landmark), false);
            assert.deepEqual(swipes.update(camera, 220), []);
            assert.equal(swipes.isArmed(220), false);
        }
    }
});

test("the selected hand stays selected during a cross-body sweep", () => {
    const camera = session({
        15: { x: .85, y: .5 },
        16: { x: .5, y: .5 }
    });
    assert.equal(focusedWrist(camera, 15).landmark, 15);
    assert.equal(focusedWrist(session({ 15: { x: .5, y: .95 }, 16: { x: .5, y: .5 } }), 15).landmark, 16);
});
