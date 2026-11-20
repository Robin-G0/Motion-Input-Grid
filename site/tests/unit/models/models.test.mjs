import assert from "node:assert/strict";
import { test } from "node:test";
import { models, modelURL, modelBytes, sha256 } from "../../../models/src/catalog.mjs";
import { ModelStats, quantile } from "../../../models/src/metrics.mjs";

const runtime = "https://example.test/mig/";

// Shrink the pinned catalog to small fixtures; the real sizes are too large here.
async function fixture(id, text) {
    const model = { ...models.find(item => item.id === id) };
    const bytes = new TextEncoder().encode(text);
    return { model: { ...model, size: bytes.byteLength, sha256: await sha256(bytes) }, bytes };
}

function memoryCache() {
    const store = new Map();
    globalThis.caches = { async open() {
        return { async match(url) { return store.has(url) ? new Response(store.get(url)) : undefined; },
            async put(url, response) { store.set(url, new Uint8Array(await response.arrayBuffer())); },
            async delete(url) { return store.delete(url); } };
    } };
    return store;
}

test("Lite comes from the published runtime and the other variants from the pinned release", () => {
    assert.deepEqual(models.map(model => model.id), ["lite", "full", "heavy"]);
    assert.equal(modelURL(models[0], runtime), "https://example.test/mig/models/pose_landmarker_lite.task");
    assert.equal(modelURL(models[2], runtime),
        "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_heavy/float16/1/pose_landmarker_heavy.task");
    for (const model of models) assert.match(model.sha256, /^[0-9a-f]{64}$/);
});

test("downloads are verified before caching, then reused offline; damaged copies are replaced", async () => {
    const store = memoryCache();
    const { model, bytes } = await fixture("heavy", "heavy model");
    const url = modelURL(model, runtime);
    const online = async () => new Response(bytes);
    assert.equal((await modelBytes(model, runtime, online)).source, "download");
    assert.equal(store.has(url), true);
    const offline = async () => { throw new TypeError("Failed to fetch"); };
    const cached = await modelBytes(model, runtime, offline);
    assert.equal(cached.source, "cache");
    assert.deepEqual(cached.bytes, bytes);
    store.set(url, new TextEncoder().encode("heavy modeX"));
    assert.equal((await modelBytes(model, runtime, online)).source, "download");
    await assert.rejects(modelBytes({ ...model, file: "other.task" }, runtime, offline), /modelOffline/);
    delete globalThis.caches;
});

test("truncated or altered files are rejected and never cached", async () => {
    const store = memoryCache();
    const { model, bytes } = await fixture("full", "full model");
    await assert.rejects(modelBytes(model, runtime, async () => new Response(bytes.slice(1))), /modelIncomplete/);
    await assert.rejects(modelBytes(model, runtime, async () => new Response(new TextEncoder().encode("full modeX"))), /modelIntegrity/);
    assert.equal(store.size, 0);
    const bundled = await fixture("lite", "lite model");
    assert.equal((await modelBytes(bundled.model, runtime, async () => new Response(bundled.bytes))).source, "bundled");
    assert.equal(store.size, 0, "the bundled model is served by the site, not duplicated in the cache");
    delete globalThis.caches;
});

test("statistics stay bounded and report latency, coverage and noise around steady motion", () => {
    assert.equal(quantile([], .5), null);
    assert.equal(quantile([4, 1, 3, 2], .5), 3);
    const stats = new ModelStats(10);
    const pose = (x, noise = 0) => {
        const points = Array.from({ length: 33 }, () => ({ x: .5, y: .5, visibility: 0 }));
        points[11] = { x: .6, y: .4, visibility: 1 }; points[12] = { x: .4, y: .4, visibility: 1 };
        points[13] = { x: .65, y: .5, visibility: 1 }; points[14] = { x: .35, y: .5, visibility: .2 };
        points[15] = { x: x + noise, y: .6, visibility: 1 }; points[16] = { x: .3, y: .6, visibility: 1 };
        return points;
    };
    for (let frame = 0; frame < 25; ++frame) stats.record(10 + frame % 3, pose(.6 + frame * .01), 1);
    let summary = stats.summary();
    assert.equal(stats.durations.length, 10);
    assert.equal(summary.frames, 10);
    assert.equal(summary.median, 11);
    assert.equal(summary.fps, 1000 / 11);
    assert.ok(Math.abs(summary.coverage - 5 / 6) < 1e-12);
    assert.ok(summary.wristJitter < 1e-9, "a wrist moving at constant speed has no jitter");
    assert.equal(summary.shoulderJitter, 0);
    stats.reset();
    for (let frame = 0; frame < 25; ++frame) stats.record(10, pose(.6, frame % 2 ? .01 : -.01), 1);
    summary = stats.summary();
    assert.ok(Math.abs(summary.wristJitter - .04 / .2) < 1e-6, "alternating 1% noise is 20% of the shoulder width");
    assert.equal(summary.shoulderJitter, 0);
    stats.reset();
    stats.record(10, [], 1); stats.record(10, [], 1); stats.record(10, [], 1);
    assert.equal(stats.summary().wristJitter, null);
    assert.equal(stats.summary().coverage, 0);
});
