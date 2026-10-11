import assert from "node:assert/strict";
import { test } from "node:test";
import { PresenceMonitor } from "../src/presence.mjs";
import { SlideController } from "../src/slides.mjs";
import { translations } from "../src/translations.mjs";
import { settings } from "../src/settings.mjs";
import { cameraError } from "../src/camera.mjs";

test("presence waits for a person and ignores a brief dropout", () => {
    const presence = new PresenceMonitor();
    assert.equal(presence.update(false, 0), "waiting");
    assert.equal(presence.update(false, 500), "waiting");
    assert.equal(presence.update(true, 600), "present");
    assert.equal(presence.update(false, 700), "present");
    assert.equal(presence.update(true, 900), "present");
});

test("sustained departure hides the page; stable return opens it", () => {
    const presence = new PresenceMonitor();
    presence.update(true, 0);
    for (let time = 100; time <= 1500; time += 100) {
        assert.equal(presence.update(false, time), "present");
    }
    assert.equal(presence.update(false, 1600), "away");
    assert.equal(presence.update(true, 1700), "away");
    assert.equal(presence.update(false, 1800), "away");
    assert.equal(presence.update(true, 1900), "away");
    assert.equal(presence.update(true, 2200), "away");
    assert.equal(presence.update(true, 2400), "present");
    presence.reset();
    assert.equal(presence.state, "waiting");
});

test("tab suspension does not count as a departure", () => {
    const presence = new PresenceMonitor();
    presence.update(true, 0);
    presence.update(false, 100);
    assert.equal(presence.update(false, 10000), "present");
});

test("carousel wraps in both directions and limits gestures without blocking manual navigation", () => {
    const slides = new SlideController(3);
    assert.equal(slides.move(-1), 2);
    assert.equal(slides.direction, -1);
    assert.equal(slides.move(1), 0);
    assert.equal(slides.direction, 1);
    assert.equal(slides.gesture("next_slide", 0), true);
    assert.equal(slides.gesture("next_slide", 100), false);
    assert.equal(slides.index, 1);
    assert.equal(slides.gesture("previous_slide", 900), true);
    assert.equal(slides.index, 0);
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

// Full-camera sweeps do not depend on wrist height or the body's grid origin.
test("camera-space sweeps work at the top and bottom and reject stale or missing tracking", async () => {
    const { CameraSwipes } = await import("../src/camera-swipes.mjs");
    for (const y of [.01, .99]) {
        const sweeps = new CameraSwipes();
        let right = { x: .2, y };
        let left = { x: .8, y };
        const session = { coordinate: index => index === 16 ? right : left };
        assert.deepEqual(sweeps.update(session, 0), []);
        right = { x: .4, y };
        assert.deepEqual(sweeps.update(session, 100), ["next_slide"]);
        left = { x: .6, y };
        assert.deepEqual(sweeps.update(session, 200), ["previous_slide"]);
        assert.deepEqual(sweeps.update(session, 220), []);
        right = null;
        sweeps.update(session, 230);
        right = { x: .9, y };
        assert.deepEqual(sweeps.update(session, 240), []);
        left = { x: .1, y };
        assert.deepEqual(sweeps.update(session, 1000), []);
        sweeps.reset();
        assert.deepEqual(sweeps.update(session, 1010), []);
    }
});

test("raising either hand scrolls forward; quick reversals and tracking gaps do not", async () => {
    const { CameraSwipes } = await import("../src/camera-swipes.mjs");
    for (const landmark of [15, 16]) {
        const swipes = new CameraSwipes();
        let wrist = { x: .5, y: .8 };
        const session = { coordinate: index => index === landmark ? wrist : null };
        assert.deepEqual(swipes.update(session, 0), []);
        wrist = { x: .5, y: .6 };
        assert.deepEqual(swipes.update(session, 100), []);
        wrist = { x: .5, y: .3 };
        assert.deepEqual(swipes.update(session, 300), ["scroll_presentation"]);
        wrist = { x: .5, y: .9 };
        assert.deepEqual(swipes.update(session, 400), []);
        wrist = null;
        assert.deepEqual(swipes.update(session, 410), []);
        wrist = { x: .5, y: .1 };
        assert.deepEqual(swipes.update(session, 420), []);
        wrist = { x: .5, y: .01 };
        assert.deepEqual(swipes.update(session, 1000), []);
    }
});

test("returning from the second slide changes the first slide; wrapping alone does not", () => {
    const slides = new SlideController(3);
    assert.equal(slides.returnedToFirst, false);
    slides.move(-1);
    assert.equal(slides.index, 2);
    assert.equal(slides.returnedToFirst, false);
    slides.move(1);
    slides.gesture("next_slide", 0);
    slides.gesture("previous_slide", 900);
    assert.equal(slides.index, 0);
    assert.equal(slides.returnedToFirst, true);
    slides.move(1);
    assert.equal(slides.index, 1);
});

test("site presence settings hide promptly but ignore a brief loss of tracking", () => {
    const presence = new PresenceMonitor(settings);
    assert.equal(presence.update(true, 0), "present");
    assert.equal(presence.update(false, 100), "present");
    assert.equal(presence.update(false, 500), "present");
    assert.equal(presence.update(false, 700), "away");
    assert.equal(presence.update(true, 800), "away");
    assert.equal(presence.update(true, 1100), "present");
});

test("small, diagonal and instantaneous hand lifts do not scroll", async () => {
    const { CameraSwipes } = await import("../src/camera-swipes.mjs");
    for (const samples of [
        [[0, .5, .8], [150, .5, .7], [300, .5, .6]],
        [[0, .3, .8], [150, .5, .5], [300, .7, .2]],
        [[0, .5, .8], [100, .5, .2]]
    ]) {
        const swipes = new CameraSwipes();
        let wrist;
        const session = { coordinate: index => index === 15 ? wrist : null };
        for (const [time, x, y] of samples) {
            wrist = { x, y };
            assert.ok(!swipes.update(session, time).includes("scroll_presentation"));
        }
    }
});

test("lowering either hand requests the previous section with the same deliberate gesture", async () => {
    const { CameraSwipes } = await import("../src/camera-swipes.mjs");
    for (const landmark of [15, 16]) {
        const swipes = new CameraSwipes();
        let wrist = { x: .5, y: .15 };
        const session = { coordinate: index => index === landmark ? wrist : null };
        assert.deepEqual(swipes.update(session, 0), []);
        wrist.y = .5;
        assert.deepEqual(swipes.update(session, 150), []);
        wrist.y = .85;
        assert.deepEqual(swipes.update(session, 300), ["scroll_previous"]);
    }
});


test("either hand can raise or lower from the camera edges without a central hold", async () => {
    const { CameraSwipes } = await import("../src/camera-swipes.mjs");
    for (const landmark of [15, 16]) {
        for (const direction of [1, -1]) {
            const swipes = new CameraSwipes();
            let wrist = { x: .2, y: direction === 1 ? .85 : .15 };
            const session = { coordinate: index => index === landmark ? wrist : null };
            assert.deepEqual(swipes.update(session, 0), []);
            wrist.y = .5;
            assert.deepEqual(swipes.update(session, 150), []);
            wrist.y = direction === 1 ? .15 : .85;
            assert.deepEqual(swipes.update(session, 300), [direction === 1 ? "scroll_presentation" : "scroll_previous"]);
        }
    }
});

test("slow vertical sweeps tolerate jitter and a brief occlusion in both directions", async () => {
    const { CameraSwipes } = await import("../src/camera-swipes.mjs");
    for (const landmark of [15, 16]) {
        for (const direction of [-1, 1]) {
            const swipes = new CameraSwipes();
            let wrist;
            const session = { coordinate: index => index === landmark ? wrist : null };
            const actions = [];
            for (let frame = 0; frame <= 45; frame++) {
                const y = (direction === 1 ? .8 : .2) - direction * frame * .01;
                wrist = frame === 20 ? null : { x: .5 + Math.sin(frame) * .005, y };
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
        for (let frame = 0; frame <= 20; frame++) {
            wrist = frame === 10 ? null : { x: .5 + direction * frame * .009, y: .5 };
            actions.push(...swipes.update(session, frame * 80));
        }
        assert.deepEqual(actions, [direction === 1 ? "next_slide" : "previous_slide"]);
    }
    const swipes = new CameraSwipes();
    let wrist = { x: .4, y: .8 };
    const session = { coordinate: () => wrist };
    swipes.update(session, 0);
    wrist = { x: .58, y: .5 };
    assert.ok(!swipes.update(session, 200).includes("next_slide"));
});


test("a reversal after stale tracking starts a new gesture instead of scrolling immediately", async () => {
    const { CameraSwipes } = await import("../src/camera-swipes.mjs");
    const swipes = new CameraSwipes();
    let wrist = { x: .5, y: .7 };
    const session = { coordinate: index => index === 15 ? wrist : null };
    swipes.update(session, 0);
    wrist.y = .45;
    assert.deepEqual(swipes.update(session, 150), []);
    wrist.y = .95;
    assert.deepEqual(swipes.update(session, 1000), []);
});


test("framing reserves a quarter at each edge and works with just one visible wrist", async () => {
    const { cameraFrame } = await import("../src/camera-framing.mjs");
    for (const index of [15, 16]) {
        let hand = { x: .1, y: .9 };
        const session = { coordinate: landmark => landmark === index ? hand : null };
        assert.deepEqual(cameraFrame(session), { edges: ["bottom", "right"], centred: false });
        hand = { x: .5, y: .5 };
        assert.deepEqual(cameraFrame(session), { edges: [], centred: true });
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
