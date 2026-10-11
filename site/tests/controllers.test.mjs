import assert from "node:assert/strict";
import { test } from "node:test";
import { PresenceMonitor } from "../src/presence.mjs";
import { SlideController } from "../src/slides.mjs";
import { translations } from "../src/translations.mjs";
import { settings } from "../src/settings.mjs";
import { cameraError } from "../src/camera.mjs";

test("presence waits for a person and ignores a brief dropout", () => {
    const presence = new PresenceMonitor(settings);
    assert.equal(presence.update(false, 0), "waiting");
    assert.equal(presence.update(false, 500), "waiting");
    assert.equal(presence.update(true, 600), "present");
    assert.equal(presence.update(false, 700), "present");
    assert.equal(presence.update(true, 900), "present");
});

test("sustained departure hides the page; stable return opens it", () => {
    const presence = new PresenceMonitor(settings);
    presence.update(true, 0);
    for (let time = 100; time <= 600; time += 100) {
        assert.equal(presence.update(false, time), "present");
    }
    assert.equal(presence.update(false, 700), "away");
    assert.equal(presence.update(true, 800), "away");
    assert.equal(presence.update(false, 900), "away");
    assert.equal(presence.update(true, 1000), "away");
    assert.equal(presence.update(true, 1299), "away");
    assert.equal(presence.update(true, 1300), "present");
    presence.reset();
    assert.equal(presence.state, "waiting");
});

test("absence completes without another camera frame and return cancels pending absence", () => {
    const presence = new PresenceMonitor(settings);
    presence.update(true, 0);
    presence.update(false, 100);
    assert.equal(presence.tick(700), "away");
    presence.update(true, 800);
    assert.equal(presence.tick(1100), "present");
    presence.update(false, 1200);
    assert.equal(presence.update(true, 1500), "present");
    assert.equal(presence.tick(3000), "present");
    presence.reset();
    assert.equal(presence.tick(10000), "waiting");
});

test("isolated confident false positives cannot continually cancel departure", () => {
    const presence = new PresenceMonitor(settings);
    presence.update(true, 0);
    presence.update(false, 100);
    for (const time of [200, 400, 600]) {
        assert.equal(presence.update(true, time), "present");
        presence.update(false, time + 50);
    }
    assert.equal(presence.update(false, 700), "away");
    presence.update(true, 800);
    assert.equal(presence.update(false, 850), "away");
    presence.update(true, 900);
    assert.equal(presence.update(true, 1200), "present");
});

test("sustained confident recovery cancels departure before hiding the page", () => {
    const presence = new PresenceMonitor(settings);
    presence.update(true, 0);
    presence.update(false, 100);
    presence.update(true, 200);
    assert.equal(presence.update(true, 500), "present");
    assert.equal(presence.update(false, 600), "present");
    assert.equal(presence.tick(1199), "present");
    assert.equal(presence.tick(1200), "away");
});

test("carousel stays bounded and manual navigation does not insert a gift", () => {
    const slides = new SlideController(3);
    assert.equal(slides.move(-1), 0);
    assert.equal(slides.canMove(-1), false);
    assert.equal(slides.move(1), 1);
    assert.equal(slides.move(1), 2);
    assert.equal(slides.move(1), 2);
    assert.equal(slides.canMove(1), false);
    assert.deepEqual(slides.entries, [0, 1, 2]);
    assert.equal(slides.gesture("next_slide", 0), false);
    assert.equal(slides.gesture("previous_slide", 0), true);
    assert.equal(slides.gesture("previous_slide", 100), false);
    assert.equal(slides.gesture("unrelated", 2000), false);
});

test("both languages cover the same UI and slides; public links use HTTPS", () => {
    assert.deepEqual(Object.keys(translations.fr).sort(), Object.keys(translations.en).sort());
    for (const text of Object.values(translations)) {
        assert.equal(text.slides.length, 3);
        assert.ok(Object.values(text).every(value => value.length > 0));
    }
    for (const link of Object.values(settings.links)) {
        assert.equal(new URL(link).protocol, "https:");
    }
    assert.equal(settings.links.linkedin, "https://www.linkedin.com/in/robin-g0/");
});

test("camera errors give usable recovery messages", () => {
    assert.equal(cameraError("Permission denied"), "denied");
    assert.equal(cameraError("NotFoundError: no device"), "unavailable");
    assert.equal(cameraError("Unexpected model failure"), "error");
});

test("a first forward hand gesture inserts a gift; leaving it restores the original sequence", () => {
    for (const exit of [-1, 1]) {
        const slides = new SlideController(3);
        slides.gesture("next_slide", 0);
        assert.equal(slides.index, 1);
        assert.deepEqual(slides.entries, [0, "gift", 1, 2]);
        slides.gesture("previous_slide", 900);
        assert.equal(slides.index, "gift");
        slides.move(exit);
        assert.equal(slides.index, exit === 1 ? 1 : 0);
        assert.deepEqual(slides.entries, [0, 1, 2]);
        slides.select(0);
        slides.gesture("next_slide", 2000);
        assert.deepEqual(slides.entries, [0, 1, 2]);
    }
});

test("either wrist needs a fresh continuous track before each sweep", async () => {
    const { CameraSwipes } = await import("../src/camera-swipes.mjs");
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
    const { CameraSwipes } = await import("../src/camera-swipes.mjs");
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
    const { CameraSwipes } = await import("../src/camera-swipes.mjs");
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
    const { CameraSwipes } = await import("../src/camera-swipes.mjs");
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
    const { CameraSwipes } = await import("../src/camera-swipes.mjs");
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
    const { CameraSwipes } = await import("../src/camera-swipes.mjs");
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
    const { CameraSwipes } = await import("../src/camera-swipes.mjs");
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
    const { CameraSwipes } = await import("../src/camera-swipes.mjs");
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
    const { CameraSwipes } = await import("../src/camera-swipes.mjs");
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


test("framing reserves a quarter at each edge and requires both visible wrists", async () => {
    const { cameraFrame } = await import("../src/camera-framing.mjs");
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
    const { cameraFrame } = await import("../src/camera-framing.mjs");
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
    const { StableCameraFrame } = await import("../src/stable-camera-frame.mjs");
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

test("tracking jumps after occlusion need a new centred start", async () => {
    const { CameraSwipes } = await import("../src/camera-swipes.mjs");
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
    const { CameraSwipes } = await import("../src/camera-swipes.mjs");
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

test("tab suspension discards stale observations until a fresh frame arrives", () => {
    const presence = new PresenceMonitor(settings);
    presence.update(true, 0);
    presence.update(false, 100);
    presence.pause();
    assert.equal(presence.tick(10000), "present");
    assert.equal(presence.update(true, 10100), "present");
    presence.update(false, 10200);
    assert.equal(presence.tick(10800), "away");
    presence.pause();
    assert.equal(presence.tick(20000), "away");
    assert.equal(presence.update(true, 20100), "away");
    assert.equal(presence.tick(20400), "present");
});

test("a stationary central wrist remains armed before left sweeps and lowering", async () => {
    const { CameraSwipes } = await import("../src/camera-swipes.mjs");
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
    const { CameraSwipes } = await import("../src/camera-swipes.mjs");
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
    const { CameraSwipes } = await import("../src/camera-swipes.mjs");
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
    const { CameraSwipes } = await import("../src/camera-swipes.mjs");
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

test("framing reports an outlying second wrist even when the first is central", async () => {
    const { cameraFrame } = await import("../src/camera-framing.mjs");
    const { focusedWrist } = await import("../src/hand-focus.mjs");
    const session = { coordinate: index => index === 15 ? { x: .5, y: .5 } : { x: .55, y: .95 } };
    assert.equal(focusedWrist(session).landmark, 15);
    assert.deepEqual(cameraFrame(session, ["bottom"]), { edges: ["bottom"], centred: false });
});

test("slow central tracking drift does not periodically revoke gesture readiness", async () => {
    const { CameraSwipes } = await import("../src/camera-swipes.mjs");
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
    const { CameraSwipes } = await import("../src/camera-swipes.mjs");
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
