import { test } from "node:test";
import assert from "node:assert/strict";
import { presetProfile } from "../src/presets.mjs";

test("default swipes work across the vertical grid and reject incomplete or unreliable motion", async () => {
    for (const platform of ["chromium", "firefox"]) {
        const { MIGTracker: Tracker } = await import(`../dist/${platform}/mig/mig-tracker.mjs`);
        for (const reverse of [false, true]) {
            for (const hand of ["right", "left"]) {
                for (const height of [-8.5, -3, 3.5, 10, 17.5]) {
                    for (const motion of ["sweep", "vertical", "jitter", "incomplete", "backwards", "triggerOnly", "lost", "gap"]) {
                        const tracker = await Tracker.create(JSON.stringify(presetProfile(reverse)));
                        let time = 0, sequence = 0;
                        const actions = [];
                        const start = hand === "right" ? 1.5 : 7.5;
                        const finish = hand === "right" ? 6.5 : 2.5;
                        const frame = (column, row = height, confidence = 1, elapsed = 40) => {
                            const buffer = tracker.native.bodyBuffer();
                            buffer.fill(0);
                            const put = (index, x, y, confidence = 1) => buffer.set([x, y, 0, confidence, 0, 0, 0, 0], index * 8);
                            // A small visible shoulder span keeps even the grid's extremes in-frame.
                            put(11, .55, .5);
                            put(12, .45, .5);
                            put(hand === "right" ? 16 : 15, .5 + (column - 4.5) * .02,
                                .5 + (row - 3.5) * .02, confidence);
                            const count = tracker.native.update(time += elapsed, ++sequence, 1, 0, 0);
                            for (let i = 0; i < count; i++) actions.push(tracker.native.eventAction(i));
                        };
                        try {
                            const from = ["backwards", "triggerOnly"].includes(motion) ? finish : start;
                            for (let i = 0; i < 40; i++) frame(from);
                            for (let i = 0; i <= 20; i++) {
                                const progress = i / 20;
                                let column = start + (finish - start) * progress;
                                let row = height, confidence = 1, elapsed = 40;
                                if (motion === "vertical") { column = start; row = -8.5 + 26 * progress; }
                                if (motion === "jitter") column = start + Math.sin(i) * .3;
                                if (motion === "incomplete") column = start + (finish - start - Math.sign(finish - start)) * progress;
                                if (motion === "backwards") column = finish + (start - finish) * progress;
                                if (motion === "triggerOnly") column = finish;
                                if (motion === "lost") confidence = .2;
                                if (motion === "gap") elapsed = 181;
                                frame(column, row, confidence, elapsed);
                            }
                            // Remaining in the terminal zone must not produce repeated actions.
                            for (let i = 0; i < 40; i++) frame(motion === "sweep" ? finish : 4.5);
                            const action = (hand === "right") !== reverse ? "next" : "previous";
                            assert.deepEqual(actions, motion === "sweep" ? [action] : [],
                                `${platform}/${reverse}/${hand}/${height}/${motion}`);
                        } finally {
                            tracker.dispose();
                        }
                    }
                }
            }
        }
    }
});
