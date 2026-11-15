import { test } from "node:test";
import assert from "node:assert/strict";
import { MIGTracker } from "../dist/chromium/mig/mig-tracker.mjs";
import { presetProfile } from "../src/presets.mjs";
import { projectCell, drawConfiguration } from "../src/configuration-overlay.mjs";

test("overlay uses the same engine grid and active profile boundaries as recognition", async () => {
    for (const reverse of [false, true]) {
        for (const hand of ["right", "left"]) {
            for (const aspect of [1, 16 / 9]) {
                for (const width of [.1, .3]) {
                    const profile = presetProfile(reverse);
                    const input = profile.inputs[hand === "right" ? 0 : 1];
                    const tracker = await MIGTracker.create(JSON.stringify(profile));
                    let time = 0, sequence = 0;
                    const frame = (x, y) => {
                        const buffer = tracker.native.bodyBuffer();
                        buffer.fill(0);
                        const put = (index, x, y) => buffer.set([x, y, 0, 1, 0, 0, 0, 0], index * 8);
                        put(11, .5 + width / (2 * aspect), .5);
                        put(12, .5 - width / (2 * aspect), .5);
                        put(hand === "right" ? 16 : 15, x, y);
                        return tracker.native.update(time += 100, ++sequence, aspect, 0, 0);
                    };
                    try {
                        assert.equal(tracker.grid(), null);
                        for (let i = 0; i < 20; i++) frame(.5, .5);
                        const grid = tracker.grid();
                        assert.ok(Math.abs(grid.scale - width * .2) < 1e-6);
                        assert.ok(Math.abs(grid.aspect - aspect) < 1e-6);
                        const [start, finish] = input.steps[0].constraints;
                        const project = (region, column) => projectCell(grid, [column, 3.5, 0, 0])[0];
                        const from = project(start, hand === "right" ? 2.5 : 6.5);
                        const inside = project(finish, hand === "right" ? 6.1 : 2.9);
                        const outside = project(finish, hand === "right" ? 5.9 : 3.1);
                        assert.equal(frame(1 - from.x, from.y), 0);
                        for (let i = 1; i <= 10; i++) {
                            assert.equal(frame(1 - (from.x + (outside.x - from.x) * i / 10), outside.y), 0);
                        }
                        assert.equal(frame(1 - inside.x, inside.y), 1);
                        assert.equal(tracker.native.eventId(0), input.id);
                        tracker.native.bodyBuffer().fill(0);
                        tracker.native.update(time += 100, ++sequence, aspect, 0, 0);
                        assert.equal(tracker.grid(), null);
                        tracker.recalibrate();
                        assert.equal(tracker.grid(), null);
                    } finally { tracker.dispose(); }
                }
            }
        }
    }
});

test("projection preserves the engine's shoulder rotation and mirrors only once", () => {
    const grid = { centerX: .5, centerY: .4, axisX: .8, axisY: .6, scale: .04, aspect: 2 };
    const [anchor, next] = projectCell(grid, [4.5, 3.5, 1, 1]);
    assert.deepEqual(anchor, { x: .75, y: .4 });
    assert.ok(Math.abs(next.x - (.75 - .8 * .04 / 2)) < 1e-9);
    assert.ok(Math.abs(next.y - (.4 + .6 * .04)) < 1e-9);
});

test("uncalibrated or missing engine grids clear the overlay instead of guessing zones", () => {
    let cleared = 0;
    const canvas = { width: 640, height: 480, getContext: () => ({ clearRect: () => cleared++ }) };
    const profile = presetProfile();
    const tracker = { grid: () => null };
    assert.equal(drawConfiguration(canvas, { videoWidth: 640, videoHeight: 480 }, tracker,
        profile, "right_sweep", { start: "Start", finish: "Trigger" }), false);
    assert.equal(cleared, 1);
});
