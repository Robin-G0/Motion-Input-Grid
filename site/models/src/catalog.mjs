// Pinned MediaPipe pose landmarker release (float16, version 1, Apache-2.0).
// The site pins a published npm engine that bundles Lite only, so the other
// variants come from Google's model storage, verified, then kept in Cache Storage.
export const models = [
    { id: "lite", file: "pose_landmarker_lite.task", size: 5777746, bundled: true,
        sha256: "59929e1d1ee95287735ddd833b19cf4ac46d29bc7afddbbf6753c459690d574a" },
    { id: "full", file: "pose_landmarker_full.task", size: 9398198, bundled: false,
        sha256: "5134a3aad27a58b93da0088d431f366da362b44e3ccfbe3462b3827a839011b1" },
    { id: "heavy", file: "pose_landmarker_heavy.task", size: 30664242, bundled: false,
        sha256: "64437af838a65d18e5ba7a0d39b465540069bc8aae8308de3e318aad31fcbc7b" }
];
const storage = "https://storage.googleapis.com/mediapipe-models/pose_landmarker/";
const cacheName = "mig-pose-models";

export function modelURL(model, runtime) {
    return model.bundled ? new URL(`models/${model.file}`, runtime).href
        : `${storage}${model.file.replace(".task", "")}/float16/1/${model.file}`;
}

export async function sha256(bytes) {
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
}

async function verified(bytes, model) {
    if (bytes.byteLength !== model.size) throw new Error("modelIncomplete");
    if (await sha256(bytes) !== model.sha256) throw new Error("modelIntegrity");
    return new Uint8Array(bytes);
}

async function openCache() {
    try { return await globalThis.caches?.open(cacheName) ?? null; } catch { return null; }
}

// Returns the verified bytes and where they came from: bundled, cache or download.
export async function modelBytes(model, runtime, fetcher = globalThis.fetch) {
    const url = modelURL(model, runtime);
    const cache = model.bundled ? null : await openCache();
    const cached = await cache?.match(url);
    if (cached) {
        try { return { bytes: await verified(await cached.arrayBuffer(), model), source: "cache" }; }
        catch { await cache.delete(url).catch(() => {}); } // A damaged entry is downloaded again.
    }
    const response = await fetcher(url).catch(() => null);
    if (!response?.ok) throw new Error("modelOffline");
    const bytes = await response.arrayBuffer();
    const result = await verified(bytes, model);
    await cache?.put(url, new Response(bytes)).catch(() => {});
    return { bytes: result, source: model.bundled ? "bundled" : "download" };
}
