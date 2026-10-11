import assert from "node:assert/strict";
import { test } from "node:test";
import { SlideController } from "../../../src/presentation/slides.mjs";

test("carousel stays bounded and manual navigation does not insert a gift", () => {
    const slides = new SlideController(3);
    assert.equal(slides.move(-1), 0);
    assert.equal(slides.canMove(-1), false);
    assert.equal(slides.move(1), 1);
    assert.equal(slides.move(1), 2);
    assert.equal(slides.move(1), 2);
    assert.equal(slides.canMove(1), false);
    assert.deepEqual(slides.entries, [0, 1, 2]);
    assert.equal(slides.gesture("next_slide", 0), false);
    assert.equal(slides.gesture("previous_slide", 0), true);
    assert.equal(slides.gesture("previous_slide", 100), false);
    assert.equal(slides.gesture("unrelated", 2000), false);
});

test("a first forward hand gesture inserts a gift; leaving it restores the original sequence", () => {
    for (const exit of [-1, 1]) {
        const slides = new SlideController(3);
        slides.gesture("next_slide", 0);
        assert.equal(slides.index, 1);
        assert.deepEqual(slides.entries, [0, "gift", 1, 2]);
        slides.gesture("previous_slide", 900);
        assert.equal(slides.index, "gift");
        slides.move(exit);
        assert.equal(slides.index, exit === 1 ? 1 : 0);
        assert.deepEqual(slides.entries, [0, 1, 2]);
        slides.select(0);
        slides.gesture("next_slide", 2000);
        assert.deepEqual(slides.entries, [0, 1, 2]);
    }
});
