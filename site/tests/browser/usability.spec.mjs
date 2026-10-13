import { test, expect } from "@playwright/test";
import { mockCamera } from "./support/camera.mjs";

test("reloading returns to the top after scrolling or following a section link", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto("./?lang=fr");
    await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: "instant" }));
    expect(await page.evaluate(() => scrollY)).toBeGreaterThan(0);
    await page.reload();
    expect(await page.evaluate(() => scrollY)).toBe(0);
    await page.locator(".manual-link").click();
    await expect(page.locator("#slideshow-title")).toBeInViewport();
    expect(new URL(page.url()).hash).toBe("#presentation");
    await page.reload();
    expect(await page.evaluate(() => scrollY)).toBe(0);
    expect(new URL(page.url()).hash).toBe("");
    expect(new URL(page.url()).search).toBe("?lang=fr");
    await page.locator(".manual-link").click();
    await expect(page.locator("#slideshow-title")).toBeInViewport();
    // A section URL opened as a new visit still works as a deep link.
    await page.goto("./?lang=en#presence-demo");
    await expect(page.locator("#presence-title")).toBeInViewport();
});

test("visitors can explore every section and reach downloads without a camera", async ({ page }) => {
    let cameraRequested = false;
    await page.route("**/mig/session.mjs", route => { cameraRequested = true; return route.abort(); });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("./");
    await page.locator(".manual-link").click();
    await expect(page.locator("#slideshow-title")).toBeInViewport();
    await page.locator("#next-slide").click();
    await page.locator("#next-slide").click();
    await expect(page.locator("#slide-title")).toHaveText("La grille");
    await page.locator("#skip-presence").click();
    await expect(page.locator("#finale")).toBeVisible();
    await expect(page.locator('#finale [data-link="downloads"]')).toBeVisible();
    await expect(page.locator("#finale-title")).toBeFocused();
    expect(cameraRequested).toBe(false);
});

test("manual trackpad navigation leaves ordinary page scrolling available", async ({ page }) => {
    await page.goto("./");
    await page.locator("#slide").dispatchEvent("wheel", { deltaX: 100, deltaY: 0 });
    await expect(page.locator("#slide-counter")).toHaveText("Slide 2 / 3");
    await expect(page.locator("#navigation-cooldown")).toBeHidden();
    const allowed = await page.locator("body").evaluate(node =>
        node.dispatchEvent(new WheelEvent("wheel", { deltaY: 100, bubbles: true, cancelable: true })));
    expect(allowed).toBe(true);
});

for (const failure of ["Permission denied", "NotReadableError: busy camera", "NotFoundError: no device", "Unexpected model failure"]) {
    test(`camera failure has visible recovery and manual navigation: ${failure}`, async ({ page }) => {
        await mockCamera(page, failure);
        await page.goto("./");
        await page.locator("#start-camera").click();
        await expect(page.locator("#camera-feedback")).toBeVisible();
        await expect(page.locator("#camera-feedback-message")).not.toBeEmpty();
        await expect(page.locator("#start-camera")).toBeEnabled();
        await expect(page.locator("#start-camera")).toBeFocused();
        await expect(page.locator("#welcome")).toHaveAttribute("aria-busy", "false");
        await page.locator("#camera-feedback a").click();
        await page.locator("#next-slide").click();
        await expect(page.locator("#slide-counter")).toHaveText("Slide 2 / 3");
        await page.getByRole("button", { name: "EN", exact: true }).click();
        await expect(page.locator("#camera-feedback-message")).not.toContainText("caméra");
    });
}

for (const cancel of ["#stop-camera", "#camera-feedback a"]) {
test(`cancelling a delayed camera start disposes the late session: ${cancel}`, async ({ page }) => {
    await mockCamera(page);
    await page.goto("./");
    let release;
    const delayed = new Promise(resolve => { release = resolve; });
    await page.route("**/mig/session.mjs", async route => { await delayed; await route.fallback(); });
    await page.locator("#start-camera").click();
    await expect(page.locator("#camera-feedback-message")).toContainText("Chargement");
    await page.locator(cancel).click();
    release();
    await expect(page.locator(".hero h1")).toBeVisible();
    await expect(page.locator(".camera-card")).toBeHidden();
    await expect.poll(() => page.evaluate(() => window.demoCamera?.stopped)).toBe(true);
    await expect(page.locator("#start-camera")).toBeEnabled();
});
}

for (const [width, height] of [[1920, 1080], [1080, 1920]]) {
    test(`real inference handles ${width}x${height} video with bounded resolution`, async ({ page }) => {
        const errors = [];
        page.on("pageerror", error => errors.push(error.message));
        await page.addInitScript(({ width, height }) => {
            const canvas = document.createElement("canvas");
            canvas.width = width; canvas.height = height;
            const context = canvas.getContext("2d");
            context.fillRect(0, 0, width, height);
            window.testVideoTimer = setInterval(() => context.fillRect(0, 0, width, height), 100);
            navigator.mediaDevices.getUserMedia = async () => {
                window.testVideoStream = canvas.captureStream(10);
                return window.testVideoStream;
            };
        }, { width, height });
        await page.emulateMedia({ reducedMotion: "reduce" });
        await page.goto("./");
        await page.locator("#start-camera").click();
        await expect(page.locator("#start-camera")).toBeHidden({ timeout: 30000 });
        await expect.poll(() => page.locator("#camera-video").evaluate(video => video.currentTime)).toBeGreaterThan(.1);
        const bounds = await page.locator(".camera-preview").boundingBox();
        expect(bounds.width / bounds.height).toBeCloseTo(width / height, 1);
        expect(bounds.y).toBeGreaterThanOrEqual(0);
        expect(bounds.y + bounds.height).toBeLessThanOrEqual(page.viewportSize().height);
        // The hidden overlay must stay unallocated while real inference runs.
        expect(await page.locator("#camera-overlay").evaluate(canvas => canvas.width)).toBe(300);
        await page.locator("#stop-camera").click();
        expect(await page.evaluate(() => window.testVideoStream.getTracks().every(track => track.readyState === "ended"))).toBe(true);
        await page.evaluate(() => clearInterval(window.testVideoTimer));
        expect(errors).toEqual([]);
    });
}
