import assert from "node:assert/strict";
import { test } from "node:test";
import { configurePose } from "../src/camera.mjs";

test("presence confidence configures the model itself before video processing", async () => {
    let configured;
    const models = { pose: { async setOptions(options) { configured = options; } } };
    assert.equal(await configurePose(models), models);
    assert.deepEqual(configured, {
        minPoseDetectionConfidence: .8,
        minPosePresenceConfidence: .8,
        minTrackingConfidence: .8
    });
});

test("failed pose configuration closes both loaded models", async () => {
    const closed = [];
    const models = {
        pose: {
            async setOptions() { throw new Error("configuration failed"); },
            close() { closed.push("pose"); }
        },
        hands: { close() { closed.push("hands"); } }
    };
    await assert.rejects(configurePose(models), /configuration failed/);
    assert.deepEqual(closed, ["pose", "hands"]);
});
