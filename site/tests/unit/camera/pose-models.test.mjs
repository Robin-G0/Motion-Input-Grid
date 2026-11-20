import assert from "node:assert/strict";
import { test } from "node:test";
import { availablePoseModels, boundStudioModels } from "../../../studio/src/camera.mjs";

test("the model choice appears only when the published runtime can load several models", async () => {
    assert.deepEqual(await availablePoseModels(async () => ({ poseModels: { lite: {}, full: {}, heavy: {} } })),
        ["lite", "full", "heavy"]);
    assert.deepEqual(await availablePoseModels(async () => ({ loadModels() {} })), []);
    assert.deepEqual(await availablePoseModels(async () => ({ poseModels: { lite: {} } })), []);
    assert.deepEqual(await availablePoseModels(async () => { throw new Error("offline"); }), []);
});

test("a live model change keeps the bounded frame wrapper and closes the previous task", async () => {
    const closed = [];
    const task = name => ({ name, close() { closed.push(name); }, detectForVideo() { return name; } });
    const loaded = { pose: task("lite"), hands: task("hands"),
        async loadPose(name) { const previous = this.pose; this.pose = task(name); previous.close(); } };
    boundStudioModels(loaded);
    const video = { videoWidth: 2000, videoHeight: 1000 };
    let drawn = null;
    globalThis.document = { createElement: () => ({ getContext: () => ({ drawImage: (source, x, y, width, height) => { drawn = { width, height }; } }) }) };
    try {
        assert.equal(loaded.pose.detectForVideo(video, 1), "lite");
        assert.deepEqual(drawn, { width: 960, height: 480 });
        await loaded.loadPose("full");
        assert.deepEqual(closed, ["lite"]);
        drawn = null;
        assert.equal(loaded.pose.detectForVideo(video, 2), "full");
        assert.deepEqual(drawn, { width: 960, height: 480 }, "the replacement task is bounded too");
    } finally {
        delete globalThis.document;
    }
});
