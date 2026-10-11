import assert from "node:assert/strict";
import { test } from "node:test";
import { AwaySky } from "../src/away-sky.mjs";

function recordingSky() {
    const calls = [];
    const paints = [];
    const context = {};
    for (const name of ["beginPath", "arc", "fill", "fillRect", "moveTo", "lineTo",
        "bezierCurveTo", "closePath", "stroke", "save", "rect", "clip", "restore"]) {
        context[name] = (...args) => {
            calls.push({ name, args });
            if (name === "fillRect") paints.push({ color: context.fillStyle, alpha: context.globalAlpha });
        };
    }
    const sky = new AwaySky({ getContext: () => context });
    sky.width = 1280;
    sky.height = 720;
    return { sky, calls, paints };
}

test("sun and moon follow a circular arc and set before switching", () => {
    const { sky, calls } = recordingSky();
    for (const night of [false, true]) {
        for (const progress of [0, .25, .5, .75, 1]) {
            calls.length = 0;
            sky.drawCelestial(night, progress);
            const [x, y] = calls.find(call => call.name === "arc").args;
            const distance = Math.hypot(x - sky.width * .5, y - sky.height * .98);
            assert.ok(Math.abs(distance - Math.min(sky.width * .42, sky.height * .68)) < 1e-9);
            if (progress === 0 || progress === 1) assert.ok(y > sky.height);
            else assert.ok(y < sky.height * .98);
        }
    }
});

test("weather changes the sky and storms stay dark even during the day", () => {
    const { sky, paints } = recordingSky();
    const scene = { age: 1000, season: "summer", night: false, progress: .5, celebration: null };
    const background = weather => {
        paints.length = 0;
        sky.draw({ ...scene, weather }, false);
        return paints[0].color;
    };
    assert.notEqual(background("clear"), background("rain"));
    assert.notEqual(background("rain"), background("snow"));
    assert.equal(background("storm"), "rgb(37, 41, 48)");
    paints.length = 0;
    sky.draw({ ...scene, weather: "storm", night: true }, false);
    assert.equal(paints[0].color, "rgb(37, 41, 48)");
});

test("storm flashes are brief, spaced apart and disabled with reduced motion", () => {
    const { sky, paints } = recordingSky();
    for (const age of [0, 3199, 3380, 7000]) {
        sky.drawStormFlash({ weather: "storm", age }, false);
    }
    assert.equal(paints.length, 0);
    sky.drawStormFlash({ weather: "storm", age: 3290 }, true);
    assert.equal(paints.length, 0);
    sky.drawStormFlash({ weather: "storm", age: 3290 }, false);
    assert.deepEqual(paints, [{ color: "#fff", alpha: .4 }]);
    sky.drawStormFlash({ weather: "rain", age: 3290 }, false);
    assert.equal(paints.length, 1);
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
