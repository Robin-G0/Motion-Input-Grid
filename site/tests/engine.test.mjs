import assert from "node:assert/strict";
import { test } from "node:test";
import createMIG from "../dist/mig/mig.mjs";
import { gestureProfile } from "../src/gestures.mjs";

test("the published WASM engine recognizes both swipe directions with either anatomical hand", async () => {
    const module = await createMIG();
    // Exercise native ordered regions near both vertical edges of the camera.
    for (const wristHeight of [.01, .52, .99]) {
        for (const hand of ["left", "right"]) {
            for (const direction of [1, -1]) {
                const tracker = new module.Tracker();
                try {
                    assert.equal(tracker.load(JSON.stringify(gestureProfile)), "");
                    assert.equal(tracker.trackHands(), false);
                    let sequence = 0;
                    let timestamp = 0;
                    function frame(rightColumn, leftColumn) {
                        const points = tracker.bodyBuffer();
                        points.fill(0);
                        const put = (index, x, y) => points.set([x, y, 0, 1, 0, 0, 0, 0], index * 8);
                        put(11, .65, .45);
                        put(12, .35, .45);
                        // One body-grid cell is 20% of the 0.30 shoulder span.
                        put(16, .5 + (rightColumn - 4.5) * .06, wristHeight);
                        put(15, .5 + (leftColumn - 4.5) * .06, wristHeight);
                        const count = tracker.update(timestamp += 20, ++sequence, 1, 0, 0);
                        assert.ok(count >= 0);
                        return Array.from({ length: count }, (_, index) => tracker.eventAction(index));
                    }
                    const start = direction === 1 ? 2 : 7;
                    const finish = direction === 1 ? 7 : 2;
                    const observe = column => hand === "right" ? frame(column, 4.5) : frame(4.5, column);
                    for (let index = 0; index < 65; ++index) assert.deepEqual(observe(start), []);
                    const actions = [];
                    const columns = direction === 1 ? [2, 3, 4, 5, 6, 7] : [7, 6, 5, 4, 3, 2];
                    for (const column of columns) actions.push(...observe(column));
                    assert.deepEqual(actions, [direction === 1 ? "next_slide" : "previous_slide"]);
                    // Keeping either hand in the trigger must not repeatedly change the slide.
                    for (let index = 0; index < 50; ++index) assert.deepEqual(observe(finish), []);
                    assert.notEqual(tracker.coordinate(11, 0), null);
                    tracker.bodyBuffer().fill(0);
                    tracker.update(timestamp += 20, ++sequence, 1, 0, 0);
                    assert.equal(tracker.coordinate(11, 0), null);
                } finally {
                    tracker.delete();
                }
            }
        }
    }
});

function sparseProfile(columns) {
    const constraints = columns.map((column, index) => ({
        id: `cell_${index}`,
        landmark: "left_wrist",
        cell: [column, 3],
        type: index === 2 ? "trigger" : "required",
        priority: "high",
        order: index + 1
    }));
    return { schema_version: 2, inputs: [{
        id: "sparse", name: "Sparse path", space: "body", action: "sparse",
        cooldown_ms: 800, max_duration_ms: 2500,
        steps: [{ id: "path", mode: "ordered", constraints }]
    }] };
}

test("published MIG sweeps infer skipped cells only within their continuity and travel limits", async () => {
    const module = await createMIG();
    for (const gap of [100, 180, 181, 500]) {
        for (const direction of [1, -1]) {
            for (const travel of [2, 4]) {
                const tracker = new module.Tracker();
                try {
                    const columns = direction === 1 ? [2, 3, 2 + travel] : [2 + travel, 3, 2];
                    assert.equal(tracker.load(JSON.stringify(sparseProfile(columns))), "");
                    let time = 0, sequence = 0;
                    const frame = (column, elapsed) => {
                        const points = tracker.bodyBuffer();
                        points.fill(0);
                        const put = (index, x, y) => points.set([x, y, 0, 1, 0, 0, 0, 0], index * 8);
                        put(11, .65, .45);
                        put(12, .35, .45);
                        put(15, .5 + (column + .5 - 4.5) * .06, .45);
                        return tracker.update(time += elapsed, ++sequence, 1, 0, 0);
                    };
                    for (let index = 0; index < 65; ++index) frame(columns[0], 20);
                    assert.equal(frame(columns[2], gap), gap <= 180 && travel <= 2.8 ? 1 : 0);
                } finally {
                    tracker.delete();
                }
            }
        }
    }
});
