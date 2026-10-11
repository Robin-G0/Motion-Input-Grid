import assert from "node:assert/strict";
import { test } from "node:test";
import { Assistance } from "../src/assistance.mjs";

function guide(step) {
    const instance = Object.create(Assistance.prototype);
    instance.step = step;
    instance.pointer = {};
    instance.marker = { reset() {} };
    instance.render = () => {};
    instance.resets = 0;
    instance.options = {
        presentationComplete: () => false,
        giftActive: () => false,
        resetGestures: () => instance.resets++,
        cooldown() {}
    };
    return instance;
}

test("tour instructions allow every navigation direction without consuming gestures", async () => {
    for (const step of ["scroll", "ribbonForward", "ribbonBack", "ribbonBrowse", "gift", "presenceScroll", "presence", "finale"]) {
        for (const action of ["next_slide", "previous_slide", "scroll_presentation", "scroll_previous"]) {
            const instance = guide(step);
            assert.equal(instance.action(action), false, `${step}: ${action}`);
            await Promise.resolve();
            assert.equal(instance.resets, 0, `${step}: ${action} preserves tracking`);
        }
    }
});

test("instruction changes preserve tracking, while camera practice resets its samples", () => {
    const instance = guide("ribbonForward");
    for (const step of ["ribbonBack", "ribbonBrowse", "presence", "away", "finale"]) {
        instance.go(step);
        assert.equal(instance.resets, 0);
    }
    instance.go("aim");
    assert.equal(instance.resets, 1);
    instance.go("right");
    assert.equal(instance.resets, 2);
    assert.equal(instance.action("next_slide"), true);
    assert.equal(instance.step, "right");
});

test("returning to the presentation restores its instruction instead of restarting it", () => {
    const instance = guide("scroll");
    instance.go("ribbonBack");
    instance.go("scroll");
    assert.equal(instance.presentationStep, "ribbonBack");
    instance.go("ribbonForward");
    assert.equal(instance.step, "ribbonBack");
    instance.go("presenceScroll");
    instance.go("presence");
    assert.equal(instance.presentationStep, "ribbonBrowse");
});
