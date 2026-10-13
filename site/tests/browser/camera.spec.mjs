import { test, expect } from "@playwright/test";
import { mockCamera, holdHandsInFrame, swipeHand } from "./support/camera.mjs";

for (const phone of [false, true]) {
    test(`hand outlines stay hidden before camera activation (${phone ? "phone" : "desktop"})`, async ({ browser }) => {
        const page = await browser.newPage({ baseURL: test.info().project.use.baseURL,
            viewport: phone ? { width: 390, height: 844 } : { width: 1280, height: 720 }, hasTouch: phone });
        try {
            await mockCamera(page);
            await page.emulateMedia({ reducedMotion: "reduce" });
            await page.goto("./");
            await expect(page.locator("#start-assisted-hint")).not.toBeEmpty();
            await expect(page.locator(".camera-card")).toBeHidden();
            await page.locator("#start-assisted").click();
            await expect(page.locator("#assistance")).toHaveAttribute("data-step", "privacy");
            await expect(page.locator(".camera-card")).toBeVisible();
            await expect(page.locator(".preview-decoration svg")).toHaveCount(0);
            await expect(page.locator("[data-assistance-target]")).toBeHidden();
            await expect(page.locator(".aim-outline:visible, .aim-pointer:visible")).toHaveCount(0);
            expect(await page.evaluate(() => Boolean(window.demoCamera))).toBe(false);
            await page.locator("[data-assistance-next]").click();
            await expect(page.locator("#assistance")).toHaveAttribute("data-step", "aim");
            await expect(page.locator(".aim-outline:visible")).toHaveCount(phone ? 1 : 2);
        } finally { await page.close(); }
    });
}

test("a denied camera leaves manual navigation usable and allows retry", async ({ page }) => {
    await mockCamera(page, "Permission denied");
    await page.goto("./");
    await page.locator("#start-camera").click();
    await expect(page.locator("#camera-status")).toContainText("refusé");
    await expect(page.locator("#start-camera")).toBeEnabled();
    await expect(page.locator("#away-screen")).toBeHidden();
    await page.locator("#next-slide").click();
    await expect(page.locator("#slide-counter")).toHaveText("Slide 2 / 3");
    await page.evaluate(() => { window.nextCameraFailure = ""; });
    await page.locator("#start-camera").click();
    await expect(page.locator("#stop-camera")).toBeVisible();
    await expect(page.locator("#start-camera")).toBeHidden();
});

test("real MIG session starts with local models, processes video and releases the camera", async ({ page }) => {
    const externalRequests = [];
    const errors = [];
    // Include runtime errors in the CI log; MIG reports failures through state.
    page.on("console", message => {
        if (message.type() === "error" && !message.text().startsWith("INFO:")) {
            console.error(message.text());
        }
    });
    page.on("request", request => {
        if (new URL(request.url()).hostname !== "127.0.0.1") externalRequests.push(request.url());
    });
    page.on("pageerror", error => errors.push(error.message));
    await page.addInitScript(() => {
        // Only camera input is synthetic. The session, models, WASM and UI are real.
        navigator.mediaDevices.getUserMedia = async () => {
            const canvas = document.createElement("canvas");
            canvas.width = 640;
            canvas.height = 480;
            canvas.getContext("2d").fillRect(0, 0, 640, 480);
            // A live stream needs new canvas frames, even for a blank scene.
            window.cameraFrames = setInterval(() => {
                canvas.getContext("2d").fillRect(0, 0, 640, 480);
            }, 50);
            window.cameraStream = canvas.captureStream(20);
            return window.cameraStream;
        };
    });
    await page.goto("./");
    const webglAvailable = await page.evaluate(() => {
        const context = document.createElement("canvas").getContext("webgl2");
        context?.getExtension("WEBGL_lose_context")?.loseContext();
        return Boolean(context);
    });
    expect(webglAvailable, "The real MIG models require WebGL 2 in the test browser").toBe(true);
    await page.locator("#start-camera").click();
    await expect(page.locator("#camera-status")).toContainText("Mettez les deux mains", { timeout: 30000 });
    await expect(page.locator("#stop-camera")).toBeVisible();
    // No person has been detected in the blank video: the page must stay visible.
    await expect(page.locator("#page-content")).toBeVisible();
    await expect.poll(() => page.locator("#camera-video").evaluate(video => video.currentTime)).toBeGreaterThan(0);
    await page.locator("#stop-camera").click();
    expect(await page.evaluate(() => window.cameraStream.getTracks().every(track => track.readyState === "ended"))).toBe(true);
    await page.evaluate(() => clearInterval(window.cameraFrames));
    expect(externalRequests).toEqual([]);
    expect(errors).toEqual([]);
});

test("camera onboarding shows a written cue without unsolicited page scrolling", async ({ page }) => {
    await mockCamera(page);
    await page.clock.install();
    await page.goto("./");
    await page.getByRole("button", { name: "EN", exact: true }).click();
    await page.locator("#start-camera").click();
    await holdHandsInFrame(page);
    const origin = await page.evaluate(() => scrollY);
    await page.clock.runFor(650);
    expect(await page.evaluate(() => scrollY)).toBe(origin);
    await page.clock.runFor(500);
    expect(await page.evaluate(() => scrollY)).toBeCloseTo(origin, 0);
    await page.evaluate(() => window.demoCamera.frame(true));
    await page.clock.runFor(4450);
    expect(await page.evaluate(() => scrollY)).toBe(origin);
    await expect(page.locator('#scroll-gesture-tip [data-text="scrollShort"]')).toBeVisible();
    await page.clock.runFor(650);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await swipeHand(page, "scroll_presentation");
    await expect(page.locator("#scroll-gesture-tip")).toBeHidden();
    await expect(page.locator("#slide-gesture-tip")).toBeVisible();
    const top = await page.evaluate(() => scrollY);
    await page.clock.runFor(6000);
    expect(await page.evaluate(() => scrollY)).toBe(top);
    await swipeHand(page, "next_slide");
    await expect(page.locator("#slide-counter")).toHaveText("Slide 2 / 3");
});

test("reduced motion disables the scroll nudge and camera denial leaves hints hidden", async ({ page }) => {
    await mockCamera(page);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.clock.install();
    await page.goto("./");
    await page.locator("#start-camera").click();
    await expect(page.locator("#start-camera")).toBeHidden();
    await holdHandsInFrame(page);
    const origin = await page.evaluate(() => scrollY);
    await page.clock.runFor(1200);
    expect(await page.evaluate(() => scrollY)).toBe(origin);
    await expect(page.locator("#scroll-gesture-tip")).toContainText("Montez une main");
    expect(await page.locator("#start-camera").evaluate(node => getComputedStyle(node, "::after").animationName)).toBe("none");
    await page.keyboard.press("Escape");
    await page.evaluate(() => { window.nextCameraFailure = "Permission denied"; });
    await page.locator("#start-camera").click();
    await expect(page.locator("#camera-status")).toContainText("refus\u00e9");
    await expect(page.locator("#scroll-gesture-tip")).toBeHidden();
    await expect(page.locator("#slide-gesture-tip")).toBeHidden();
});

test("both hands must remain visible for one second and readiness resets on restart", async ({ page }) => {
    await mockCamera(page);
    await page.clock.install();
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("./");
    await page.getByRole("button", { name: "EN", exact: true }).click();
    await page.locator("#start-camera").click();
    await expect(page.locator("#start-camera")).toBeHidden();
    await page.evaluate(() => window.demoCamera.frame(true));
    await page.clock.runFor(800);
    await page.evaluate(() => window.demoCamera.frame(true));
    await expect(page.locator("#scroll-gesture-tip")).toBeHidden();
    await page.evaluate(() => window.demoCamera.frame(false));
    await page.evaluate(() => window.demoCamera.frame(true));
    await page.clock.runFor(800);
    await page.evaluate(() => window.demoCamera.frame(true));
    await expect(page.locator("#scroll-gesture-tip")).toBeHidden();
    await page.clock.runFor(200);
    await page.evaluate(() => window.demoCamera.frame(true));
    await expect(page.locator("#scroll-gesture-tip")).toBeVisible();
    await page.keyboard.press("Escape");
    await page.locator("#start-camera").click();
    await expect(page.locator("#start-camera")).toBeHidden();
    await expect(page.locator("#scroll-gesture-tip")).toBeHidden();
    await holdHandsInFrame(page);
    await expect(page.locator("#scroll-gesture-tip")).toBeVisible();
});

test("phone visitors get one-hand guidance and can finish and stop the demo", async ({ browser }) => {
    const page = await browser.newPage({ baseURL: test.info().project.use.baseURL, viewport: { width: 390, height: 844 }, hasTouch: true, locale: "en-US" });
    try {
        await mockCamera(page);
        await page.clock.install();
        await page.emulateMedia({ reducedMotion: "reduce" });
        await page.goto("./");
        await page.getByRole("button", { name: "EN", exact: true }).click();
        await expect(page.locator("#phone-note")).toContainText("more enjoyable on a computer");
        await page.locator("#start-camera").click();
        await expect(page.locator("#start-camera")).toBeHidden();
        await page.evaluate(() => {
            window.demoCamera.coordinate = index => window.demoCamera.detected && (index === 15 || [11, 12].includes(index))
                ? { x: .5, y: .5, confidence: .9 } : null;
        });
        await holdHandsInFrame(page);
        await expect(page.locator("#camera-placement")).toContainText("Place one hand");
        await expect(page.locator(".preview-decoration svg")).toHaveCount(0);
        await expect(page.locator(".hand-up-right")).toBeHidden();
        await page.locator("#presence-demo").evaluate(node => node.scrollIntoView({ behavior: "instant" }));
        await page.evaluate(() => window.demoCamera.frame(true));
        await page.evaluate(() => window.demoCamera.frame(false));
        await page.clock.runFor(650);
        await page.evaluate(() => window.demoCamera.frame(false));
        await page.evaluate(() => window.demoCamera.frame(true));
        await page.clock.runFor(300);
        await page.evaluate(() => window.demoCamera.frame(true));
        await expect(page.locator("#finale")).toBeVisible();
        await expect(page.locator("#finale-stop-camera")).toBeEnabled();
        expect(await page.evaluate(() => window.demoCamera.state.running)).toBe(true);
        await page.locator("#finale-stop-camera").click();
        expect(await page.evaluate(() => window.demoCamera.stopped)).toBe(true);
        await expect(page.locator("#hands-tip")).toBeHidden();
    } finally { await page.close(); }
});

test("loading bar fills continuously and unlocks hand navigation after two seconds", async ({ page }) => {
    await mockCamera(page);
    await page.clock.install();
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("./");
    await page.getByRole("button", { name: "EN", exact: true }).click();
    await page.clock.pauseAt(new Date(await page.evaluate(() => Date.now() + 1000)));
    await page.locator("#start-camera").click();
    await holdHandsInFrame(page);
    await expect(page.locator("#camera-status")).toHaveText("Put both hands in the central frame to begin the quick demo!");
    await swipeHand(page, "scroll_presentation");
    const bar = page.locator("#navigation-cooldown");
    const fill = bar.locator("[data-cooldown-progress]");
    await expect(bar).toBeVisible();
    await expect(bar).toHaveAttribute("role", "progressbar");
    await expect(bar).toHaveCSS("height", "3px");
    await page.clock.runFor(1000);
    const filled = await fill.boundingBox();
    expect(filled.width / page.viewportSize().width).toBeCloseTo(.5, 1);
    await expect(bar).toHaveAttribute("aria-valuenow", /^(49|50|51)$/);
    await page.setViewportSize({ width: 390, height: 844 });
    expect((await fill.boundingBox()).width).toBeCloseTo(195, -1);
    await page.clock.runFor(1000);
    await expect(bar).toBeHidden();
});

test("camera edge guidance mirrors the image, marks all four limits and validates both hands", async ({ page }) => {
    await mockCamera(page);
    await page.clock.install();
    await page.goto("./");
    await page.getByRole("button", { name: "EN", exact: true }).click();
    await page.locator("#start-camera").click();
    await expect(page.locator("#start-camera")).toBeHidden();
    for (const [x, y, edges] of [[.1, .1, ["top", "right"]], [.9, .9, ["bottom", "left"]], [.5, .5, []]]) {
        await page.evaluate(({ x, y }) => {
            const camera = window.demoCamera;
            camera.coordinate = index => index === 15 ? { x, y } : [11, 12, 16].includes(index) ? { x: .5, y: .5 } : null;
            camera.frame(true);
        }, { x, y });
        await page.clock.runFor(550);
        await page.evaluate(() => window.demoCamera.frame(true));
        for (const edge of ["top", "bottom", "left", "right"]) {
            const overlay = page.locator(`[data-camera-edge="${edge}"]`);
            if (edges.includes(edge)) await expect(overlay).toBeVisible();
            else await expect(overlay).toBeHidden();
        }
    }
    await expect(page.locator(".camera-preview")).toHaveClass(/framing-confirmed/);
    await page.clock.runFor(1000);
    await expect(page.locator(".camera-preview")).toHaveClass(/framing-confirmed/);
    await page.locator("#stop-camera").click();
});

test("camera guidance stays inside the preview and boundary jitter does not flash the edges", async ({ page }) => {
    await mockCamera(page);
    await page.clock.install();
    await page.goto("./");
    await page.getByRole("button", { name: "EN", exact: true }).click();
    await page.locator("#start-camera").click();
    await expect(page.locator(".camera-preview > p")).toHaveCount(1);
    await expect(page.locator(".camera-preview #camera-status")).toHaveCount(1);
    await expect.poll(() => page.evaluate(() => Boolean(window.demoCamera?.state.running))).toBe(true);
    const edge = page.locator('[data-camera-edge="top"]');
    for (const y of [.14, .16, .14, .18, .19]) {
        await page.evaluate(y => {
            window.demoCamera.coordinate = index => index === 15 ? { x: .5, y }
                : index === 16 ? { x: .5, y: .5 } : null;
            window.demoCamera.frame(true);
        }, y);
        await page.clock.runFor(200);
        await page.evaluate(() => window.demoCamera.frame(true));
        await expect(edge).toBeVisible();
    }
    await page.evaluate(() => {
        window.demoCamera.coordinate = index => index === 15 ? { x: .5, y: .21 }
            : index === 16 ? { x: .5, y: .5 } : null;
        window.demoCamera.frame(true);
    });
    await page.clock.runFor(550);
    await page.evaluate(() => window.demoCamera.frame(true));
    await expect(edge).toBeHidden();
});

test("C loads diagnostics on demand, switches overlays and stops sampling when closed", async ({ page }) => {
    await mockCamera(page);
    await page.clock.install();
    const modules = [];
    page.on("request", request => {
        if (/debug-(panel|overlay)\.mjs/.test(request.url())) modules.push(request.url());
    });
    await page.goto("./");
    await page.locator("#start-camera").click();
    expect(modules).toEqual([]);
    await page.keyboard.press("c");
    const debug = page.locator("#camera-debug");
    await expect(debug).toBeVisible();
    expect(modules.length).toBe(2);
    await page.evaluate(() => {
        const camera = window.demoCamera;
        camera.reads = [];
        camera.coordinate = index => { camera.reads.push(index); return { x: .5, y: .5, confidence: .9 }; };
    });
    await page.clock.runFor(150);
    await page.evaluate(() => window.demoCamera.frame(true));
    expect(await page.evaluate(() => window.demoCamera.reads.includes(32))).toBe(true);
    await debug.locator('input[value="points"]').uncheck();
    for (const layer of ["hands", "centre", "edges", "thresholds"]) {
        await debug.locator(`input[value="${layer}"]`).uncheck();
    }
    await expect(debug.locator("input:checked")).toHaveCount(0);
    await page.clock.runFor(150);
    await page.evaluate(() => { window.demoCamera.reads = []; window.demoCamera.frame(true); });
    expect(await page.evaluate(() => window.demoCamera.reads.includes(32))).toBe(false);
    for (const action of ["a", "b", "c", "d"]) {
        await page.evaluate(action => window.demoCamera.action(action), action);
    }
    await expect(debug.locator("ol li")).toHaveCount(3);
    await test.info().attach("camera-debug", { body: await debug.screenshot(), contentType: "image/png" });
    await debug.locator("button").click();
    await expect(debug).toBeHidden();
    expect(await debug.locator("canvas").evaluate(canvas => canvas.width)).toBe(0);
    await page.clock.runFor(150);
    await page.evaluate(() => { window.demoCamera.reads = []; window.demoCamera.frame(true); });
    expect(await page.evaluate(() => window.demoCamera.reads.includes(32))).toBe(false);
    await page.keyboard.press("c");
    await expect(debug).toBeVisible();
    await page.keyboard.press("c");
    await expect(debug).toBeHidden();
});
