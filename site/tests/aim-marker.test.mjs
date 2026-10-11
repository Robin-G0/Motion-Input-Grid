import assert from "node:assert/strict";
import { test } from "node:test";
import { AimMarker } from "../src/aim-marker.mjs";
import { assistanceCopy } from "../src/assistance-copy.mjs";

test("the visual marker smooths movement without changing raw observations", () => {
    const marker = new AimMarker();
    assert.deepEqual(marker.update({ x: .2, y: .4 }, 0), { x: .2, y: .4 });
    const raw = { x: .8, y: .6 };
    const visible = marker.update(raw, 30);
    assert.ok(visible.x > .2 && visible.x < raw.x);
    assert.ok(visible.y > .4 && visible.y < raw.y);
    assert.deepEqual(raw, { x: .8, y: .6 });
});

test("brief missing observations keep the marker; long gaps and resets clear its history", () => {
    const marker = new AimMarker();
    assert.equal(marker.update(null, 0), null);
    marker.update({ x: .2, y: .4 }, 0);
    assert.deepEqual(marker.update(null, 200), { x: .2, y: .4 });
    assert.equal(marker.update(null, 300), null);
    assert.deepEqual(marker.update({ x: .8, y: .6 }, 400), { x: .8, y: .6 });
    marker.reset();
    assert.equal(marker.update(null, 401), null);
});

test("both guide languages have the same controls and vertical instructions", () => {
    assert.deepEqual(Object.keys(assistanceCopy.fr), Object.keys(assistanceCopy.en));
    for (const text of Object.values(assistanceCopy)) {
        assert.equal(text.scroll, text.presenceScroll);
        assert.equal(Object.hasOwn(text, "slides"), false);
    }
});
