import assert from "node:assert/strict";
import { test } from "node:test";
import { AwaySky } from "../src/away-sky.mjs";

function recordingSky() {
    const calls = [];
    const context = {};
    for (const name of ["beginPath", "arc", "fill", "fillRect", "moveTo", "lineTo",
        "bezierCurveTo", "closePath", "stroke", "save", "rect", "clip", "restore"]) {
        context[name] = (...args) => calls.push({ name, args });
    }
    const sky = new AwaySky({ getContext: () => context });
    sky.width = 1280;
    sky.height = 720;
    return { sky, calls };
}

test("sun and moon follow a circular arc above the horizon", () => {
    const { sky, calls } = recordingSky();
    for (const night of [false, true]) {
        for (const progress of [0, .25, .5, .75, 1]) {
            calls.length = 0;
            sky.drawCelestial(night, progress);
            const [x, y] = calls.find(call => call.name === "arc").args;
            const distance = Math.hypot(x - sky.width * .5, y - sky.height * .87);
            assert.ok(Math.abs(distance - Math.min(sky.width * .42, sky.height * .68)) < 1e-9);
            assert.ok(y <= sky.height * .87 + 1e-9);
        }
    }
});

test("weather drifts horizontally and stays still with reduced motion", () => {
    const { sky } = recordingSky();
    const first = sky.weatherPosition({ age: 1000 }, false);
    const second = sky.weatherPosition({ age: 2000 }, false);
    assert.ok(second.x > first.x);
    assert.equal(second.y, first.y);
    assert.deepEqual(sky.weatherPosition({ age: 1000 }, true),
        sky.weatherPosition({ age: 2000 }, true));
});

test("rain is clipped to a moving cloud's footprint and begins below it", () => {
    const { sky, calls } = recordingSky();
    const scene = { age: 4000, weather: "rain" };
    const cloud = sky.weatherPosition(scene, false);
    sky.drawWeather(scene, 1, false);
    const [left, top, width, height] = calls.find(call => call.name === "rect").args;
    assert.equal(top, cloud.y + cloud.size);
    assert.ok(calls.findIndex(call => call.name === "clip")
        < calls.findIndex(call => call.name === "moveTo"));
    for (const { args: [x, y] } of calls.filter(call => call.name === "moveTo")) {
        assert.ok(x >= left && x <= left + width);
        assert.ok(y >= top && y <= top + height);
    }
    assert.equal(calls.at(-1).name, "restore");
});

test("rainbow ends extend under grass, which is painted over them", () => {
    const { sky, calls } = recordingSky();
    sky.draw({ age: 14000, weather: "rainbow", season: "spring",
        night: false, progress: .5, celebration: null }, false);
    const bands = calls.filter(call => call.name === "arc" && call.args[3] === Math.PI);
    assert.equal(bands.length, 6);
    for (const { args } of bands) assert.ok(args[1] > sky.height * .96);
    assert.ok(calls.findLastIndex(call => call.name === "stroke")
        < calls.findIndex(call => call.name === "bezierCurveTo"));
});

test("after the finale only the black background remains", () => {
    const { sky, calls } = recordingSky();
    sky.draw({ complete: true, celebration: 5000 }, false);
    assert.deepEqual(calls, [{ name: "fillRect", args: [0, 0, 1280, 720] }]);
    assert.equal(sky.context.fillStyle, "#000");
    assert.equal(sky.context.globalAlpha, 1);
});
