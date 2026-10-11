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
    assert.ok(Math.abs(travel(121000) - 100 / 6000) < 1e-9);
    assert.ok(travel(121000) < travel(110000));
});
