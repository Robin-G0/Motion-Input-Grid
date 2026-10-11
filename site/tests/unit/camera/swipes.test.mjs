import assert from "node:assert/strict";
import { test } from "node:test";
import { CameraSwipes } from "../../../src/camera/camera-swipes.mjs";

test("either wrist needs a fresh continuous track before each sweep", async () => {
    for (const landmark of [15, 16]) {
        for (const [dx, dy, action] of [[.1, 0, "next_slide"], [-.1, 0, "previous_slide"],
            [0, -.24, "scroll_presentation"], [0, .24, "scroll_previous"]]) {
            const swipes = new CameraSwipes();
            let wrist = { x: .1, y: .1 };
            const session = { coordinate: index => index === landmark ? wrist : null };
            swipes.update(session, 0);
            wrist = { x: .9, y: .9 };
            assert.deepEqual(swipes.update(session, 300), []);
            wrist = { x: .5, y: .5 };
            swipes.update(session, 400);
            swipes.update(session, 600);
            wrist = { x: .5 + dx / 2, y: .5 + dy / 2 };
            assert.deepEqual(swipes.update(session, 750), []);
            wrist = { x: .5 + dx, y: .5 + dy };
            assert.deepEqual(swipes.update(session, 900), [action]);
            wrist = { x: .5 - dx, y: .5 - dy };
            assert.deepEqual(swipes.update(session, 1200), []);
        }
    }
});

test("both wrists can start gestures across almost the entire camera", async () => {
    for (const landmark of [15, 16]) {
        for (const [x, y] of [[.03, .5], [.97, .5], [.5, .03], [.5, .97]]) {
            const swipes = new CameraSwipes();
            const wrist = { x, y };
            const session = { coordinate: index => index === landmark ? wrist : null };
            assert.deepEqual(swipes.update(session, 0), []);
            assert.deepEqual(swipes.update(session, 149), []);
            assert.equal(swipes.isArmed(149), false);
            assert.deepEqual(swipes.update(session, 150), []);
            assert.equal(swipes.isArmed(150, session, landmark), true);
            const direction = x > .5 ? -1 : 1;
            wrist.x += direction * .1;
            assert.deepEqual(swipes.update(session, 300),
                [direction > 0 ? "next_slide" : "previous_slide"]);
            assert.equal(swipes.isArmed(300), false);
        }
    }
});

test("short horizontal gestures need 100 ms and fresh tracking for the next gesture", async () => {
    for (const direction of [-1, 1]) {
        const swipes = new CameraSwipes();
        let wrist = { x: .5, y: .5 };
        const session = { coordinate: index => index === 15 ? wrist : null };
        swipes.update(session, 0);
        swipes.update(session, 150);
        wrist.x = .5 + direction * .081;
        assert.deepEqual(swipes.update(session, 249), []);
        assert.deepEqual(swipes.update(session, 250), [direction > 0 ? "next_slide" : "previous_slide"]);
        wrist = { x: .5, y: .5 };
        swipes.update(session, 300);
        swipes.update(session, 449);
        assert.equal(swipes.isArmed(449), false);
        swipes.update(session, 450);
        assert.equal(swipes.isArmed(450), true);
        wrist.x = .5 - direction * .081;
        assert.deepEqual(swipes.update(session, 550), [direction > 0 ? "previous_slide" : "next_slide"]);
    }
});

test("small, diagonal and instantaneous hand lifts do not scroll", async () => {
    for (const samples of [
        [[0, .5, .5], [150, .5, .41], [300, .5, .32]],
        [[0, .5, .5], [150, .7, .2], [300, .9, 0]],
        [[0, .5, .5], [100, .5, .06]]
    ]) {
        const swipes = new CameraSwipes();
        let wrist = { x: .5, y: .5 };
        const session = { coordinate: index => index === 15 ? wrist : null };
        swipes.update(session, -200);
        swipes.update(session, 0);
        for (const [time, x, y] of samples) {
            wrist = { x, y };
            assert.ok(!swipes.update(session, time).includes("scroll_presentation"));
        }
    }
});

test("either hand scrolls in both directions with 19 percent travel and 175 ms", async () => {
    for (const landmark of [15, 16]) {
        for (const direction of [-1, 1]) {
            for (const limitedBy of ["distance", "duration"]) {
                const swipes = new CameraSwipes();
                let wrist = { x: .5, y: .5 };
                const session = { coordinate: index => index === landmark ? wrist : null };
                swipes.update(session, 0);
                swipes.update(session, 150);
                wrist.y = .5 + direction * (limitedBy === "distance" ? .189 : .191);
                assert.deepEqual(swipes.update(session, limitedBy === "duration" ? 324 : 325), []);
                wrist.y = .5 + direction * .191;
                assert.deepEqual(swipes.update(session, 325), [direction > 0 ? "scroll_previous" : "scroll_presentation"]);
                assert.deepEqual(swipes.update(session, 400), []);
            }
        }
    }
});

test("sweeps originating at the camera edges are ignored", async () => {
    for (const landmark of [15, 16]) {
        for (const direction of [1, -1]) {
            const swipes = new CameraSwipes();
            let wrist = { x: .01, y: direction === 1 ? .99 : .01 };
            const session = { coordinate: index => index === landmark ? wrist : null };
            swipes.update(session, 0);
            wrist.y = .5;
            assert.deepEqual(swipes.update(session, 150), []);
            wrist.y = direction === 1 ? .15 : .85;
            assert.deepEqual(swipes.update(session, 300), []);
        }
    }
});

test("slow vertical sweeps tolerate jitter and a brief occlusion in both directions", async () => {
    for (const landmark of [15, 16]) {
        for (const direction of [-1, 1]) {
            const swipes = new CameraSwipes();
            let wrist = { x: .5, y: .5 };
            const session = { coordinate: index => index === landmark ? wrist : null };
            swipes.update(session, -200);
            swipes.update(session, 0);
            const actions = [];
            for (let frame = 0; frame <= 36; frame++) {
                const y = .5 - direction * frame * .01;
                wrist = frame === 12 ? null : { x: .5 + Math.sin(frame) * .005, y };
                actions.push(...swipes.update(session, frame * 40));
            }
            assert.deepEqual(actions, [direction === 1 ? "scroll_presentation" : "scroll_previous"]);
        }
    }
});

test("slow horizontal sweeps survive brief occlusion without turning vertical drift into a slide", async () => {
    for (const direction of [-1, 1]) {
        const swipes = new CameraSwipes();
        let wrist;
        const actions = [];
        const session = { coordinate: index => index === 16 ? wrist : null };
        wrist = { x: .5, y: .5 };
        swipes.update(session, -200);
        swipes.update(session, 0);
        for (let frame = 0; frame <= 20; frame++) {
            wrist = frame === 10 ? null : { x: .5 + direction * frame * .009, y: .5 };
            actions.push(...swipes.update(session, frame * 80));
        }
        assert.deepEqual(actions, [direction === 1 ? "next_slide" : "previous_slide"]);
    }
    const swipes = new CameraSwipes();
    let wrist = { x: .5, y: .5 };
    const session = { coordinate: () => wrist };
    swipes.update(session, 0);
    swipes.update(session, 200);
    wrist = { x: .68, y: .2 };
    assert.ok(!swipes.update(session, 400).includes("next_slide"));
});

test("a reversal after stale tracking starts a new gesture instead of scrolling immediately", async () => {
    const swipes = new CameraSwipes();
    let wrist = { x: .5, y: .5 };
    const session = { coordinate: index => index === 15 ? wrist : null };
    swipes.update(session, -200);
    swipes.update(session, 0);
    wrist.y = .25;
    assert.deepEqual(swipes.update(session, 150), []);
    wrist.y = .95;
    assert.deepEqual(swipes.update(session, 1000), []);
});

test("tracking jumps after occlusion need a new centred start", async () => {
    const swipes = new CameraSwipes();
    let wrist = { x: .5, y: .5 };
    const session = { coordinate: index => index === 15 ? wrist : null };
    swipes.update(session, 0);
    swipes.update(session, 200);
    assert.equal(swipes.isArmed(200), true);
    wrist = null;
    swipes.update(session, 250);
    wrist = { x: .9, y: .1 };
    assert.deepEqual(swipes.update(session, 300), []);
    assert.equal(swipes.isArmed(300), false);
    wrist = { x: .7, y: .1 };
    assert.deepEqual(swipes.update(session, 450), []);
});

test("central crossings, invalid points and expired arming cannot trigger navigation", async () => {
    const swipes = new CameraSwipes();
    let wrist = { x: .2, y: .5 };
    const session = { coordinate: index => index === 16 ? wrist : null };
    for (const [time, x] of [[0, .2], [50, .5], [100, .8]]) {
        wrist.x = x;
        assert.deepEqual(swipes.update(session, time), []);
    }
    wrist = { x: .5, y: .5 };
    swipes.update(session, 200);
    swipes.update(session, 400);
    assert.equal(swipes.isArmed(400), true);
    assert.equal(swipes.isArmed(900), false);
    wrist = { x: NaN, y: .5 };
    assert.deepEqual(swipes.update(session, 450), []);
    wrist = { x: 2, y: .5 };
    assert.deepEqual(swipes.update(session, 500), []);
});

test("a stationary central wrist remains armed before left sweeps and lowering", async () => {
    for (const action of ["next_slide", "scroll_previous"]) {
        const swipes = new CameraSwipes();
        let wrist = { x: .5, y: .5 };
        const session = { coordinate: index => index === 15 ? wrist : null };
        for (let time = 0; time <= 10000; time += 100) {
            assert.deepEqual(swipes.update(session, time), []);
        }
        assert.equal(swipes.isArmed(10000), true);
        wrist = action === "next_slide" ? { x: .72, y: .5 } : { x: .5, y: .8 };
        assert.deepEqual(swipes.update(session, 10300), [action]);
    }
});

test("continuous motion and tracking jitter do not require a stationary hand to arm", async () => {
    const swipes = new CameraSwipes();
    let wrist = { x: .5, y: .5 };
    const session = { coordinate: index => index === 16 ? wrist : null };
    swipes.update(session, 0);
    for (const [time, x, y] of [[50, .53, .48], [100, .56, .52], [150, .6, .5]]) {
        wrist = { x, y };
        assert.deepEqual(swipes.update(session, time), []);
    }
    assert.equal(swipes.isArmed(150), true);
    wrist.x = .7;
    assert.deepEqual(swipes.update(session, 300), ["next_slide"]);
});

test("vertical gestures start near either side despite initial tracking jitter", async () => {
    for (const landmark of [15, 16]) {
        for (const direction of [-1, 1]) {
            const swipes = new CameraSwipes();
            const x = landmark === 15 ? .05 : .95;
            let wrist = { x, y: .5 };
            const session = { coordinate: index => index === landmark ? wrist : null };
            swipes.update(session, 0);
            for (const [time, offset] of [[50, .02], [100, -.02], [150, 0]]) {
                wrist = { x, y: .5 + offset };
                assert.deepEqual(swipes.update(session, time), []);
            }
            assert.equal(swipes.isArmed(150), true);
            wrist.y += direction * .12;
            assert.deepEqual(swipes.update(session, 300), []);
            wrist.y += direction * .12;
            assert.deepEqual(swipes.update(session, 450),
                [direction < 0 ? "scroll_presentation" : "scroll_previous"]);
        }
    }
});

test("a plausible deliberate motion survives a brief lost detection", async () => {
    const swipes = new CameraSwipes();
    let wrist = { x: .5, y: .5 };
    const session = { coordinate: index => index === 16 ? wrist : null };
    swipes.update(session, 0);
    swipes.update(session, 200);
    wrist = null;
    swipes.update(session, 300);
    wrist = { x: .5, y: .8 };
    assert.deepEqual(swipes.update(session, 500), ["scroll_previous"]);
});

test("slow central tracking drift does not periodically revoke gesture readiness", async () => {
    const swipes = new CameraSwipes();
    let wrist = { x: .5, y: .5 };
    const session = { coordinate: index => index === 15 ? wrist : null };
    for (let time = 0; time <= 10000; time += 100) {
        wrist = { x: .5 + Math.min(.06, time / 100000), y: .5 };
        assert.deepEqual(swipes.update(session, time), []);
        if (time >= 200) assert.equal(swipes.isArmed(time), true);
    }
});

test("initial tracking needs 150 ms and authorizes only that wrist", async () => {
    for (const landmark of [15, 16]) {
        const swipes = new CameraSwipes();
        const session = { coordinate: index => index === landmark ? { x: .5, y: .5 } : { x: .99, y: .99 } };
        swipes.update(session, 0);
        swipes.update(session, 149);
        assert.equal(swipes.isArmed(149, session, landmark), false);
        swipes.update(session, 150);
        assert.equal(swipes.isArmed(150, session, landmark), true);
        assert.equal(swipes.isArmed(150, session, landmark === 15 ? 16 : 15), false);
    }
});
