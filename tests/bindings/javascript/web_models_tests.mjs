import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { poseModels, poseModelURL, poseModelBytes, loadModels } from "../../../examples/web/models.mjs";

const assetBase = "http://localhost/mig/";

async function digest(bytes) {
    const hash = await crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, "0")).join("");
}

// Point the pinned catalog at small fixtures; the real sizes are too large for a test.
async function fixtures() {
    const files = {};
    for (const [name, text] of [["lite", "lite bytes"], ["full", "full model bytes"], ["heavy", "heavy!"]]) {
        const bytes = new TextEncoder().encode(text);
        poseModels[name].size = bytes.byteLength;
        poseModels[name].sha256 = await digest(bytes);
        files[name] = bytes;
    }
    return files;
}

function network({ local = {}, remote = {}, offline = false, cacheStore = new Map(), withCache = true } = {}) {
    const calls = { fetched: [], cached: [] };
    globalThis.fetch = async url => {
        const key = String(url);
        calls.fetched.push(key);
        if (key.startsWith(assetBase)) {
            const file = key.slice(assetBase.length + "models/".length);
            return local[file] ? new Response(local[file]) : { ok: false, status: 404 };
        }
        if (offline) throw new TypeError("Failed to fetch");
        return remote[key] ? new Response(remote[key]) : { ok: false, status: 404 };
    };
    globalThis.caches = withCache ? {
        async open() {
            return {
                async match(url) { return cacheStore.has(url) ? new Response(cacheStore.get(url)) : undefined; },
                async put(url, response) { calls.cached.push(url); cacheStore.set(url, new Uint8Array(await response.arrayBuffer())); }
            };
        }
    } : undefined;
    return calls;
}

test("official URLs follow the pinned release layout and unknown names are rejected", () => {
    assert.equal(poseModelURL("heavy"),
        "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_heavy/float16/1/pose_landmarker_heavy.task");
    assert.throws(() => poseModelURL("medium"), RangeError);
    assert.throws(() => poseModelURL(undefined), RangeError);
});

test("a bundled model is used without any cache or network request after verification", async () => {
    const files = await fixtures();
    const calls = network({ local: { [poseModels.lite.file]: files.lite } });
    assert.deepEqual(await poseModelBytes(assetBase, "lite"), files.lite);
    assert.deepEqual(calls.fetched, [`${assetBase}models/pose_landmarker_lite.task`]);
    assert.deepEqual(calls.cached, []);
});

test("a corrupted bundled copy is rejected rather than handed to the model loader", async () => {
    const files = await fixtures();
    network({ local: { [poseModels.lite.file]: new TextEncoder().encode("lite byteX") } });
    await assert.rejects(poseModelBytes(assetBase, "lite"), /integrity/);
    network({ local: { [poseModels.lite.file]: files.lite.slice(1) } });
    await assert.rejects(poseModelBytes(assetBase, "lite"), /incomplete/);
});

test("cached downloads work offline and downloads are verified before being cached", async () => {
    const files = await fixtures();
    const url = poseModelURL("full");
    const cacheStore = new Map();
    const online = network({ remote: { [url]: files.full }, cacheStore });
    assert.deepEqual(await poseModelBytes(assetBase, "full"), files.full);
    assert.deepEqual(online.fetched, [`${assetBase}models/pose_landmarker_full.task`, url]);
    assert.deepEqual(online.cached, [url]);
    const offline = network({ offline: true, cacheStore });
    assert.deepEqual(await poseModelBytes(assetBase, "full"), files.full);
    assert.deepEqual(offline.fetched, [`${assetBase}models/pose_landmarker_full.task`]);
    const truncated = network({ remote: { [poseModelURL("heavy")]: files.heavy.slice(0, 3) }, cacheStore });
    await assert.rejects(poseModelBytes(assetBase, "heavy"), /incomplete/);
    assert.deepEqual(truncated.cached, []);
    const tampered = network({ remote: { [poseModelURL("heavy")]: new TextEncoder().encode("heavy?") }, cacheStore });
    await assert.rejects(poseModelBytes(assetBase, "heavy"), /integrity/);
    assert.deepEqual(tampered.cached, []);
    assert.equal(cacheStore.has(poseModelURL("heavy")), false);
});

test("missing models report the offline state and work without Cache Storage", async () => {
    const files = await fixtures();
    network({ offline: true });
    await assert.rejects(poseModelBytes(assetBase, "heavy"), /not available offline/);
    network({ remote: { [poseModelURL("heavy")]: files.heavy }, withCache: false });
    assert.deepEqual(await poseModelBytes(assetBase, "heavy"), files.heavy);
});

async function fakeVision() {
    const folder = await mkdtemp(join(tmpdir(), "mig-vision-"));
    await mkdir(join(folder, "vision"), { recursive: true });
    await writeFile(join(folder, "vision/vision_bundle.mjs"), `
        export const log = [];
        export const FilesetResolver = { forVisionTasks: async path => ({ path }) };
        export class PoseLandmarker {
            static async createFromOptions(files, options) {
                log.push(["pose", options.baseOptions.delegate, options.baseOptions.modelAssetBuffer.byteLength]);
                if (options.baseOptions.delegate === "GPU" && globalThis.rejectGPU) throw new Error("No WebGL");
                return new PoseLandmarker(options);
            }
            constructor(options) { this.bytes = options.baseOptions.modelAssetBuffer.byteLength; this.closed = false; }
            close() { this.closed = true; log.push(["closed", this.bytes]); }
        }
        export class HandLandmarker {
            static async createFromOptions(files, options) {
                log.push(["hands", options.baseOptions.delegate]);
                if (options.baseOptions.delegate === "GPU" && globalThis.rejectGPU) throw new Error("No WebGL");
                return new HandLandmarker();
            }
            close() { log.push(["hands closed"]); }
        }
    `);
    const base = pathToFileURL(folder + "/").href;
    const { log } = await import(new URL("vision/vision_bundle.mjs", base).href);
    return { base, log };
}

test("GPU requests fall back to CPU, hands stay optional and pose models swap in place", async () => {
    const files = await fixtures();
    const { base, log } = await fakeVision();
    globalThis.fetch = async url => {
        const name = Object.keys(poseModels).find(key => String(url).endsWith(poseModels[key].file));
        return name && String(url).startsWith(base) ? new Response(files[name]) : { ok: false, status: 404 };
    };
    globalThis.caches = undefined;
    globalThis.rejectGPU = true;
    const models = await loadModels(base, { hands: false, delegate: "GPU", poseModel: "full" });
    assert.equal(models.delegate, "CPU");
    assert.equal(models.poseModel, "full");
    assert.equal(models.hands, null);
    assert.deepEqual(log, [["pose", "GPU", files.full.byteLength], ["pose", "CPU", files.full.byteLength]]);
    log.length = 0;
    await models.loadPose("lite");
    assert.equal(models.poseModel, "lite");
    assert.equal(models.pose.bytes, files.lite.byteLength);
    assert.deepEqual(log, [["pose", "GPU", files.lite.byteLength], ["pose", "CPU", files.lite.byteLength], ["closed", files.full.byteLength]]);
    log.length = 0;
    globalThis.rejectGPU = false;
    models.hands = await models.loadHands();
    assert.deepEqual(log, [["hands", "GPU"]]);
    await assert.rejects(loadModels(base, { poseModel: "medium" }), RangeError);
});
