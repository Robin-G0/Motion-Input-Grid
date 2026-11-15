import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { once } from "node:events";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";

const individual = process.env.MIG_EXAMPLE_DIR;
const technologyFilter = process.env.MIG_EXAMPLE_TYPE;
const profile = JSON.parse(await readFile(individual
    ? resolve(individual, technologyFilter === 'web' ? 'default.json'
        : `${technologyFilter === 'next' ? 'out' : 'dist'}/mig/default.json`)
    : "examples/common/raised-hands.json", "utf8"));
const browser = await chromium.launch(process.env.MIG_BROWSER
    ? { executablePath: process.env.MIG_BROWSER } : {});
const modelSource = `
export async function loadModels() {
    let begin;
    return {
        pose: { close() {}, detectForVideo(video, time) {
            begin ??= time;
            const elapsed = time - begin;
            const row = elapsed < 1400 ? 5.5 : elapsed < 1600 ? 4.5
                : elapsed < 1800 ? 3.5 : elapsed < 2000 ? 2.5 : 1.5;
            const points = Array.from({ length: 33 }, () =>
                ({ x: .5, y: .5, z: 0, visibility: 0 }));
            const put = (index, x, y) => { points[index] = { x, y, z: .1, visibility: 1 }; };
            put(11, .65, .45); put(12, .35, .45);
            put(15, .62, .45 + (row - 3.5) * .06);
            put(16, .38, .45 + (row - 3.5) * .06);
            return { landmarks: [points] };
        } },
        hands: { close() {}, detectForVideo() { return { landmarks: [] }; } }
    };
}`;

try {
    for (const technology of technologyFilter ? [technologyFilter] : ["react", "vue", "next"]) {
        const plain = technology === 'web';
        const actionsSelector = plain ? '#actions' : '.actions';
        const output = technology === "next" ? "out" : plain ? '.' : "dist";
        const directory = individual ? resolve(individual, output)
            : resolve(process.env.MIG_EXAMPLES ?? "examples", technology, output);
        const { serve: serveExample } = await import(individual
            ? pathToFileURL(resolve(individual, 'server.mjs'))
            : new URL(`../../../examples/${technology}/server.mjs`, import.meta.url));
        const server = serveExample(directory, 0);
        await once(server, "listening");
        const base = `http://127.0.0.1:${server.address().port}`;
        try {
            for (const mode of ["hands", "profile"]) {
                const page = await browser.newPage();
                const errors = [];
                page.on("pageerror", error => errors.push(error.message));
                await page.route(plain ? "**/models.mjs" : "**/mig/models.mjs", route => route.fulfill({
                    contentType: "text/javascript", body: modelSource
                }));
                await page.addInitScript(() => {
                    window.releasedTracks = 0;
                    navigator.mediaDevices.getUserMedia = async () => {
                        const canvas = document.createElement("canvas");
                        canvas.width = canvas.height = 480;
                        const context = canvas.getContext("2d");
                        const stream = canvas.captureStream(30);
                        const timer = setInterval(() => context.fillRect(0, 0, 480, 480), 30);
                        for (const track of stream.getTracks()) {
                            const stop = track.stop.bind(track);
                            track.stop = () => {
                                ++window.releasedTracks;
                                clearInterval(timer);
                                stop();
                            };
                        }
                        return stream;
                    };
                });
                await page.goto(`${base}/${mode === "profile" ? "profile.html" : ""}`);
                if (mode === "profile") {
                    const custom = structuredClone(profile);
                    custom.inputs[0].action = "custom action";
                    custom.inputs[1].action = "second action";
                    await page.locator("input[type=file]").setInputFiles({
                        name: "custom.json", mimeType: "application/json",
                        buffer: Buffer.from(JSON.stringify(custom))
                    });
                    await (plain ? page.locator('#status') : page.getByRole("status"))
                        .filter({ hasText: "Profile imported" }).waitFor();
                }
                await page.getByRole("button", { name: "Start camera" }).click();
                const expected = mode === "hands" ? "Left hand raised!" : "custom action";
                await page.locator(actionsSelector).filter({ hasText: expected }).waitFor({ timeout: 15000 });
                const feedback = await page.locator(actionsSelector).textContent();
                assert.match(feedback, mode === "hands" ? /Right hand raised!/ : /second action/);
                const transform = await page.locator("video").evaluate(element => getComputedStyle(element).transform);
                assert.match(transform, /matrix\(-1/);
                if (mode === "profile") {
                    await page.locator("input[type=file]").setInputFiles({
                        name: "bad.json", mimeType: "application/json", buffer: Buffer.from("{}")
                    });
                    if (plain) await page.locator('#status').filter({ hasText: /schema|input|invalid/i }).waitFor();
                    else await page.locator('p[role="alert"]')
                        .filter({ hasText: /schema|input|invalid/i }).waitFor();
                    assert.match(await page.locator(actionsSelector).textContent(), /custom action/);
                }
                await page.getByRole("button", { name: plain ? "Stop camera" : "Stop", exact: true }).click();
                assert.equal(await page.evaluate(() => window.releasedTracks), 1);
                assert.deepEqual(errors, []);
                await page.close();
                console.log(`${technology} ${mode}: real WASM actions, import, mirror and stream cleanup passed`);
            }
        } finally {
            await new Promise(resolve => server.close(resolve));
        }
    }
} finally {
    await browser.close();
}
