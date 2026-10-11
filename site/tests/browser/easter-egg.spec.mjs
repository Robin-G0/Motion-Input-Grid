import { test, expect } from "@playwright/test";
import { mockCamera, holdHandsInFrame } from "./support/camera.mjs";

for (const reducedMotion of ["reduce", "no-preference"]) {
    test(`an uninterrupted absence reveals the four-season easter egg (${reducedMotion})`, async ({ page }) => {
        const errors = [];
        page.on("pageerror", error => errors.push(error.message));
        await mockCamera(page);
        await page.clock.install();
        await page.emulateMedia({ reducedMotion });
        await page.goto("./");
        if (reducedMotion === "no-preference") {
            await page.getByRole("button", { name: "EN", exact: true }).click();
        }
        await page.locator("#start-camera").click();
        await holdHandsInFrame(page);
        await page.locator("#presence-demo").evaluate(node => node.scrollIntoView({ behavior: "instant" }));
        await page.evaluate(() => window.demoCamera.frame(true));
        await page.evaluate(() => window.demoCamera.frame(false));
        await page.clock.runFor(700);
        const sky = page.locator("#away-easter-egg");
        const reward = sky.locator("[data-away-reward]");
        await expect(sky).toBeHidden();
        await page.clock.fastForward(29000);
        await expect(sky).toBeHidden();
        await page.clock.runFor(1100);
        await expect(sky).toBeVisible();
        await expect(sky).toHaveAttribute("data-season", "spring");
        await expect(reward).toBeHidden();
        for (const season of ["summer", "autumn", "winter"]) {
            await page.clock.fastForward(15000);
            await page.clock.runFor(100);
            await expect(sky).toHaveAttribute("data-season", season);
            await expect(reward).toBeHidden();
        }
        await page.clock.fastForward(15000);
        await page.clock.runFor(100);
        await expect(reward).toBeVisible();
        await expect(reward.locator("p")).toHaveText(reducedMotion === "reduce" ? "Bien joué !" : "Well played!");
        await expect(reward.locator("svg.away-egg")).toBeVisible();
        expect(await sky.locator("canvas").evaluate(canvas =>
            [...canvas.getContext("2d").getImageData(0, 0, 1, 1).data]))
            .toEqual([0, 0, 0, 255]);
        expect(await sky.locator("canvas").evaluate(canvas => canvas.width > 0 && canvas.height > 0)).toBe(true);
        await test.info().attach("easter-egg", { body: await page.screenshot(), contentType: "image/png" });
        await page.evaluate(() => window.demoCamera.frame(true));
        await expect(sky).toBeHidden();
        await page.clock.runFor(1200);
        await expect(page.locator("#finale")).toBeVisible();
        await expect(page.locator("#away-screen")).toBeHidden();
        expect(errors).toEqual([]);
    });
}

test("a brief return restarts the absence timer and Escape cancels the easter egg", async ({ page }) => {
    await mockCamera(page);
    await page.clock.install();
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("./");
    await page.locator("#start-camera").click();
    await holdHandsInFrame(page);
    await page.locator("#presence-demo").evaluate(node => node.scrollIntoView({ behavior: "instant" }));
    await page.evaluate(() => window.demoCamera.frame(true));
    await page.evaluate(() => window.demoCamera.frame(false));
    await page.clock.runFor(700);
    await page.clock.fastForward(29000);
    await page.evaluate(() => window.demoCamera.frame(true));
    await page.clock.runFor(100);
    await page.evaluate(() => window.demoCamera.frame(false));
    await page.clock.fastForward(29000);
    await expect(page.locator("#away-easter-egg")).toBeHidden();
    await page.clock.runFor(1200);
    await expect(page.locator("#away-easter-egg")).toBeVisible();
    await page.evaluate(() => {
        Object.defineProperty(document, "hidden", { configurable: true, value: true });
        document.dispatchEvent(new Event("visibilitychange"));
    });
    await expect(page.locator("#away-easter-egg")).toBeHidden();
    await page.evaluate(() => {
        Object.defineProperty(document, "hidden", { configurable: true, value: false });
        document.dispatchEvent(new Event("visibilitychange"));
    });
    await page.clock.fastForward(65000);
    await expect(page.locator("#away-easter-egg")).toBeHidden();
    await page.evaluate(() => window.demoCamera.frame(false));
    await page.clock.fastForward(30100);
    await expect(page.locator("#away-easter-egg")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator("#away-screen")).toBeHidden();
    await page.clock.fastForward(65000);
    await expect(page.locator("#away-easter-egg")).toBeHidden();
    expect(await page.evaluate(() => window.demoCamera.stopped)).toBe(true);
});

test("return during the black fade cancels its pending completion", async ({ page }) => {
    await mockCamera(page);
    await page.clock.install();
    await page.goto("./");
    await page.locator("#start-camera").click();
    await holdHandsInFrame(page);
    await page.locator("#presence-demo").evaluate(node => node.scrollIntoView({ behavior: "instant" }));
    await page.evaluate(() => window.demoCamera.frame(true));
    await page.evaluate(() => window.demoCamera.frame(false));
    await page.clock.runFor(700);
    await expect(page.locator("body")).toHaveClass(/is-away/);
    await page.evaluate(() => window.demoCamera.frame(true));
    await page.clock.runFor(1200);
    await expect(page.locator("#page-content")).toBeVisible();
    await expect(page.locator("#away-screen")).toBeHidden();
});
