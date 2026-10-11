import assert from "node:assert/strict";
import { test } from "node:test";
import { awayScene } from "../src/away-clock.mjs";

test("the sky waits one minute and rewards only after the second minute", () => {
    assert.equal(awayScene(59999), null);
    const first = awayScene(60000);
    assert.equal(first.night, true);
    assert.equal(first.progress, 0);
    assert.equal(first.complete, false);
    assert.equal(awayScene(119999).complete, false);
    const reward = awayScene(120000);
    assert.equal(reward.complete, true);
    assert.equal(reward.celebration, 0);
});

test("four seasons include every weather, with alternating accelerating days and nights", () => {
    const seasons = new Set();
    const weather = new Set();
    const light = new Set();
    for (let time = 60000; time < 120000; time += 100) {
        const scene = awayScene(time);
        seasons.add(scene.season);
        weather.add(scene.weather);
        light.add(scene.night);
        assert.ok(scene.progress >= 0 && scene.progress < 1);
    }
    assert.deepEqual([...seasons], ["spring", "summer", "autumn", "winter"]);
    assert.deepEqual([...weather].sort(), ["clear", "rain", "rainbow", "snow", "storm"]);
    assert.equal(light.size, 2);
    const travel = time => awayScene(time + 100).progress - awayScene(time).progress;
    assert.ok(travel(110000) > travel(61000) * 3);
    assert.equal(travel(121000), 0);
    assert.ok(travel(118000) < travel(110000));
});

test("the finale slows continuously, fades to black and stays stopped", () => {
    const before = awayScene(107999);
    const start = awayScene(108000);
    assert.ok(Math.abs(start.progress - before.progress) < .003);
    assert.equal(awayScene(117000).fade, 0);
    assert.equal(awayScene(118500).fade, .5);
    const final = awayScene(120000);
    assert.equal(final.fade, 1);
    assert.equal(final.complete, true);
    const later = awayScene(180000);
    assert.equal(later.motionAge, final.motionAge);
    assert.equal(later.progress, final.progress);
    assert.equal(later.season, "winter");
});

test("rainbows appear only in daylight immediately following rain", () => {
    let previous = awayScene(60000);
    let rainbows = 0;
    for (let time = 60010; time < 120000; time += 10) {
        const scene = awayScene(time);
        if (scene.weather === "rainbow") {
            assert.equal(scene.night, false);
            if (previous.weather !== "rainbow") {
                assert.equal(previous.weather, "rain");
                rainbows++;
            }
        }
        previous = scene;
    }
    assert.ok(rainbows > 0);
});
