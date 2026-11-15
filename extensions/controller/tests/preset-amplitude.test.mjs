import { test } from "node:test";
import assert from "node:assert/strict";
import { presetProfile } from "../src/presets.mjs";
import { MIGTracker } from "../dist/chromium/mig/mig-tracker.mjs";

test("shorter default swipes recognize either hand and reversed bindings without accepting central drift", async () => {
    for (const reverse of [false, true]) {
        for (const hand of ["right", "left"]) {
            for (const motion of ["short", "incomplete", "backwards", "drift"]) {
                const tracker = await MIGTracker.create(JSON.stringify(presetProfile(reverse)));
                let time = 0, sequence = 0;
                const actions = [];
                const start = hand === "right" ? 1.5 : 7.5;
                const finish = hand === "right" ? 6.5 : 2.5;
                const frame = column => {
                    const buffer = tracker.native.bodyBuffer();
                    buffer.fill(0);
                    const put = (index, x, y) => buffer.set([x, y, 0, 1, 0, 0, 0, 0], index * 8);
                    put(11, .65, .45);
                    put(12, .35, .45);
                    put(hand === "right" ? 16 : 15, .5 + (column - 4.5) * .06, .6);
                    const count = tracker.native.update(time += 40, ++sequence, 1, 0, 0);
                    for (let i = 0; i < count; i++) actions.push(tracker.native.eventAction(i));
                };
                try {
                    const from = motion === "backwards" ? finish : motion === "drift" ? 4.5 : start;
                    const to = motion === "backwards" ? start : motion === "incomplete"
                        ? finish + (hand === "right" ? -1 : 1) : finish;
                    for (let i = 0; i < 40; i++) frame(from);
                    for (let i = 0; i <= 20; i++) {
                        frame(motion === "drift" ? 4.5 + Math.sin(i) * .3 : from + (to - from) * i / 20);
                    }
                    for (let i = 0; i < 40; i++) frame(motion === "drift" ? 4.5 : to);
                    const action = (hand === "right") !== reverse ? "next" : "previous";
                    assert.deepEqual(actions, motion === "short" ? [action] : [], `${reverse}/${hand}/${motion}`);
                } finally {
                    tracker.dispose();
                }
            }
        }
    }
});
