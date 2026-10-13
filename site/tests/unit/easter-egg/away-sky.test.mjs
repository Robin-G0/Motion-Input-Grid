import assert from "node:assert/strict";
import { test } from "node:test";
import { AwaySky } from "../../../src/easter-egg/away-sky.mjs";

function recordingSky() {
    const calls = [];
    const paints = [];
    const context = {};
    context.createLinearGradient = (...args) => {
        const gradient = { stops: [], addColorStop(offset, color) { this.stops.push({ offset, color }); } };
        calls.push({ name: "createLinearGradient", args });
        return gradient;
    };
    for (const name of ["beginPath", "arc", "fill", "fillRect", "moveTo", "lineTo",
        "bezierCurveTo", "closePath", "stroke", "save", "rect", "clip", "restore"]) {
        context[name] = (...args) => {
            calls.push({ name, args, ...(["fill", "stroke"].includes(name) ? { alpha: context.globalAlpha } : {}) });
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
        sky.skyChannels = null;
        paints.length = 0;
        sky.draw({ ...scene, weather }, false);
        return paints[0].color;
    };
    assert.notDeepEqual(background("clear").stops, background("rain").stops);
    assert.notDeepEqual(background("rain").stops, background("snow").stops);
    assert.equal(background("storm").stops[1].color, "rgb(37, 41, 48)");
    paints.length = 0;
    sky.draw({ ...scene, weather: "storm", night: true }, false);
    assert.equal(paints[0].color.stops[1].color, "rgb(37, 41, 48)");
});

test("sky gradients blend weather changes over time and reset for a new animation", () => {
    const { sky, paints } = recordingSky();
    const scene = { age: 1000, weather: "clear", season: "summer",
        night: false, progress: .5, celebration: null };
    sky.draw(scene, false);
    const first = [...sky.skyChannels];
    assert.notEqual(paints[0].color.stops[0].color, paints[0].color.stops[1].color);
    sky.draw({ ...scene, age: 1016, weather: "storm" }, false);
    const next = [...sky.skyChannels];
    for (let index = 0; index < 3; index++) {
        assert.ok(next[index] < first[index]);
        assert.ok(first[index] - next[index] < 8);
    }
    sky.draw({ ...scene, age: 6000, weather: "storm" }, false);
    assert.equal(Math.round(sky.skyChannels[0]), 37);
    sky.draw({ ...scene, age: 0 }, false);
    assert.deepEqual(sky.skyChannels, first);
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
    const drift = Math.max(0, sky.width / 2 - Math.max(first.size * 2,
        Math.min(sky.width * .25, sky.height * .3))) * .8;
    assert.equal(first.x, sky.width * .5 + Math.sin(1000 / 3000) * drift);
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
    const precipitation = calls.slice(calls.findIndex(call => call.name === "clip") + 1);
    assert.ok(precipitation.some(call => call.name === "moveTo"));
    for (const { args: [x, y] } of precipitation.filter(call => call.name === "moveTo")) {
        assert.ok(x >= left && x <= left + width);
        assert.ok(y >= top && y <= top + height);
    }
    assert.equal(calls.at(-1).name, "restore");
});

test("rainbow ends extend under grass, which is painted over them", () => {
    const { sky, calls } = recordingSky();
    const scene = { age: 14000, weather: "rainbow", season: "spring",
        night: false, progress: .5, celebration: null };
    sky.draw(scene, false);
    calls.length = 0;
    sky.draw({ ...scene, age: 14900 }, false);
    const bands = calls.filter(call => call.name === "arc" && call.args[3] === Math.PI);
    assert.equal(bands.length, 6);
    for (const { args } of bands) assert.ok(args[1] > sky.height * .96);
    assert.ok(calls.findLastIndex(call => call.name === "stroke")
        < calls.findIndex(call => call.name === "bezierCurveTo"));
});

test("a static night scene does not introduce a rainbow", () => {
    const { sky, calls } = recordingSky();
    sky.drawWeather({ age: 14000, weather: "rainbow", night: true }, 0, false);
    assert.equal(calls.filter(call => call.name === "arc").length, 0);
});

test("props fade in on entry and crossfade from rain to sun and rainbow", () => {
    const { sky } = recordingSky();
    const rain = { age: 0, weather: "rain", night: false };
    assert.equal(sky.propOpacities(rain, false).cloud, 0);
    assert.equal(sky.propOpacities({ ...rain, age: 450 }, false).cloud, .5);
    assert.equal(sky.propOpacities({ ...rain, age: 900 }, false).rain, 1);
    const rainbow = { age: 1000, weather: "rainbow", night: false };
    const start = sky.propOpacities(rainbow, false);
    assert.equal(start.sun, 0);
    assert.equal(start.rainbow, 0);
    assert.equal(start.cloud, 1);
    const middle = sky.propOpacities({ ...rainbow, age: 1450 }, false);
    assert.equal(middle.sun, .5);
    assert.equal(middle.rainbow, .5);
    assert.equal(middle.cloud, .5);
    assert.equal(middle.rain, .5);
    const end = sky.propOpacities({ ...rainbow, age: 1900 }, false);
    assert.equal(end.sun, 1);
    assert.equal(end.rainbow, 1);
    assert.equal(end.cloud, 0);
    assert.equal(end.rain, 0);
});

test("moon and cloud each fade as a single shape without opacity overlap", () => {
    const { sky, calls } = recordingSky();
    sky.drawCelestial(true, .5, .5);
    assert.deepEqual(calls.filter(call => call.name === "fill").map(call => call.alpha), [.5]);
    calls.length = 0;
    sky.context.globalAlpha = .5;
    sky.drawCloud({ x: 100, y: 100, size: 30 });
    assert.deepEqual(calls.filter(call => call.name === "fill").map(call => call.alpha), [.5]);
});

test("rainbow remains partially drawn while fading out into night", () => {
    const { sky, calls } = recordingSky();
    const scene = { age: 0, weather: "rainbow", season: "spring", night: false,
        progress: .5, celebration: null };
    sky.draw(scene, false);
    sky.draw({ ...scene, age: 900 }, false);
    sky.draw({ ...scene, age: 1000, night: true, weather: "rain" }, false);
    calls.length = 0;
    sky.draw({ ...scene, age: 1450, night: true, weather: "rain" }, false);
    const bands = calls.filter(call => call.name === "arc" && call.args[3] === Math.PI);
    assert.equal(bands.length, 6);
    assert.ok(calls.filter(call => call.name === "stroke" && call.alpha === .45).length >= 6);
    calls.length = 0;
    sky.draw({ ...scene, age: 1900, night: true, weather: "rain" }, false);
    assert.equal(calls.filter(call => call.name === "arc" && call.args[3] === Math.PI).length, 0);
});

test("interrupted fades reverse from their current opacity without a jump", () => {
    const { sky } = recordingSky();
    const rain = { age: 0, weather: "rain", night: false };
    sky.propOpacities(rain, false);
    sky.propOpacities({ ...rain, age: 900 }, false);
    sky.propOpacities({ ...rain, age: 1000, weather: "clear" }, false);
    const before = sky.propOpacities({ ...rain, age: 1450, weather: "clear" }, false);
    assert.equal(before.sun, .5);
    const reversed = sky.propOpacities({ ...rain, age: 1450 }, false);
    assert.deepEqual(reversed, before);
    const after = sky.propOpacities({ ...rain, age: 1900 }, false);
    assert.equal(after.sun, .25);
    assert.equal(after.cloud, .75);
});

test("fades depend on elapsed time and reset between runs; reduced motion stays static", () => {
    const { sky } = recordingSky();
    const { sky: sparse } = recordingSky();
    const scene = { age: 0, weather: "clear", night: false };
    sky.propOpacities(scene, false);
    sparse.propOpacities(scene, false);
    for (let age = 30; age < 450; age += 30) sky.propOpacities({ ...scene, age }, false);
    assert.deepEqual(sky.propOpacities({ ...scene, age: 450 }, false), sparse.propOpacities({ ...scene, age: 450 }, false));
    sky.reset();
    assert.equal(sky.propOpacities({ ...scene, age: 2000 }, false).sun, 0);
    const reduced = sky.propOpacities({ ...scene, age: 2000, weather: "rain", night: true }, true);
    assert.equal(reduced.cloud, 1);
    assert.equal(reduced.rain, 1);
    assert.equal(reduced.sun, 0);
    assert.equal(reduced.moon, 1);
    assert.equal(reduced.rainbow, 0);
});

test("after the finale only the black background remains", () => {
    const { sky, calls } = recordingSky();
    sky.draw({ complete: true, celebration: 5000 }, false);
    assert.deepEqual(calls, [{ name: "fillRect", args: [0, 0, 1280, 720] }]);
    assert.equal(sky.context.fillStyle, "#000");
    assert.equal(sky.context.globalAlpha, 1);
});
