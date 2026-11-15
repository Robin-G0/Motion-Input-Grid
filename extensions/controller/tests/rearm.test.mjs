import { test } from "node:test";
import assert from "node:assert/strict";
import { MIGTracker } from "../dist/chromium/mig/mig-tracker.mjs";
import { presetProfile } from "../src/presets.mjs";

async function session(hand, reverse = false) {
    const tracker = await MIGTracker.create(JSON.stringify(presetProfile(reverse)));
    let time = 0, sequence = 0;
    const actions = [];
    const start = hand === "right" ? 2.5 : 6.5;
    const finish = hand === "right" ? 6.5 : 2.5;
    const frame = column => {
        const points = tracker.native.bodyBuffer();
        points.fill(0);
        const put = (index, x, y) => points.set([x, y, 0, 1, 0, 0, 0, 0], index * 8);
        put(11, .65, .45);
        put(12, .35, .45);
        put(hand === "right" ? 16 : 15, .5 + (column - 4.5) * .06, .6);
        const count = tracker.native.update(time += 100, ++sequence, 1, 0, 0);
        for (let i = 0; i < count; i++) actions.push(tracker.native.eventAction(i));
    };
    const hold = (column, frames) => { for (let i = 0; i < frames; i++) frame(column); };
    const swipe = () => { for (let i = 1; i <= 10; i++) frame(start + (finish - start) * i / 10); };
    hold(4.5, 20);
    return { tracker, actions, start, finish, frame, hold, swipe,
        action: (hand === "right") !== reverse ? "next" : "previous" };
}

test("the first swipe works after resting in its starting zone for more than four seconds", async () => {
    for (const hand of ["right", "left"]) {
        for (const reverse of [false, true]) {
            const state = await session(hand, reverse);
            try {
                state.hold(state.start, 65);
                state.swipe();
                assert.deepEqual(state.actions, [state.action], `${hand}/${reverse}`);
            } finally { state.tracker.dispose(); }
        }
    }
});

test("returning to start during cooldown does not consume the next swipe", async () => {
    for (const hand of ["right", "left"]) {
        for (const reverse of [false, true]) {
            for (const neutralFrame of [false, true]) {
                const state = await session(hand, reverse);
                try {
                    state.hold(state.start, 2);
                    state.swipe();
                    assert.deepEqual(state.actions, [state.action]);
                    for (let cycle = 0; cycle < 3; cycle++) {
                        if (neutralFrame) state.frame(4.5);
                        state.hold(state.start, 12);
                        state.swipe();
                    }
                    assert.deepEqual(state.actions, Array(4).fill(state.action), `${hand}/${reverse}/${neutralFrame}`);
                    state.hold(state.finish, 30);
                    assert.equal(state.actions.length, 4, "Holding the finish must not repeat the command");
                } finally { state.tracker.dispose(); }
            }
        }
    }
});
