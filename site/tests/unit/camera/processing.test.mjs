import assert from "node:assert/strict";
import { test } from "node:test";
import { frameSize, boundedPose, scheduledSession } from "../../../src/camera/processing.mjs";

test("inference preserves the full frame across portrait, landscape and small cameras", () => {
    for (const [width, height] of [[3840, 2160], [2160, 3840], [1920, 1440], [1440, 1920], [640, 480], [480, 640]]) {
        const size = frameSize(width, height);
        assert.ok(Math.max(size.width, size.height) <= 960);
        assert.ok(Math.abs(size.width / size.height - width / height) < .002);
        if (Math.max(width, height) <= 960) assert.deepEqual(size, { width, height });
    }
    assert.equal(frameSize(0, 1080), null);
});

test("large video uses one reusable inference canvas, small video stays direct and close releases it", () => {
    const inputs = [];
    let closed = false;
    let created = 0;
    const canvas = { getContext: () => ({ drawImage: (...args) => inputs.push(args) }) };
    const pose = boundedPose({
        detectForVideo: (source, time) => ({ source, time }),
        close: () => { closed = true; }
    }, () => { created++; return canvas; });
    const video = { videoWidth: 3840, videoHeight: 2160 };
    assert.equal(pose.detectForVideo(video, 12).source, canvas);
    assert.deepEqual(inputs[0], [video, 0, 0, 960, 540]);
    pose.detectForVideo(video, 13);
    assert.equal(created, 1);
    video.videoWidth = 480; video.videoHeight = 640;
    assert.equal(pose.detectForVideo(video, 14).source, video);
    pose.close();
    assert.equal(closed, true);
    assert.equal(canvas.width, 0);
});

function fixture(t, native = true) {
    let now = 0;
    let callback;
    const cancelled = [];
    t.mock.method(performance, "now", () => now);
    const originals = ["document", "requestAnimationFrame"].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]);
    globalThis.document = { hidden: false };
    globalThis.requestAnimationFrame = fn => { callback = fn; return 8; };
    t.after(() => {
        for (const [key, descriptor] of originals) {
            if (descriptor) Object.defineProperty(globalThis, key, descriptor);
            else delete globalThis[key];
        }
    });
    const video = { readyState: 2, currentTime: 0 };
    if (native) {
        video.requestVideoFrameCallback = fn => { callback = fn; return 7; };
        video.cancelVideoFrameCallback = id => cancelled.push(id);
    }
    class Base {
        constructor() { this.stream = {}; this.generation = 1; this.video = video; this.frames = 0; this.lastVideoTime = -1; }
        processFrame() { this.frames++; this.lastVideoTime = video.currentTime; now += this.cost ?? 5; }
        stop() { this.generation++; this.stream = null; }
        publish(state) { this.state = state; }
    }
    const session = new (scheduledSession(Base))();
    return { session, video, cancelled, advance(ms, fresh = true) { now += ms; if (fresh) video.currentTime++; callback(); } };
}

test("fresh-frame scheduling caps cadence, ignores duplicate frames and cancels on stop", t => {
    const { session, advance, cancelled } = fixture(t);
    session.tick(1);
    advance(10);
    assert.equal(session.frames, 1);
    advance(40);
    assert.equal(session.frames, 2);
    advance(100, false);
    assert.equal(session.frames, 2);
    session.stop();
    assert.deepEqual(cancelled, [7]);
    advance(100);
    assert.equal(session.frames, 2);
});

test("slow inference gets idle time and hidden tabs do not analyze video", t => {
    const { session, advance } = fixture(t);
    session.cost = 80;
    session.tick(1);
    advance(5);
    assert.equal(session.frames, 1);
    advance(20);
    assert.equal(session.frames, 2);
    document.hidden = true;
    advance(1000);
    assert.equal(session.frames, 2);
    document.hidden = false;
    advance(100);
    assert.equal(session.frames, 3);
});

test("RAF fallback still processes new frames and inference failures release the session", t => {
    const { session, advance } = fixture(t, false);
    session.tick(1);
    assert.equal(session.request, 8);
    advance(100);
    assert.equal(session.frames, 2);
    session.processFrame = () => { throw new Error("model unavailable"); };
    advance(100);
    assert.equal(session.stream, null);
    assert.deepEqual(session.state, { status: "model unavailable" });
});
