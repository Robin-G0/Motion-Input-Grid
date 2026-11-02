import { test } from "node:test";
import assert from "node:assert/strict";
import { presetProfile } from "../src/presets.mjs";

test("relaxed starts and slow swipes work at 6–15 FPS across body sizes and camera aspects", async () => {
    for (const platform of ["chromium", "firefox"]) {
        const { MIGTracker } = await import(`../dist/${platform}/mig/mig-tracker.mjs`);
        for (const reverse of [false, true]) {
            for (const hand of ["right", "left"]) {
                for (const intervals of [[67], [100], [167], [67, 100, 80, 145]]) {
                    for (const width of [.09, .15, .30]) {
                        for (const aspect of [1, 16 / 9]) {
                            for (const duration of [400, 1000, 3000]) {
                                for (const height of [0, 10]) {
                                    const tracker = await MIGTracker.create(JSON.stringify(presetProfile(reverse)));
                                    let time = 0, sequence = 0;
                                    const actions = [];
                                    const start = hand === "right" ? 2.5 : 6.5;
                                    const finish = hand === "right" ? 6.5 : 2.5;
                                    const scale = width * .2;
                                    const frame = (column, visible = true) => {
                                        time += intervals[sequence % intervals.length];
                                        const buffer = tracker.native.bodyBuffer();
                                        buffer.fill(0);
                                        const put = (index, x, y, confidence = 1) => buffer.set([x, y, 0, confidence, 0, 0, 0, 0], index * 8);
                                        put(11, .5 + width / (2 * aspect), .5);
                                        put(12, .5 - width / (2 * aspect), .5);
                                        put(hand === "right" ? 16 : 15,
                                            .5 + (column - 4.5) * scale / aspect,
                                            .5 + (height - 3.5) * scale, visible ? 1 : 0);
                                        const count = tracker.native.update(time, ++sequence, aspect, 0, 0);
                                        for (let i = 0; i < count; i++) actions.push(tracker.native.eventAction(i));
                                    };
                                    try {
                                        // Calibrate before starting the motion, even at the lowest rate.
                                        while (time < 2000) frame(start, false);
                                        frame(start);
                                        frame(start);
                                        const began = time;
                                        while (time - began < duration) {
                                            const next = time + intervals[sequence % intervals.length];
                                            const progress = Math.min(1, (next - began) / duration);
                                            frame(start + (finish - start) * progress);
                                        }
                                        // A held finish must produce a single command despite elapsed cooldowns.
                                        const ended = time;
                                        while (time - ended < 2000) frame(finish);
                                        const action = (hand === "right") !== reverse ? "next" : "previous";
                                        assert.deepEqual(actions, [action],
                                            `${platform}/${reverse}/${hand}/${intervals}/${width}/${aspect}/${duration}/${height}`);
                                    } finally {
                                        tracker.dispose();
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
});

test("slow-camera presets keep the existing continuity and tracking safeguards", async () => {
    const { MIGTracker } = await import("../dist/chromium/mig/mig-tracker.mjs");
    for (const hand of ["right", "left"]) {
        for (const fault of ["gap", "confidence", "shoulders", "outside", "timeout"]) {
            const profile = presetProfile();
            // Explicit user time limits still apply; the defaults allow resting.
            if (fault === "timeout") for (const input of profile.inputs) input.max_duration_ms = 4000;
            const tracker = await MIGTracker.create(JSON.stringify(profile));
            let time = 0, sequence = 0;
            const actions = [];
            const start = hand === "right" ? 2.5 : 6.5;
            const finish = hand === "right" ? 6.5 : 2.5;
            const frame = (column, active = false) => {
                const buffer = tracker.native.bodyBuffer();
                buffer.fill(0);
                const put = (index, x, y, confidence = 1) => buffer.set([x, y, 0, confidence, 0, 0, 0, 0], index * 8);
                put(11, .55, .5, active && fault === "shoulders" ? .2 : 1);
                put(12, .45, .5);
                put(hand === "right" ? 16 : 15, .5 + (column - 4.5) * .02,
                    active && fault === "outside" ? 1.1 : .5,
                    active && fault === "confidence" ? .2 : 1);
                const count = tracker.native.update(time += active && fault === "gap" ? 181 : 100,
                    ++sequence, 1, 0, 0);
                for (let i = 0; i < count; i++) actions.push(tracker.native.eventAction(i));
            };
            try {
                for (let i = 0; i < 20; i++) frame(start);
                if (fault === "timeout") for (let i = 0; i < 41; i++) frame(start);
                for (let i = 1; i <= 15; i++) frame(start + (finish - start) * i / 15, true);
                assert.deepEqual(actions, [], `${hand}/${fault}`);
            } finally {
                tracker.dispose();
            }
        }
    }
});
