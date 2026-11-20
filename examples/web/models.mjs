// Pinned MediaPipe Tasks pose landmarker release (float16, version 1, Apache-2.0).
// Lite ships with the package; Full and Heavy are fetched once from Google's
// model storage, verified and kept in Cache Storage for offline use.
export const poseModels = {
    lite: { file: "pose_landmarker_lite.task", size: 5777746,
        sha256: "59929e1d1ee95287735ddd833b19cf4ac46d29bc7afddbbf6753c459690d574a" },
    full: { file: "pose_landmarker_full.task", size: 9398198,
        sha256: "5134a3aad27a58b93da0088d431f366da362b44e3ccfbe3462b3827a839011b1" },
    heavy: { file: "pose_landmarker_heavy.task", size: 30664242,
        sha256: "64437af838a65d18e5ba7a0d39b465540069bc8aae8308de3e318aad31fcbc7b" }
};
const modelStorage = "https://storage.googleapis.com/mediapipe-models/pose_landmarker/";
const cacheName = "mig-pose-models";

export function poseModelURL(name) {
    const model = poseModels[name];
    if (!model) throw new RangeError(`Unknown pose model: ${name}`);
    return `${modelStorage}${model.file.replace(".task", "")}/float16/1/${model.file}`;
}

async function verified(bytes, name) {
    const model = poseModels[name];
    if (bytes.byteLength !== model.size) {
        throw new Error(`Pose model ${name} is incomplete; try again`);
    }
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    const hex = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
    if (hex !== model.sha256) throw new Error(`Pose model ${name} failed its integrity check`);
    return new Uint8Array(bytes);
}

async function openCache() {
    try { return await globalThis.caches?.open(cacheName); } catch { return null; }
}

// Resolution order: the application's own copy beside the other assets, then
// the browser cache, then the official download. Only the chosen model moves.
export async function poseModelBytes(assetBase, name) {
    const url = poseModelURL(name);
    const local = await fetch(new URL(`models/${poseModels[name].file}`, assetBase)).catch(() => null);
    if (local?.ok) return verified(await local.arrayBuffer(), name);
    const cache = await openCache();
    const cached = await cache?.match(url);
    if (cached) return verified(await cached.arrayBuffer(), name);
    const response = await fetch(url).catch(() => null);
    if (!response?.ok) {
        throw new Error(`Pose model ${name} is not available offline; connect once to download it`);
    }
    const bytes = await response.arrayBuffer();
    const model = await verified(bytes, name);
    await cache?.put(url, new Response(bytes, { headers: { "content-type": "application/octet-stream" } }))
        .catch(() => {});
    return model;
}

// GPU (WebGL) is optional: a device that rejects it falls back to CPU.
async function createWithFallback(create, delegate) {
    try {
        return { task: await create(delegate), delegate };
    } catch (error) {
        if (delegate !== "GPU") throw error;
        return { task: await create("CPU"), delegate: "CPU" };
    }
}

export async function loadModels(assetBase = new URL("./", import.meta.url).href,
    { hands = true, delegate = "CPU", poseModel = "lite" } = {}) {
    const { FilesetResolver, PoseLandmarker, HandLandmarker } = await import(
        new URL("vision/vision_bundle.mjs", assetBase).href
    );
    const files = await FilesetResolver.forVisionTasks(
        new URL("vision/wasm", assetBase).href,
    );
    const createPose = async name => {
        const modelAssetBuffer = await poseModelBytes(assetBase, name);
        return createWithFallback(used => PoseLandmarker.createFromOptions(files, {
            baseOptions: { modelAssetBuffer, delegate: used },
            runningMode: "VIDEO",
            numPoses: 1,
        }), delegate);
    };
    const createHands = () => createWithFallback(used => HandLandmarker.createFromOptions(files, {
        baseOptions: { modelAssetPath: new URL("models/hand_landmarker.task", assetBase).href, delegate: used },
        runningMode: "VIDEO",
        numHands: 2,
    }), delegate);
    const first = await createPose(poseModel);
    const models = { pose: first.task, poseModel, delegate: first.delegate, hands: null,
        loadHands: async () => (await createHands()).task,
        // Replace the pose task in place; the caller keeps using models.pose.
        async loadPose(name) {
            const next = await createPose(name);
            const previous = models.pose;
            models.pose = next.task;
            models.poseModel = name;
            previous.close();
        }
    };
    try {
        if (hands) models.hands = await models.loadHands();
        return models;
    } catch (error) {
        models.pose.close();
        throw error;
    }
}
