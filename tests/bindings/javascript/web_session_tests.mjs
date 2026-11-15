import assert from "node:assert/strict";
import { test } from "node:test";
import { MIGSession } from "../../../examples/web/session.mjs";

function deferred() {
    let resolve;
    const promise = new Promise(done => { resolve = done; });
    return { promise, resolve };
}

function fixture(options = {}) {
    let tick;
    let stopped = 0;
    let disposed = 0;
    let modelsClosed = 0;
    let updates = 0;
    let handFrames = 0;
    let notifications = 0;
    let overlays = 0;
    const events = [];
    const configuration = { schema_version: 2, tracking: { hands: true }, inputs: [{ id: "demo" }] };
    const tracker = {
        importJSON(json) {
            const profile = JSON.parse(json);
            if (profile.schema_version !== 2) throw new Error("Invalid profile");
            this.configuration = profile;
        },
        trackHands() { return this.configuration.tracking.hands; },
        recalibrate() {}, restart() {},
        dispose() { ++disposed; },
        update(body, hands, time, aspect, callback) {
            ++updates;
            for (const event of events.splice(0)) callback(...event);
        }
    };
    const stream = { getTracks: () => [{ stop: () => ++stopped }] };
    const models = {
        pose: { detectForVideo: () => ({}), close: () => ++modelsClosed },
        hands: { detectForVideo: () => { ++handFrames; return {}; }, close: () => ++modelsClosed }
    };
    globalThis.fetch = async () => ({ ok: true, json: async () => structuredClone(configuration) });
    Object.defineProperty(globalThis, "navigator", { configurable: true,
        value: { mediaDevices: { getUserMedia: options.getUserMedia ?? (async () => stream) } } });
    globalThis.requestAnimationFrame = callback => { tick = callback; return 1; };
    globalThis.cancelAnimationFrame = () => {};
    const session = new MIGSession({ assetBase: "http://localhost/mig/", ...options,
        dependencies: {
            createTracker: options.createTracker ?? (async json => { tracker.importJSON(json); return tracker; }),
            loadModels: options.loadModels ?? (async () => models),
            drawOverlay() { ++overlays; }
        } });
    session.subscribe(() => ++notifications);
    const video = { readyState: 2, currentTime: 1, videoWidth: 640, videoHeight: 480,
        play: async () => {} };
    const canvas = { width: 640, height: 480, getContext: () => ({ clearRect() {} }) };
    return { session, tracker, models, video, canvas, stream, events,
        tick: () => tick(), counters: () => ({ stopped, disposed, modelsClosed,
            updates, handFrames, notifications, overlays }) };
}

test("both hands produce events; unchanged frames do not infer or render reactive state", async () => {
    const actions = [];
    const f = fixture({ onAction: event => actions.push(event) });
    f.events.push(["left_raise", "left"], ["right_raise", "right"]);
    await f.session.start(f.video, f.canvas);
    assert.equal(actions.length, 2);
    assert.deepEqual(f.session.state.actions, actions);
    const before = f.counters();
    f.tick();
    assert.deepEqual(f.counters(), before);
    ++f.video.currentTime;
    f.tick();
    assert.equal(f.counters().updates, before.updates + 1);
    assert.equal(f.counters().notifications, before.notifications);
    f.session.dispose();
    f.session.dispose();
    assert.equal(f.counters().stopped, 1);
    assert.equal(f.counters().disposed, 1);
    assert.equal(f.counters().modelsClosed, 2);
});

test("profile mode starts empty, invalid import preserves profile, hands follow config", async () => {
    const f = fixture({ profileMode: true });
    await f.session.start(f.video, f.canvas);
    assert.equal(f.tracker.configuration.inputs.length, 0);
    assert.equal(f.counters().handFrames, 0);
    const json = JSON.stringify({ schema_version: 2, tracking: { hands: true }, inputs: [{ id: "custom" }] });
    await f.session.importJSON(json);
    await assert.rejects(f.session.importJSON("{}"), /Invalid profile/);
    await assert.rejects(f.session.importJSON("x".repeat(1024 * 1024 + 1)), /1 MiB/);
    assert.equal(f.tracker.configuration.inputs[0].id, "custom");
    f.events.push(["custom command", "custom"]);
    ++f.video.currentTime;
    f.tick();
    assert.equal(f.counters().handFrames, 1);
    assert.equal(f.session.state.actions[0].action, "custom command");
    f.session.stop();
    await f.session.start(f.video, f.canvas);
    assert.equal(f.session.state.running, true);
    f.session.dispose();
});

test("camera arriving after stop is released; pending start cannot revive session", async () => {
    const incoming = deferred();
    const f = fixture({ getUserMedia: () => incoming.promise });
    const start = f.session.start(f.video, f.canvas);
    await new Promise(resolve => setImmediate(resolve));
    f.session.stop();
    incoming.resolve(f.stream);
    await start;
    assert.equal(f.counters().stopped, 1);
    assert.equal(f.session.state.running, false);
    f.session.dispose();
});

test("unmount during model loading closes late models", async () => {
    const pending = deferred();
    const f = fixture({ loadModels: () => pending.promise });
    const start = f.session.start(f.video, f.canvas);
    await new Promise(resolve => setImmediate(resolve));
    f.session.dispose();
    pending.resolve(f.models);
    await start;
    assert.equal(f.counters().modelsClosed, 2);
    assert.equal(f.counters().disposed, 1);
});

test("unmount during engine creation disposes the late engine", async () => {
    const pending = deferred();
    const f = fixture({ createTracker: () => pending.promise });
    const start = f.session.start(f.video, f.canvas);
    await new Promise(resolve => setImmediate(resolve));
    f.session.dispose();
    pending.resolve(f.tracker);
    await start;
    assert.equal(f.counters().disposed, 1);
    assert.equal(f.counters().modelsClosed, 0);
});


test("inference caps drop intermediate frames, retain fresh timestamps and can change live", async t => {
    let now = 0;
    t.mock.method(performance, "now", () => now);
    const times = [], f = fixture({ maxInferenceFps: 20, onFrame: () => times.push(now) });
    await f.session.start(f.video, f.canvas);
    for (now = 10; now <= 1000; now += 10) { f.video.currentTime = now / 1000 + 1; f.tick(); }
    assert.equal(f.counters().updates, 21);
    assert.equal(times.at(-1), 1000);
    f.session.setInferenceFps(10);
    const before = f.counters().updates;
    for (now = 1010; now <= 2010; now += 10) { f.video.currentTime = now / 1000 + 1; f.tick(); }
    assert.equal(f.counters().updates - before, 11);
    assert.equal(times.at(-1), 2010);
    for (const fps of [-1, .5, 121, NaN, Infinity]) assert.throws(() => f.session.setInferenceFps(fps), RangeError);
    f.session.dispose();
});

test("capture constraints are opt-in and custom overlays can avoid all SDK debug drawing", async () => {
    let constraints;
    const f = fixture({ drawOverlay: false, videoConstraints: { width: 640, height: 480, frameRate: 20 },
        getUserMedia: async value => { constraints = value; return f.stream; } });
    await f.session.start(f.video, f.canvas);
    assert.deepEqual(constraints, { video: { width: 640, height: 480, frameRate: 20 }, audio: false });
    assert.equal(f.counters().updates, 1); assert.equal(f.counters().overlays, 0);
    f.session.dispose();
});

test("pose-only sessions defer hands and late hand loading cannot revive a disposed session", async () => {
    const pending = deferred();
    let settings, handLoads = 0, poseClosed = 0, handsClosed = 0;
    const hands = { close: () => ++handsClosed, detectForVideo: () => ({}) };
    const f = fixture({ profileMode: true, loadModels: async value => {
        settings = value;
        return { pose: { close: () => ++poseClosed, detectForVideo: () => ({}) }, hands: null,
            loadHands: () => { ++handLoads; return pending.promise; } };
    } });
    await f.session.start(f.video, f.canvas);
    assert.deepEqual(settings, { hands: false, delegate: "CPU" });
    assert.equal(handLoads, 0);
    const importing = f.session.importJSON(JSON.stringify({ schema_version: 2, tracking: { hands: true }, inputs: [] }));
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(handLoads, 1);
    const before = f.counters().updates;
    ++f.video.currentTime; f.tick(); assert.equal(f.counters().updates, before);
    f.session.dispose(); pending.resolve(hands); await importing;
    assert.equal(poseClosed, 1); assert.equal(handsClosed, 1); assert.equal(f.session.state.running, false);
});

test("lazy hand loading resumes an imported hand profile and does not load twice", async () => {
    let loads = 0;
    const f = fixture({ profileMode: true, loadModels: async () => ({ pose: { detectForVideo: () => ({}), close() {} },
        hands: null, loadHands: async () => { ++loads; return { detectForVideo: () => ({}), close() {} }; } }) });
    await f.session.start(f.video, f.canvas);
    const json = JSON.stringify({ schema_version: 2, tracking: { hands: true }, inputs: [] });
    await f.session.importJSON(json); await f.session.importJSON(json);
    ++f.video.currentTime; f.tick(); assert.equal(loads, 1); assert.equal(f.session.state.running, true);
    f.session.dispose();
});
