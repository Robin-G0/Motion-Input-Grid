import { test, expect } from "@playwright/test";

// Feed simulated camera observations at the MIG boundary; never add a test mode
// or fake actions to the deployed page itself.
async function mockCamera(page, failure = "") {
    await page.route("**/mig/session.mjs", route => route.fulfill({
        contentType: "text/javascript",
        body: `
            export class MIGSession {
                constructor(options) {
                    this.options = options;
                    this.state = { running: false, busy: false, status: "Ready" };
                    this.detected = true;
                    window.demoCamera = this;
                }
                async importJSON(json) { this.profile = JSON.parse(json); }
                async start() {
                    const failure = window.nextCameraFailure ?? ${JSON.stringify(failure)};
                    this.state.running = !failure;
                    this.state.status = failure;
                }
                subscribe(listener) { listener(this.state); return () => {}; }
                coordinate(index) {
                    return this.detected ? { x: index === 15 ? .65 : index === 16 ? .35 : .5, y: .5, z: 0 } : null;
                }
                dispose() { this.state.running = false; this.stopped = true; }
                frame(detected) { this.detected = detected; this.options.onFrame(this); }
                action(action) { this.options.onAction({ action, id: action }); }
            }
        `
    }));
}

async function holdHandsInFrame(page) {
    await expect(page.locator("#start-camera")).toBeHidden();
    await page.clock.pauseAt(new Date(await page.evaluate(() => Date.now() + 1000)));
    await page.evaluate(() => window.demoCamera.frame(true));
    for (let index = 0; index < 5; index++) {
        await page.clock.runFor(200);
        await page.evaluate(() => window.demoCamera.frame(true));
    }
}


// CSS/Web Animations have a separate timeline from Playwright's simulated timers.
async function finishRibbonAnimation(page) {
    await page.evaluate(() => {
        for (const animation of document.querySelector(".carousel-track").getAnimations({ subtree: true })) {
            if (Number.isFinite(animation.effect.getComputedTiming().endTime)) animation.finish();
        }
    });
}

async function swipeHand(page, action, landmark = 15, wait = true) {
    if (wait) {
        await finishRibbonAnimation(page);
        await page.clock.runFor(3000);
    }
    const horizontal = action === "next_slide" || action === "previous_slide";
    const sign = ["next_slide", "scroll_previous"].includes(action) ? 1 : -1;
    await page.evaluate(landmark => {
        const camera = window.demoCamera;
        camera.wrist = { x: .5, y: .5 };
        camera.coordinate = index => camera.detected && (index === landmark || index === 11 || index === 12 || index === 15 || index === 16)
            ? (index === landmark ? camera.wrist : { x: .5, y: .5 }) : null;
        camera.frame(true);
    }, landmark);
    await page.clock.runFor(200);
    await page.evaluate(() => window.demoCamera.frame(true));
    for (const progress of [.5, 1]) {
        await page.clock.runFor(150);
        await page.evaluate(({ horizontal, sign, progress }) => {
            window.demoCamera.wrist = horizontal
                ? { x: .5 + sign * .1 * progress, y: .5 }
                : { x: .5, y: .5 + sign * .24 * progress };
            window.demoCamera.frame(true);
        }, { horizontal, sign, progress });
    }
}

async function focusPresentation(page) {
    await page.locator("#presentation h2").evaluate(node => window.scrollTo({ top: scrollY + node.getBoundingClientRect().top - 16, behavior: "instant" }));
}

test("bilingual page, footer and controls work under the repository subpath", async ({ page }) => {
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.addInitScript(() => {
        const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
        window.cameraRequests = 0;
        navigator.mediaDevices.getUserMedia = (...args) => { ++window.cameraRequests; return original(...args); };
    });
    await page.goto("./");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Alors, on teste ça ?");
    await expect(page.locator("#slide-counter")).toHaveText("Slide 1 / 3");
    await expect(page.locator("#finale")).toBeHidden();
    await expect(page.locator("#away-screen")).toBeHidden();
    await page.getByRole("button", { name: "Slide suivante" }).click();
    await expect(page.locator("#slide-counter")).toHaveText("Slide 2 / 3");
    await page.locator("#slide").focus();
    await page.keyboard.press("ArrowLeft");
    await expect(page.locator("#slide-counter")).toHaveText("Slide 1 / 3");
    await page.getByRole("button", { name: "EN", exact: true }).click();
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Ready to give it a go?");
    await expect(page.locator("footer a[data-link=linkedin]")).toHaveAttribute("href", "https://www.linkedin.com/in/robin-g0/");
    await expect(page.locator("footer a[data-link=downloads]")).toHaveAttribute("href", /Motion-Input-Grid\/releases\/latest$/);
    expect(await page.evaluate(() => window.cameraRequests)).toBe(0);
    expect(errors).toEqual([]);
});

test("system language takes priority over links and visitors can change it with the buttons", async ({ browser }) => {
    for (const language of ["fr", "en"]) {
        const page = await browser.newPage({
            baseURL: test.info().project.use.baseURL,
            locale: language === "fr" ? "fr-FR" : "en-US"
        });
        try {
            const otherLanguage = language === "fr" ? "en" : "fr";
            await page.goto(`./?lang=${otherLanguage}`);
            await expect(page.locator("html")).toHaveAttribute("lang", language);
            const title = language === "fr" ? "Alors, on teste \u00e7a ?" : "Ready to give it a go?";
            await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
            await page.getByRole("button", { name: otherLanguage.toUpperCase(), exact: true }).click();
            await expect(page.locator("html")).toHaveAttribute("lang", otherLanguage);
            await page.reload();
            await expect(page.locator("html")).toHaveAttribute("lang", language);
            await page.goto("./?lang=unknown");
            await expect(page.locator("html")).toHaveAttribute("lang", language);
        } finally {
            await page.close();
        }
    }
});

test("gestures advance and reverse the presentation; departure and return reveal the finale", async ({ page }) => {
    await mockCamera(page);
    await page.clock.install();
    await page.goto("./");
    await page.locator("#start-camera").click();
    await expect(page.locator("#stop-camera")).toBeVisible();
    await holdHandsInFrame(page);
    await focusPresentation(page);
    await swipeHand(page, "next_slide");
    await expect(page.locator("#slide-counter")).toHaveText("Slide 2 / 3");
    await page.clock.runFor(900);
    await swipeHand(page, "previous_slide");
    await expect(page.locator("#slide-counter")).toHaveText("Slide \u{1f381} / 3");
    // The departure demo is only available in the final section.
    await page.locator("#presence-demo").evaluate(node => node.scrollIntoView({ behavior: "instant", block: "start" }));
    await page.evaluate(() => window.demoCamera.frame(true));
    // A sustained loss of tracking, not just one missing frame, hides everything.
    for (let index = 0; index < 17; ++index) {
        await page.evaluate(() => window.demoCamera.frame(false));
        await page.clock.runFor(100);
    }
    await expect(page.locator("#page-content")).toBeHidden();
    await expect(page.locator("#away-screen")).toBeVisible();
    await expect(page.locator("body")).toHaveCSS("background-color", "rgb(0, 0, 0)");
    for (let index = 0; index < 7; ++index) {
        await page.evaluate(() => window.demoCamera.frame(true));
        await page.clock.runFor(100);
    }
    await page.clock.runFor(700);
    await expect(page.locator("#away-screen")).toBeHidden();
    await expect(page.locator("#finale")).toBeVisible();
    await expect(page.locator("#finale-title")).toBeFocused();
    const finale = await page.locator("#finale").boundingBox();
    expect(finale.y).toBeGreaterThanOrEqual(0);
    expect(finale.y + finale.height).toBeLessThanOrEqual(await page.evaluate(() => innerHeight));
    await expect(page.locator('[data-text="finaleStar"]')).toHaveText("Si le projet vous a plu, n’hésitez pas à lui laisser une ⭐ sur GitHub !");
    await page.getByRole("button", { name: "EN", exact: true }).click();
    await expect(page).toHaveTitle("Motion Input Grid : your move");
    await expect(page.locator('[data-text="finaleStar"]')).toHaveText("If you enjoyed the project, feel free to leave a ⭐ on GitHub!");
    await page.getByRole("button", { name: "FR", exact: true }).click();
    await expect(page).toHaveTitle("Motion Input Grid : \u00e0 vous de jouer");
    await expect(page.locator('[data-text="finaleStar"]')).toHaveText("Si le projet vous a plu, n’hésitez pas à lui laisser une ⭐ sur GitHub !");
    expect(await page.evaluate(() => window.demoCamera.state.running)).toBe(true);
    await expect(page.locator("#hands-tip")).toBeHidden();
    await expect(page.locator("#departure-tip")).toBeHidden();
    await expect(page.locator("#finale-stop-camera")).toBeVisible();
    await page.locator("#finale-stop-camera").click();
    await page.locator("#start-camera").click();
    await expect(page.locator("#start-camera")).toBeHidden();
    // Language controls scroll back to the header; return to the final section.
    await page.locator("#presence-demo").evaluate(node => node.scrollIntoView({ behavior: "instant", block: "start" }));
    await page.evaluate(() => window.demoCamera.frame(true));
    // Escape must also recover the page while the black screen is active.
    for (let index = 0; index < 17; ++index) {
        await page.evaluate(() => window.demoCamera.frame(false));
        await page.clock.runFor(100);
    }
    await expect(page.locator("#away-screen")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator("#away-screen")).toBeHidden();
    await expect(page.locator("#page-content")).toBeVisible();
    await expect(page.locator("#start-camera")).toBeVisible();
    expect(await page.evaluate(() => window.demoCamera.stopped)).toBe(true);
});

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

test("small screens remain readable and touch navigation works", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("./");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.locator("#slide").dispatchEvent("pointerdown", { pointerType: "touch", pointerId: 1, clientX: 250 });
    await page.locator("#slide").dispatchEvent("pointerup", { pointerType: "touch", pointerId: 1, clientX: 80 });
    await expect(page.locator("#slide-counter")).toHaveText("Slide 2 / 3");
    await expect(page.locator("footer a[data-link=github]")).toHaveAttribute("href", "https://github.com/Robin-G0");
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

test("history diagrams move and the grid explains order, cancellation and conditional actions", async ({ page }) => {
    await page.clock.install();
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("./");
    await page.getByRole("button", { name: "EN", exact: true }).click();
    const illustration = page.locator("#history-illustration");
    const slider = illustration.locator("input[type=range]");
    await expect(page.locator("#slide-title")).toHaveText("Positions");
    await expect(illustration.locator("[data-history-play]")).toHaveAttribute("aria-pressed", "false");
    const coordinates = illustration.locator(".coordinate-label");
    await expect(coordinates.first()).toHaveText(/x: \d\.\d{3}.*y: \d\.\d{3}/);
    const before = await coordinates.allTextContents();
    await slider.focus();
    await slider.press("ArrowRight");
    expect(await coordinates.allTextContents()).not.toEqual(before);
    await expect(page.locator("#slide-counter")).toHaveText("Slide 1 / 3");
    await page.locator("#next-slide").click();
    await expect(illustration.locator("polygon")).toBeVisible();
    const angleLabels = await illustration.locator(".angle-label").allTextContents();
    expect(angleLabels.every(label => label.endsWith("\u00b0"))).toBe(true);
    const angles = angleLabels.map(parseFloat);
    expect(angles).toHaveLength(3);
    expect(angles.reduce((sum, value) => sum + value, 0)).toBeCloseTo(180, 0);
    await expect(illustration.locator(".point-label")).toHaveText(["Head", "Left shoulder", "Right shoulder"]);
    const beforeAngles = await illustration.locator(".angle-label").allTextContents();
    await slider.focus();
    await slider.press("ArrowRight");
    expect(await illustration.locator(".angle-label").allTextContents()).not.toEqual(beforeAngles);
    await page.locator("#next-slide").click();
    const status = illustration.locator("[data-history-status]");
    const cell = name => illustration.locator(`[data-cell=${name}]`);
    await expect(illustration.locator("[data-history-grid]")).toBeVisible();
    await cell("second").click();
    await expect(status).toHaveAttribute("data-result", "gridOrder");
    await cell("first").click();
    await cell("second").click();
    await cell("cancel").click();
    await expect(status).toHaveAttribute("data-result", "gridCancelled");
    await cell("trigger").click();
    await expect(status).toHaveAttribute("data-result", "gridOrder");
    await cell("first").click();
    await cell("second").click();
    await cell("trigger").click();
    await expect(status).toHaveAttribute("data-result", "gridTriggered");
    await cell("first").click();
    await cell("second").click();
    await cell("condition").click();
    await expect(status).toHaveAttribute("data-result", "gridCondition");
    await cell("condition").click();
    await expect(status).toHaveAttribute("data-result", "gridCondition");
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await cell("first").click();
    await expect(status).toHaveAttribute("data-result", "gridFirst");
    // Explicit playback is available even when automatic motion is disabled.
    const play = illustration.locator("[data-history-play]");
    await play.focus();
    await play.press("Enter");
    await page.clock.runFor(3300);
    await expect(status).toHaveAttribute("data-result", "gridTriggered");
    await play.focus();
    await play.press("Enter");
    await page.clock.runFor(1000);
    await expect(status).toHaveAttribute("data-result", "gridTriggered");
});

test("edge repositioning is ignored and centred gestures still navigate with either hand", async ({ page }) => {
    await mockCamera(page);
    await page.clock.install();
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("./");
    await page.locator("#start-camera").click();
    await holdHandsInFrame(page);
    for (const landmark of [15, 16]) {
        await page.clock.runFor(3000);
        for (const y of [.85, .5, .15]) {
            await page.evaluate(({ landmark, y }) => {
                const camera = window.demoCamera;
                camera.coordinate = index => index === landmark ? { x: .01, y }
                    : index === 11 || index === 12 ? { x: .5, y: .5 } : null;
                camera.frame(true);
                camera.action("scroll_presentation");
            }, { landmark, y });
            await page.clock.runFor(150);
        }
        expect(await page.evaluate(() => scrollY)).toBe(0);
        await swipeHand(page, "scroll_presentation", landmark);
        await expect(page.locator("#presentation h2")).toBeInViewport();
        await swipeHand(page, "scroll_previous", landmark);
        expect(await page.evaluate(() => scrollY)).toBe(0);
    }

});

test("oscillating finger estimates cannot navigate when their wrist is absent or unreliable", async ({ page }) => {
    await mockCamera(page);
    await page.clock.install();
    await page.goto("./");
    await page.locator("#start-camera").click();
    await holdHandsInFrame(page);
    await focusPresentation(page);
    for (const anchor of [null, { x: -.1, y: .5, confidence: .9 },
        { x: .5, y: .5, confidence: .2 }]) {
        for (let frame = 0; frame < 20; frame++) {
            await page.clock.runFor(100);
            await page.evaluate(({ anchor, frame }) => {
                const point = { x: .5 + Math.sin(frame) * .25,
                    y: .5 + Math.cos(frame) * .25, confidence: .95 };
                window.demoCamera.coordinate = index => index === 15 ? anchor
                    : [17, 19, 21].includes(index) ? point
                        : index === 11 || index === 12 ? { x: .5, y: .5, confidence: .9 } : null;
                window.demoCamera.frame(true);
                window.demoCamera.options.onAction({ action: "next_slide", id: "next_slide_left_wrist" });
            }, { anchor, frame });
        }
        await expect(page.locator("#slide-counter")).toHaveText("Slide 1 / 3");
        await expect(page.locator("#presentation h2")).toBeInViewport();
    }
});

test("a moving wrist outside the central frame cannot start navigation", async ({ page }) => {
    await mockCamera(page);
    await page.clock.install();
    await page.goto("./");
    await page.locator("#start-camera").click();
    await holdHandsInFrame(page);
    await focusPresentation(page);
    await page.evaluate(() => {
        window.demoCamera.wrist = { x: .04, y: .5 };
        window.demoCamera.coordinate = index => index === 15 ? window.demoCamera.wrist
            : [11, 12, 16].includes(index) ? { x: .5, y: .5 } : null;
        window.demoCamera.frame(true);
    });
    for (const [x, y] of [[.06, .48], [.08, .52], [.1, .5]]) {
        await page.clock.runFor(50);
        await page.evaluate(({ x, y }) => {
            window.demoCamera.wrist = { x, y };
            window.demoCamera.frame(true);
        }, { x, y });
    }
    for (const x of [.15, .2]) {
        await page.clock.runFor(150);
        await page.evaluate(x => {
            window.demoCamera.wrist = { x, y: .5 };
            window.demoCamera.frame(true);
        }, x);
    }
    await expect(page.locator("#slide-counter")).toHaveText("Slide 1 / 3");
    await swipeHand(page, "next_slide");
    await expect(page.locator("#slide-counter")).toHaveText("Slide 2 / 3");
});

test("central starts can finish outside the central frame through sweeps and native events", async ({ page }) => {
    await mockCamera(page);
    await page.clock.install();
    await page.goto("./");
    await expect(page.locator("#start-assisted-hint")).toHaveText("Recommandé pour une première visite");
    await page.locator("#start-camera").click();
    await holdHandsInFrame(page);
    await focusPresentation(page);
    for (const native of [false, true]) {
        await finishRibbonAnimation(page);
        await page.clock.runFor(3000);
        await page.evaluate(() => {
            const camera = window.demoCamera;
            camera.wrist = { x: .7, y: .5, confidence: .9 };
            camera.coordinate = index => index === 15 ? camera.wrist : { x: .5, y: .5, confidence: .9 };
            camera.frame(true);
        });
        await page.clock.runFor(200);
        await page.evaluate(() => window.demoCamera.frame(true));
        await page.clock.runFor(150);
        await page.evaluate(native => {
            window.demoCamera.wrist.x = .81;
            if (native) window.demoCamera.options.onAction({ action: "next_slide", id: "next_slide_left_wrist" });
            else window.demoCamera.frame(true);
        }, native);
        await expect(page.locator("#slide-counter")).toHaveText(native ? "Slide 3 / 3" : "Slide 2 / 3");
    }
});

test("an unreliable second wrist blocks sweeps and native events and clears progress", async ({ page }) => {
    await mockCamera(page);
    await page.clock.install();
    await page.goto("./");
    await page.locator("#start-camera").click();
    await holdHandsInFrame(page);
    await focusPresentation(page);
    await page.clock.runFor(3000);
    for (const point of [null, { x: .5, y: .5, confidence: .79 }]) {
        await page.evaluate(() => {
            const camera = window.demoCamera;
            camera.left = { x: .5, y: .5, confidence: .9 };
            camera.right = { x: .5, y: .5, confidence: .9 };
            camera.coordinate = index => index === 15 ? camera.left : camera.right;
            camera.frame(true);
        });
        await page.clock.runFor(200);
        await page.evaluate(() => window.demoCamera.frame(true));
        await page.clock.runFor(150);
        await page.evaluate(point => {
            const camera = window.demoCamera;
            camera.right = point;
            camera.left.x = .62;
            camera.frame(true);
            camera.options.onAction({ action: "next_slide", id: "next_slide_left_wrist" });
        }, point);
        await expect(page.locator("#slide-counter")).toHaveText("Slide 1 / 3");
        await page.evaluate(() => {
            const camera = window.demoCamera;
            camera.right = { x: .5, y: .5, confidence: .9 };
            camera.frame(true);
            camera.options.onAction({ action: "next_slide", id: "next_slide_left_wrist" });
        });
        await expect(page.locator("#slide-counter")).toHaveText("Slide 1 / 3");
    }
    await swipeHand(page, "next_slide");
    await expect(page.locator("#slide-counter")).toHaveText("Slide 2 / 3");
});

test("camera onboarding repeats its nudge while a hand is visible and stops after navigation", async ({ page }) => {
    await mockCamera(page);
    await page.clock.install();
    await page.goto("./");
    await page.getByRole("button", { name: "EN", exact: true }).click();
    await page.locator("#start-camera").click();
    await holdHandsInFrame(page);
    const origin = await page.evaluate(() => scrollY);
    await page.clock.runFor(650);
    expect(await page.evaluate(() => scrollY)).toBeGreaterThan(origin);
    await page.clock.runFor(500);
    expect(await page.evaluate(() => scrollY)).toBeCloseTo(origin, 0);
    await page.evaluate(() => window.demoCamera.frame(true));
    await page.clock.runFor(4450);
    expect(await page.evaluate(() => scrollY)).toBeGreaterThan(origin);
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

test("gift contents stay hidden until entering; leaving removes the temporary slide", async ({ page }) => {
    await mockCamera(page);
    await page.clock.install();
    await page.goto("./");
    await expect(page.locator("#slide-title")).toHaveText("Les positions");
    await page.locator("#start-camera").click();
    await expect(page.locator("#start-camera")).toBeHidden();
    await holdHandsInFrame(page);
    await focusPresentation(page);
    await swipeHand(page, "next_slide");
    await expect(page.locator('.slide-neighbour[data-position="left"]')).toHaveAttribute("data-wrapped", "true");
    await expect(page.locator('.slide-neighbour[data-position="left"] .slide-copy')).toHaveText("");
    await expect(page.locator(".carousel-track")).not.toContainText("Alors, chouette non ?");
    await page.clock.runFor(900);
    await swipeHand(page, "previous_slide");
    await expect(page.locator("#slide-title")).toHaveText("Alors, chouette non ?");
    await expect(page.locator("#slide-description")).toContainText("easter egg");
    await expect(page.locator("#history-illustration")).toBeHidden();
    await expect(page.locator("#slide")).toHaveCSS("animation-name", "prism-colours");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect(page.locator("#slide")).toHaveCSS("animation-name", "none");
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.getByRole("button", { name: "EN", exact: true }).click();
    await expect(page.locator("#slide-title")).toHaveText("Pretty neat, right?");
    await finishRibbonAnimation(page);
    await page.clock.runFor(3000);
    for (const theme of ["light", "dark"]) {
        await page.evaluate(theme => document.documentElement.dataset.theme = theme, theme);
        const colors = await page.locator("#slide").evaluate(node => ({
            background: getComputedStyle(node).backgroundImage,
            ink: getComputedStyle(node).color
        }));
        expect(colors.background).toContain("rgb(255, 129, 164)");
        expect(colors.background).toContain("rgb(131, 202, 250)");
        expect(colors.ink).toBe("rgb(25, 35, 50)");
    }
    await page.locator("#slide").dispatchEvent("wheel", { deltaX: 0, deltaY: 150 });
    await expect(page.locator("#slide-counter")).toHaveText("Slide \u{1f381} / 3");
    await page.locator("#slide").dispatchEvent("wheel", { deltaX: 100, deltaY: 0 });
    await expect(page.locator("#slide-counter")).toHaveText("Slide 2 / 3");
    await expect(page.locator("#slide-title")).toHaveText("Angles");
    await expect(page.locator("#history-illustration")).toBeVisible();
    await page.locator("#slide").dispatchEvent("wheel", { deltaX: 100, deltaY: 0 });
    await expect(page.locator("#slide-counter")).toHaveText("Slide 2 / 3");
    await finishRibbonAnimation(page);
    await page.clock.runFor(3000);
    await page.locator("#slide").dispatchEvent("wheel", { deltaX: -100, deltaY: 0 });
    await expect(page.locator("#slide-title")).toHaveText("Positions");
});

test("the evolving grid presents detection, cancellation, then a one-second thumb condition", async ({ page }) => {
    await page.clock.install();
    await page.goto("./");
    await page.getByRole("button", { name: "EN", exact: true }).click();
    await page.locator("#next-slide").click();
    await page.locator("#next-slide").click();
    await finishRibbonAnimation(page);
    const grid = page.locator("#slide [data-history-grid]");
    const cell = name => grid.locator(`[data-cell=${name}]`);
    const outcome = page.locator("#slide [data-history-outcome]");
    await expect(cell("cancel")).toBeHidden();
    await expect(cell("condition")).toBeHidden();
    await expect(grid.locator("button:visible")).toHaveCount(3);
    await expect(cell("trigger")).toHaveText("3");
    await page.clock.runFor(1200);
    await expect(cell("first")).toHaveClass(/is-active/);
    await page.clock.runFor(1000);
    await expect(cell("second")).toHaveClass(/is-active/);
    await page.clock.runFor(1000);
    await expect(cell("trigger")).toHaveClass(/is-active/);
    await expect(outcome).toHaveText("Input detected");
    await page.clock.runFor(3000);
    await expect(cell("cancel")).toBeVisible();
    await expect(outcome).toBeEmpty();
    await page.clock.runFor(1000);
    await expect(cell("first")).toHaveClass(/is-active/);
    await page.clock.runFor(1000);
    await expect(cell("second")).toHaveClass(/is-active/);
    await page.clock.runFor(1000);
    await expect(cell("cancel")).toHaveClass(/is-active/);
    await expect(outcome).toHaveText("Input cancelled");
    await page.clock.runFor(3000);
    await expect(cell("cancel")).toBeHidden();
    await expect(cell("trigger")).toBeHidden();
    await expect(cell("condition")).toHaveText("3");
    await expect(cell("first")).not.toHaveClass(/is-complete/);
    await page.clock.runFor(1000);
    await expect(cell("condition")).toHaveText("3");
    await page.clock.runFor(1000);
    await expect(cell("first")).toHaveClass(/is-active/);
    await page.clock.runFor(1000);
    await expect(cell("second")).toHaveClass(/is-active/);
    await page.clock.runFor(1000);
    await expect(cell("condition")).toHaveText("\u{1f44d}");
    await expect(cell("first")).toHaveClass(/is-complete/);
    await expect(cell("second")).toHaveClass(/is-complete/);
    const square = await cell("condition").boundingBox();
    const thumb = await cell("condition").locator("span").boundingBox();
    expect(thumb.x + thumb.width / 2).toBeCloseTo(square.x + square.width / 2, 0);
    expect(thumb.y + thumb.height / 2).toBeCloseTo(square.y + square.height / 2, 0);
    expect(thumb.width).toBeLessThan(square.width);
    expect(thumb.height).toBeLessThan(square.height);
    await expect(outcome).toBeEmpty();
    await page.clock.runFor(1000);
    await expect(cell("condition")).toHaveClass(/is-active/);
    await expect(outcome).toHaveText("Input detected");
    await page.clock.runFor(3000);
    await expect(cell("cancel")).toBeHidden();
    await expect(cell("condition")).toBeHidden();
    await expect(outcome).toBeEmpty();
    await expect(page.locator(".prismatic-text")).toHaveText("Movement becomes an interface.");
    await page.getByRole("button", { name: "FR", exact: true }).click();
    await page.clock.runFor(3300);
    await expect(outcome).toHaveText("Entr\u00e9e d\u00e9tect\u00e9e");
});

for (const viewport of [{ width: 844, height: 390 }, { width: 1440, height: 1080 }, { width: 1280, height: 720 }, { width: 390, height: 844 }, { width: 390, height: 700 }]) {
    test(`hand scrolling frames the title and equally sized animations at ${viewport.width}x${viewport.height}`, async ({ page }) => {
        await page.setViewportSize(viewport);
        await page.emulateMedia({ reducedMotion: "reduce" });
        await mockCamera(page);
        await page.clock.install();
        await page.goto("./");
        await page.getByRole("button", { name: "EN", exact: true }).click();
        await page.locator("#start-camera").click();
        await expect(page.locator("#start-camera")).toBeHidden();
        const camera = await page.locator(".camera-preview").boundingBox();
        expect(camera.y).toBeGreaterThanOrEqual(0);
        expect(camera.y + camera.height).toBeLessThanOrEqual(viewport.height);
        await holdHandsInFrame(page);
        await swipeHand(page, "scroll_presentation");
        const slide = page.locator("#slide");
        const original = await slide.boundingBox();
        for (let index = 0; index < 3; index++) {
            const title = await page.locator("#slideshow-title").boundingBox();
            const frame = await slide.boundingBox();
            expect(title.y).toBeGreaterThanOrEqual(0);
            expect(frame.y + frame.height).toBeLessThanOrEqual(viewport.height);
            expect(frame.height).toBe(original.height);
            const art = await page.locator("#history-illustration").boundingBox();
            const copy = await page.locator("#slide .slide-copy").boundingBox();
            expect(art.y + art.height).toBeLessThanOrEqual(frame.y + frame.height);
            expect(copy.y + copy.height).toBeLessThanOrEqual(frame.y + frame.height);
            // Change language without scrolling back to the header control.
            await page.evaluate(() => document.querySelector('[data-language="fr"]').click());
            const frenchArt = await page.locator("#history-illustration").boundingBox();
            const frenchCopy = await page.locator("#slide .slide-copy").boundingBox();
            expect(frenchArt.y + frenchArt.height).toBeLessThanOrEqual(frame.y + frame.height);
            expect(frenchCopy.y + frenchCopy.height).toBeLessThanOrEqual(frame.y + frame.height);
            await page.evaluate(() => document.querySelector('[data-language="en"]').click());
            if (index < 2) {
                await swipeHand(page, "next_slide");
                await page.clock.runFor(900);
            }
        }
        const second = await page.locator('#slide [data-cell="second"]').boundingBox();
        // Reveal the cancellation stage by interacting with a green cell.
        await page.locator('#slide [data-cell="second"]').click();
        const cancel = await page.locator('#slide [data-cell="cancel"]').boundingBox();
        expect(cancel.x).toBeCloseTo(second.x, 0);
        expect(cancel.y).toBeGreaterThan(second.y);
    });
}

test("navigation pauses when either hand disappears and resumes with both hands", async ({ page }) => {
    await mockCamera(page);
    await page.clock.install();
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("./");
    await page.getByRole("button", { name: "EN", exact: true }).click();
    await page.locator("#start-camera").click();
    await expect(page.locator(".hero h1")).toBeHidden();
    await expect(page.locator(".hero .lead")).toBeHidden();
    await expect(page.locator(".hero .privacy")).toBeHidden();
    await expect(page.locator("#camera-placement")).toContainText("place both hands");
    await holdHandsInFrame(page);
    await expect(page.locator(".camera-preview")).toHaveCSS("outline-color", "rgb(56, 245, 129)");
    await swipeHand(page, "scroll_presentation");
    await expect(page.locator("#slide-gesture-tip")).toBeVisible();
    await page.evaluate(() => { window.demoCamera.coordinate = () => ({ x: .5, y: .5 }); window.demoCamera.frame(true); });
    await page.evaluate(() => { window.demoCamera.coordinate = index => window.demoCamera.detected && index !== 16 ? { x: .5, y: .5 } : null; window.demoCamera.frame(true); });
    await expect(page.locator("#hands-tip")).toBeHidden();
    await page.clock.runFor(3000);
    await page.evaluate(() => window.demoCamera.frame(true));
    await page.evaluate(() => window.demoCamera.action("next_slide"));
    await expect(page.locator("#slide-counter")).toHaveText("Slide 1 / 3");
    await page.evaluate(() => window.demoCamera.frame(false));
    await page.clock.runFor(700);
    await page.evaluate(() => window.demoCamera.frame(false));
    await expect(page.locator("#hands-tip")).toBeVisible();
    await expect(page.locator("#hands-tip")).toContainText("both hands");
    await expect(page.locator("#away-screen")).toBeHidden();
});


test("the final section suggests covering the camera after ten seconds and detects departure quickly", async ({ page }) => {
    await mockCamera(page);
    await page.clock.install();
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("./");
    await page.locator("#start-camera").click();
    await expect(page.locator("#start-camera")).toBeHidden();
    const tip = page.locator("#cover-camera-tip");
    for (let index = 0; index < 6; index++) {
        await page.evaluate(() => window.demoCamera.frame(true));
        await page.clock.runFor(1000);
    }
    await expect(tip).toBeHidden();
    await page.locator("#presence-demo").evaluate(node => node.scrollIntoView({ behavior: "instant", block: "start" }));
    await page.evaluate(() => {
        window.demoCamera.coordinate = index => window.demoCamera.detected && index !== 16 ? { x: .5, y: .5 } : null;
        window.demoCamera.frame(true);
    });
    await expect(page.locator("#departure-tip")).toBeVisible();
    await expect(page.locator("#departure-tip svg")).toBeVisible();
    for (let index = 0; index < 9; index++) {
        await page.clock.runFor(1000);
        await page.evaluate(() => window.demoCamera.frame(true));
        await expect(tip).toBeHidden();
    }
    await page.clock.runFor(1000);
    await page.evaluate(() => window.demoCamera.frame(true));
    await expect(tip).toBeVisible();
    await expect(page.locator("#departure-tip")).toBeHidden();
    await expect(page.locator("#hands-tip")).toBeHidden();
    await expect(tip).toContainText("masquer la cam\u00e9ra avec votre main");
    await page.evaluate(() => document.querySelector('[data-language="en"]').click());
    await expect(tip).toContainText("cover the camera with your hand");
    await page.evaluate(() => window.demoCamera.frame(false));
    await page.clock.runFor(500);
    await page.evaluate(() => window.demoCamera.frame(false));
    await expect(page.locator("#away-screen")).toBeHidden();
    await page.clock.runFor(150);
    await page.evaluate(() => window.demoCamera.frame(false));
    await expect(page.locator("#away-screen")).toBeVisible();
    await page.evaluate(() => window.demoCamera.frame(true));
    await page.clock.runFor(300);
    await page.evaluate(() => window.demoCamera.frame(true));
    await expect(page.locator("#finale")).toBeVisible();
    await expect(tip).toBeHidden();
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


test("the welcome fills a large screen and introduces the camera only after the button is pressed", async ({ page }) => {
    await page.setViewportSize({ width: 2560, height: 1440 });
    await mockCamera(page);
    await page.clock.install();
    await page.goto("./");
    await page.getByRole("button", { name: "EN", exact: true }).click();
    await expect(page.locator(".camera-card")).toBeHidden();
    const title = await page.locator("h1").boundingBox();
    expect(title.x + title.width / 2).toBeCloseTo(1280, 0);
    const presentation = await page.locator("#presentation").boundingBox();
    expect(presentation.y).toBeGreaterThanOrEqual(1440);
    await page.locator("#start-camera").click();
    await expect(page.locator("#start-camera")).toBeHidden();
    await expect(page.locator(".camera-card")).toBeVisible();
    await expect(page.locator("#welcome")).toHaveClass(/camera-open/);
    await expect(page.locator(".camera-preview")).toHaveCSS("outline-width", "3px");
    await holdHandsInFrame(page);
    const tip = page.locator("#scroll-gesture-tip");
    await expect(tip).toBeVisible();
    const bounds = await tip.boundingBox();
    expect(bounds.x + bounds.width / 2).toBeCloseTo(1280, 0);
    await expect(tip.locator('[data-text="scrollShort"]')).toHaveText("Raise your hand");
    expect(await tip.evaluate(node => getComputedStyle(node).animationName)).toBe("prism-colours");
    await page.emulateMedia({ reducedMotion: "reduce" });
    expect(await tip.evaluate(node => getComputedStyle(node).animationName)).toBe("none");
});

test("vertical sweeps repeatedly navigate all sections with a shared two-second cooldown", async ({ page }) => {
    await mockCamera(page);
    await page.clock.install();
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("./");
    await page.getByRole("button", { name: "EN", exact: true }).click();
    await page.locator("#start-camera").click();
    await holdHandsInFrame(page);
    for (const [section, action] of [["presentation", "scroll_presentation"], ["presence-demo", "scroll_presentation"], ["presentation", "scroll_previous"], ["welcome", "scroll_previous"]]) {
        await swipeHand(page, action);
        const top = await page.locator(section === "welcome" ? "#welcome" : `#${section} h2`).evaluate(node => node.getBoundingClientRect().top);
        expect(top).toBeGreaterThanOrEqual(0); expect(top).toBeLessThan(110);
        await expect(page.locator("#navigation-cooldown")).toBeVisible();
        const position = await page.evaluate(() => scrollY);
        await swipeHand(page, action, 16, false);
        expect(await page.evaluate(() => scrollY)).toBe(position);
        await page.clock.runFor(1600);
        await expect(page.locator("#navigation-cooldown")).toBeHidden();
    }
});


test("departure and return fade progressively while Escape restores the page immediately", async ({ page }) => {
    await mockCamera(page);
    await page.clock.install();
    await page.goto("./");
    await page.getByRole("button", { name: "EN", exact: true }).click();
    await page.locator("#start-camera").click();
    await expect(page.locator("#start-camera")).toBeHidden();
    await page.locator("#presence-demo").evaluate(node => node.scrollIntoView({ behavior: "instant", block: "start" }));
    await page.evaluate(() => window.demoCamera.frame(true));
    await page.evaluate(() => window.demoCamera.frame(false));
    await page.clock.runFor(650);
    await page.evaluate(() => window.demoCamera.frame(false));
    await expect(page.locator("#away-screen")).toBeVisible();
    await expect(page.locator("#away-screen")).toHaveCSS("transition-duration", "0.65s");
    await expect(page.locator("#page-content")).toBeVisible();
    expect(await page.locator("#page-content").evaluate(node => node.inert)).toBe(true);
    await page.clock.runFor(650);
    await expect(page.locator("#page-content")).toBeHidden();
    await page.evaluate(() => window.demoCamera.frame(true));
    await page.clock.runFor(300);
    await page.evaluate(() => window.demoCamera.frame(true));
    await expect(page.locator("#finale")).toBeVisible();
    await expect(page.locator("#away-screen")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator("#away-screen")).toBeHidden();
    await page.clock.runFor(700);
    await expect(page.locator("#page-content")).toBeVisible();
});

test("either hand can advance and reverse slides, with continuous tooltip motion", async ({ page }) => {
    await mockCamera(page);
    await page.clock.install();
    await page.emulateMedia({ reducedMotion: "reduce" });
    for (const landmark of [15, 16]) {
        await page.goto("./");
        await page.getByRole("button", { name: "EN", exact: true }).click();
        await page.locator("#start-camera").click();
        await holdHandsInFrame(page); await focusPresentation(page);
        await swipeHand(page, "next_slide", landmark);
        await expect(page.locator("#slide-counter")).toHaveText("Slide 2 / 3");
        await swipeHand(page, "previous_slide", landmark);
        await expect(page.locator("#slide-counter")).toHaveText("Slide \u{1f381} / 3");
    }
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await expect(page.locator(".hand-left svg")).toHaveCSS("animation-duration", "6.4s");
    await expect(page.locator(".hand-left svg")).toHaveCSS("animation-timing-function", "ease-in-out");
});


test("carousel boundaries hide nonexistent previews for keyboard, wheel and hand navigation", async ({ page }) => {
    await mockCamera(page);
    await page.clock.install();
    await page.goto("./");
    await page.locator("#start-camera").click();
    await holdHandsInFrame(page);
    await focusPresentation(page);
    const left = page.locator('.slide-neighbour[data-position="left"]');
    const right = page.locator('.slide-neighbour[data-position="right"]');
    await expect(left).toBeHidden();
    await expect(right).toBeVisible();
    await expect(page.locator("#previous-slide")).toBeDisabled();
    await page.locator("#slide").focus();
    await page.keyboard.press("ArrowLeft");
    await expect(page.locator("#slide-counter")).toHaveText("Slide 1 / 3");
    await page.locator("#next-slide").click();
    await expect(left).toBeVisible();
    await expect(right).toBeVisible();
    await page.locator("#next-slide").click();
    await expect(right).toBeHidden();
    await expect(page.locator("#next-slide")).toBeDisabled();
    await page.locator("#slide").dispatchEvent("wheel", { deltaX: 100, deltaY: 0 });
    await expect(page.locator("#slide-counter")).toHaveText("Slide 3 / 3");
    await swipeHand(page, "next_slide");
    await expect(page.locator("#slide-counter")).toHaveText("Slide 3 / 3");
    await swipeHand(page, "previous_slide", 16);
    await expect(page.locator("#slide-counter")).toHaveText("Slide 2 / 3");
    await expect(left).toBeInViewport();
    await expect(right).toBeInViewport();
    await expect(page.locator(".hand-left use")).toHaveAttribute("transform", "translate(100 0) scale(-1 1)");
    await expect(page.locator(".hand-right use")).not.toHaveAttribute("transform");

});


test("horizontal gestures stay disabled at the welcome and cooldown applies across both axes", async ({ page }) => {
    await mockCamera(page);
    await page.clock.install();
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("./");
    await page.getByRole("button", { name: "EN", exact: true }).click();
    await page.locator("#start-camera").click();
    await holdHandsInFrame(page);
    await swipeHand(page, "next_slide");
    await expect(page.locator("#slide-counter")).toHaveText("Slide 1 / 3");
    await swipeHand(page, "scroll_presentation");
    await expect(page.locator("#navigation-cooldown")).toBeVisible();
    await swipeHand(page, "next_slide", 15, false);
    await expect(page.locator("#slide-counter")).toHaveText("Slide 1 / 3");
    await page.clock.runFor(1600);
    await expect(page.locator("#navigation-cooldown")).toBeHidden();
    await swipeHand(page, "next_slide", 15, false);
    await expect(page.locator("#slide-counter")).toHaveText("Slide 2 / 3");
    const top = await page.evaluate(() => scrollY);
    await swipeHand(page, "scroll_previous", 16, false);
    expect(await page.evaluate(() => scrollY)).toBe(top);
});

test("phone guide uses a single centred target and accepts either hand alone", async ({ browser }) => {
    const page = await browser.newPage({ baseURL: test.info().project.use.baseURL,
        viewport: { width: 390, height: 844 }, hasTouch: true, locale: "en-US" });
    try {
        await mockCamera(page);
        await page.clock.install();
        await page.emulateMedia({ reducedMotion: "reduce" });
        await page.goto("./");
        await page.locator("#start-assisted").click();
        await page.locator("[data-assistance-next]").click();
        await expect(page.locator("#assistance")).toHaveAttribute("data-step", "aim");
        await expect(page.locator(".aim-left")).toBeVisible();
        await expect(page.locator(".aim-right")).toBeHidden();
        const target = await page.locator(".aim-left").boundingBox();
        const preview = await page.locator(".camera-preview").boundingBox();
        expect(target.x + target.width / 2).toBeCloseTo(preview.x + preview.width / 2, 0);
        await page.evaluate(() => {
            window.demoCamera.coordinate = index => index === 16 ? { x: .5, y: .5, confidence: .9 } : null;
            window.demoCamera.frame(true);
        });
        await page.clock.runFor(650);
        await page.evaluate(() => window.demoCamera.frame(true));
        await expect(page.locator("#assistance")).toHaveAttribute("data-step", "right");
        await page.locator("[data-assistance-close]").click();
        await holdHandsInFrame(page);
        await focusPresentation(page);
        for (const wrist of [15, 16]) {
            await finishRibbonAnimation(page);
            await page.clock.runFor(3000);
            await page.evaluate(wrist => {
                const camera = window.demoCamera;
                camera.wrist = { x: .5, y: .5, confidence: .9 };
                camera.coordinate = index => index === wrist ? camera.wrist : null;
                camera.frame(true);
            }, wrist);
            await page.clock.runFor(200);
            await page.evaluate(() => window.demoCamera.frame(true));
            await page.clock.runFor(150);
            await page.evaluate(() => {
                window.demoCamera.wrist.x = .61;
                window.demoCamera.action("next_slide");
            });
            await expect(page.locator("#slide-counter")).toHaveText(wrist === 15 ? "Slide 2 / 3" : "Slide 3 / 3");
        }
    } finally { await page.close(); }
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
        await expect(page.locator(".preview-decoration .hand-pair use").last()).toBeHidden();
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
        await expect(page.locator("#finale-stop-camera")).toHaveCSS("background-color", "rgb(99, 35, 45)");
        expect(await page.evaluate(() => window.demoCamera.state.running)).toBe(true);
        await page.locator("#finale-stop-camera").click();
        expect(await page.evaluate(() => window.demoCamera.stopped)).toBe(true);
        await expect(page.locator("#hands-tip")).toBeHidden();
    } finally { await page.close(); }
});

test("the finale keeps navigation and the GitHub link without enabling hand inference", async ({ page }) => {
    await mockCamera(page);
    await page.clock.install();
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.route("https://github.com/Robin-G0/Motion-Input-Grid", route => route.fulfill({ contentType: "text/html", body: "<h1>Repository</h1>" }));
    await page.goto("./");
    await page.getByRole("button", { name: "EN", exact: true }).click();
    await page.locator("#start-camera").click();
    await holdHandsInFrame(page);
    await page.locator("#presence-demo").evaluate(node => node.scrollIntoView({ behavior: "instant" }));
    await page.evaluate(() => window.demoCamera.frame(true));
    await page.evaluate(() => window.demoCamera.frame(false));
    await page.clock.runFor(650);
    await page.evaluate(() => window.demoCamera.frame(false));
    await page.evaluate(() => window.demoCamera.frame(true));
    await page.clock.runFor(300);
    await page.evaluate(() => window.demoCamera.frame(true));
    await expect(page.locator("#finale")).toBeVisible();
    await page.clock.runFor(3000);
    await expect(page.locator("#scroll-gesture-tip")).toHaveAttribute("data-direction", "down");
    await expect(page.locator("#scroll-gesture-tip")).toContainText("Gently lower");
    await expect(page.locator("#slide-gesture-tip")).toBeHidden();
    await page.evaluate(() => window.demoCamera.frame(true));
    expect(await page.evaluate(() => window.demoCamera.profile.tracking.hands)).toBe(false);
    await swipeHand(page, "scroll_previous");
    await expect(page.locator("#presence-title")).toBeInViewport();
    await swipeHand(page, "scroll_presentation");
    await expect(page.locator("#finale-title")).toBeInViewport();
    await page.clock.runFor(3000);
    await expect(page.locator('#finale [data-link="repository"]')).toHaveAttribute("href", "https://github.com/Robin-G0/Motion-Input-Grid");
    expect(await page.evaluate(() => window.demoCamera.profile.tracking.hands)).toBe(false);
    await page.locator('#finale [data-link="repository"]').click();
    await expect(page).toHaveURL("https://github.com/Robin-G0/Motion-Input-Grid");
});


test("golden loading bar fills continuously and unlocks hand navigation after two seconds", async ({ page }) => {
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
    await expect(bar).toHaveCSS("height", "6px");
    await page.clock.runFor(1000);
    const filled = await fill.boundingBox();
    expect(filled.width / page.viewportSize().width).toBeCloseTo(.5, 1);
    await expect(bar).toHaveAttribute("aria-valuenow", /^(49|50|51)$/);
    await page.setViewportSize({ width: 390, height: 844 });
    expect((await fill.boundingBox()).width).toBeCloseTo(195, -1);
    await page.clock.runFor(1000);
    await expect(bar).toBeHidden();
});

test("French welcome punctuation stays with its preceding word at phone and desktop widths", async ({ page }) => {
    await page.goto("./");
    for (const width of [320, 390, 800, 1280]) {
        await page.setViewportSize({ width, height: 844 });
        const ending = page.locator(".hero h1 .title-ending");
        await expect(ending).toHaveText("\u00e7a ?");
        expect(await ending.evaluate(node => node.getClientRects().length)).toBe(1);
        await expect(ending).toHaveCSS("white-space", "nowrap");
    }
});


test("native MIG slide events remain connected to the page navigation", async ({ page }) => {
    await mockCamera(page);
    await page.clock.install();
    await page.goto("./");
    await page.getByRole("button", { name: "EN", exact: true }).click();
    await page.locator("#start-camera").click();
    await holdHandsInFrame(page);
    await focusPresentation(page);
    await page.evaluate(() => window.demoCamera.frame(true));
    await page.clock.runFor(200);
    await page.evaluate(() => window.demoCamera.frame(true));
    await page.evaluate(() => window.demoCamera.action("next_slide"));
    await expect(page.locator("#slide-counter")).toHaveText("Slide 2 / 3");
    await finishRibbonAnimation(page);
    await page.clock.runFor(2200);
    await page.evaluate(() => window.demoCamera.frame(true));
    await page.clock.runFor(200);
    await page.evaluate(() => window.demoCamera.frame(true));
    await page.evaluate(() => window.demoCamera.action("previous_slide"));
    await expect(page.locator("#slide-counter")).toHaveText("Slide \u{1f381} / 3");
});


test("a slow central sweep restarts after a missing frame and navigates down and back up", async ({ page }) => {
    await mockCamera(page);
    await page.clock.install();
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("./");
    await page.getByRole("button", { name: "EN", exact: true }).click();
    await page.locator("#start-camera").click();
    await holdHandsInFrame(page);
    for (const direction of [1, -1]) {
        await page.clock.runFor(3000);
        await page.evaluate(direction => {
            window.demoCamera.coordinate = index => index === 15 ? { x: .5, y: direction === 1 ? .65 : .35 }
                : [11, 12, 16].includes(index) ? { x: .5, y: .5 } : null;
            window.demoCamera.frame(true);
        }, direction);
        await page.clock.runFor(200);
        await page.evaluate(() => window.demoCamera.frame(true));
        for (let frame = 0; frame <= 36; frame++) {
            await page.evaluate(({ frame, direction }) => {
                const camera = window.demoCamera;
                camera.coordinate = index => index === 15
                    ? frame === 5 ? null : { x: .5, y: (direction === 1 ? .65 : .35) - direction * frame * .01 }
                    : [11, 12, 16].includes(index) ? { x: .5, y: .5 } : null;
                camera.frame(true);
            }, { frame, direction });
            await page.clock.runFor(40);
        }
        if (direction === 1) await expect(page.locator("#presentation h2")).toBeInViewport();
        else expect(await page.evaluate(() => scrollY)).toBe(0);
    }
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

test("system palettes, square cells and all three carousel panels remain usable", async ({ page }) => {
    await mockCamera(page);
    await page.clock.install();
    await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
    await page.goto("./");
    await page.getByRole("button", { name: "EN", exact: true }).click();
    const colour = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--paper"));
    await page.emulateMedia({ colorScheme: "dark" });
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--paper"))).not.toBe(colour);
    await page.locator("#slide").focus();
    await page.keyboard.press("ArrowLeft");
    await expect(page.locator("#slide-counter")).toHaveText("Slide 1 / 3");
    await expect(page.locator("#navigation-edge")).toBeHidden();
    await page.locator("#next-slide").click();
    await page.locator("#next-slide").click();
    await expect(page.locator(".slide-neighbour")).toHaveCount(2);
    const grid = await page.locator("#slide .history-grid").boundingBox();
    expect(grid.width).toBeCloseTo(grid.height, 0);
    const cell = await page.locator('#slide [data-cell="first"]').boundingBox();
    expect(cell.width).toBeCloseTo(cell.height, 0);
    await page.locator("#slide").focus();
    await page.keyboard.press("ArrowRight");
    await expect(page.locator("#navigation-edge")).toBeHidden();
    await expect(page.locator("#slide-counter")).toHaveText("Slide 3 / 3");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});


test("cooldown discards keys, clicks, partial wheel motion, touch and native gesture progress", async ({ page }) => {
    await mockCamera(page);
    await page.clock.install();
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("./");
    await page.getByRole("button", { name: "EN", exact: true }).click();
    await page.locator("#start-camera").click();
    await holdHandsInFrame(page);
    await focusPresentation(page);
    await page.evaluate(() => { window.restarts = 0; window.demoCamera.tracker = { restart() { window.restarts++; } }; });
    await swipeHand(page, "next_slide");
    await expect(page.locator("#slide-counter")).toHaveText("Slide 2 / 3");
    await expect(page.locator("#next-slide")).toBeDisabled();
    const position = await page.evaluate(() => scrollY);
    await page.locator("#slide").focus();
    await page.keyboard.down("ArrowRight");
    await page.keyboard.press("PageDown");
    await page.locator("#next-slide").dispatchEvent("click");
    await page.locator("#slide").dispatchEvent("wheel", { deltaX: 40, deltaY: 0 });
    await page.locator("#slide").dispatchEvent("pointerdown", { pointerType: "touch", pointerId: 1, clientX: 300 });
    await page.clock.runFor(3000);
    await page.locator("#slide").dispatchEvent("pointerup", { pointerType: "touch", pointerId: 1, clientX: 100 });
    await page.locator("#slide").dispatchEvent("wheel", { deltaX: 30, deltaY: 0 });
    await page.keyboard.down("ArrowRight");
    await expect(page.locator("#slide-counter")).toHaveText("Slide 2 / 3");
    expect(await page.evaluate(() => scrollY)).toBe(position);
    expect(await page.evaluate(() => window.restarts)).toBeGreaterThan(0);
    await page.keyboard.up("ArrowRight");
    await page.keyboard.press("ArrowRight");
    await expect(page.locator("#slide-counter")).toHaveText("Slide 3 / 3");
});


test("the two-second recovery starts after the ribbon animation finishes", async ({ page }) => {
    await mockCamera(page);
    await page.clock.install();
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto("./");
    await page.getByRole("button", { name: "EN", exact: true }).click();
    await page.locator("#start-camera").click();
    await holdHandsInFrame(page);
    await focusPresentation(page);
    await page.evaluate(() => window.demoCamera.frame(true));
    await page.clock.runFor(200);
    await page.evaluate(() => window.demoCamera.frame(true));
    await page.evaluate(() => window.demoCamera.action("next_slide"));
    const bar = page.locator("#navigation-cooldown");
    await page.clock.runFor(400);
    await expect(bar).toHaveAttribute("aria-valuenow", "0");
    await expect(page.locator("#next-slide")).toBeDisabled();
    await finishRibbonAnimation(page);
    await page.clock.runFor(1900);
    await expect(bar).toBeVisible();
    await page.clock.runFor(150);
    await expect(bar).toBeHidden();
});


test("trackpad momentum produces one elastic return until the wheel stream stops", async ({ page }) => {
    await page.clock.install();
    await page.goto("./");
    await page.getByRole("button", { name: "EN", exact: true }).click();
    await page.clock.pauseAt(new Date(await page.evaluate(() => Date.now() + 1000)));
    await page.evaluate(() => {
        window.elasticReturns = 0;
        const content = document.querySelector("#page-content");
        const animate = content.animate.bind(content);
        content.animate = (...args) => { window.elasticReturns++; return animate(...args); };
    });
    for (let index = 0; index < 20; index++) {
        await page.locator("body").dispatchEvent("wheel", { deltaY: -20 });
        await page.clock.runFor(100);
    }
    expect(await page.evaluate(() => window.elasticReturns)).toBe(1);
    await page.clock.runFor(300);
    await page.locator("body").dispatchEvent("wheel", { deltaY: -20 });
    expect(await page.evaluate(() => window.elasticReturns)).toBe(2);
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
    for (const y of [.24, .26, .24, .29, .31]) {
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
        window.demoCamera.coordinate = index => index === 15 ? { x: .5, y: .33 }
            : index === 16 ? { x: .5, y: .5 } : null;
        window.demoCamera.frame(true);
    });
    await page.clock.runFor(550);
    await page.evaluate(() => window.demoCamera.frame(true));
    await expect(edge).toBeHidden();
});


test("assistance positions both hands, teaches gestures, then guides slides and presence", async ({ page }) => {
    test.setTimeout(60000);
    await mockCamera(page);
    await page.clock.install();
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("./");
    await page.getByRole("button", { name: "EN", exact: true }).click();
    await page.locator("#start-assisted").click();
    const assistant = page.locator("#assistance");
    const next = assistant.locator("[data-assistance-next]");
    await expect(assistant.locator("[data-assistance-title]")).toHaveText("Help");
    await page.getByRole("button", { name: "FR", exact: true }).click();
    await expect(assistant.locator("[data-assistance-title]")).toHaveText("Aide");
    await page.getByRole("button", { name: "EN", exact: true }).click();
    await expect(assistant).toHaveAttribute("data-step", "privacy");
    await expect(assistant).toContainText("Nothing is recorded");
    await expect(next).toHaveText("Activate the camera");
    expect(await page.evaluate(() => Boolean(window.demoCamera))).toBe(false);
    await next.click();
    await expect(assistant).toHaveAttribute("data-step", "aim");
    await page.evaluate(() => window.demoCamera.frame(true));
    await expect(assistant).toContainText("Step back");
    await expect(assistant.locator(".aim-outline")).toHaveCount(2);
    const outline = assistant.locator(".aim-outline").first();
    await expect(outline).toBeVisible();
    const previewBounds = await page.locator(".camera-preview").boundingBox();
    const outlineBounds = await outline.boundingBox();
    expect(outlineBounds.height / previewBounds.height).toBeCloseTo(.3, 1);
    expect(outlineBounds.x).toBeGreaterThan(previewBounds.x);
    expect(outlineBounds.x + outlineBounds.width).toBeLessThan(previewBounds.x + previewBounds.width);
    await holdHandsInFrame(page);
    await expect(assistant).toHaveAttribute("data-step", "right");
    const origin = await page.evaluate(() => scrollY);
    await swipeHand(page, "previous_slide");
    await expect(assistant).toHaveAttribute("data-step", "cooldown");
    await expect(page.locator("#navigation-cooldown")).toBeVisible();
    await expect(next).toBeDisabled();
    const blocked = await assistant.evaluate(root => ({
        wheel: !root.dispatchEvent(new WheelEvent("wheel", { deltaY: 100, bubbles: true, cancelable: true })),
        touch: !root.dispatchEvent(new Event("touchmove", { bubbles: true, cancelable: true }))
    }));
    expect(blocked).toEqual({ wheel: false, touch: false });
    await page.keyboard.press("PageDown");
    expect(await page.evaluate(() => scrollY)).toBe(origin);
    await page.clock.runFor(2400);
    await expect(assistant).toHaveAttribute("data-step", "left");
    for (const [action, step] of [["next_slide", "down"], ["scroll_previous", "up"], ["scroll_presentation", "scroll"]]) {
        await swipeHand(page, action);
        await expect(assistant).toHaveAttribute("data-step", step);
        expect(await page.evaluate(() => scrollY)).toBe(origin);
        await expect(page.locator("#slide-counter")).toHaveText("Slide 1 / 3");
    }
    await swipeHand(page, "scroll_presentation");
    await expect(assistant).toHaveAttribute("data-step", "ribbonForward");
    await expect(page.locator("#presentation h2")).toBeInViewport();
    await page.clock.runFor(2200);
    await swipeHand(page, "next_slide");
    await expect(assistant).toHaveAttribute("data-step", "ribbonBack");
    await swipeHand(page, "previous_slide");
    await expect(assistant).toHaveAttribute("data-step", "gift");
    await expect(page.locator("#slide-title")).toHaveText("Pretty neat, right?");
    expect(await page.locator("#slide").evaluate(node => getComputedStyle(node).backgroundImage))
        .toContain("linear-gradient");
    await finishRibbonAnimation(page);
    await page.clock.runFor(2200);
    await page.locator("#previous-slide").click();
    await expect(assistant).toHaveAttribute("data-step", "ribbonBrowse");
    await focusPresentation(page);
    await swipeHand(page, "next_slide");
    await expect(page.locator("#slide-counter")).toHaveText("Slide 2 / 3");
    await expect(assistant).toHaveAttribute("data-step", "ribbonBrowse");
    await swipeHand(page, "next_slide");
    await expect(assistant).toHaveAttribute("data-step", "presenceScroll");
    await expect(assistant.locator("[data-assistance-message]")).toHaveText("Raise your hand to continue.");
    await swipeHand(page, "scroll_presentation");
    await expect(assistant).toHaveAttribute("data-step", "presence");
    await swipeHand(page, "scroll_previous");
    await page.clock.runFor(2200);
    await expect(assistant).toHaveAttribute("data-step", "presenceScroll");
    await expect(page.locator("#presentation h2")).toBeInViewport();
    await swipeHand(page, "scroll_presentation");
    await expect(assistant).toHaveAttribute("data-step", "presence");
    await expect(assistant.locator("[data-assistance-hint]")).toBeHidden();
    await page.clock.runFor(7500);
    await page.evaluate(() => window.demoCamera.frame(true));
    await expect(assistant).toContainText("cover the camera");
    await page.evaluate(() => window.demoCamera.frame(false));
    await page.clock.runFor(700);
    await page.evaluate(() => window.demoCamera.frame(false));
    await expect(assistant).toBeHidden();
    await page.evaluate(() => window.demoCamera.frame(true));
    await page.clock.runFor(350);
    await page.evaluate(() => window.demoCamera.frame(true));
    await expect(assistant).toHaveAttribute("data-step", "finale");
    await expect(assistant.locator("[data-assistance-message]")).toHaveText("You are ready. Keep exploring with MIG.");
    await expect(assistant.getByRole("button")).toHaveCount(1);
    await expect(next).toHaveText("Finish the tutorial");
    await expect(page.locator("#finale")).toBeVisible();
    await next.click();
    await expect(assistant).toBeHidden();
    await page.locator("#finale-stop-camera").click();
    expect(await page.evaluate(() => window.demoCamera.stopped)).toBe(true);
});


test("tour messages do not restrict slide direction or departure and return", async ({ page }) => {
    await mockCamera(page);
    await page.clock.install();
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("./");
    await page.locator("#start-assisted").click();
    await page.locator("[data-assistance-next]").click();
    await holdHandsInFrame(page);
    await focusPresentation(page);
    await page.clock.runFor(100);
    await swipeHand(page, "next_slide");
    await expect(page.locator("#assistance")).toHaveAttribute("data-step", "ribbonBack");
    await swipeHand(page, "next_slide");
    await expect(page.locator("#slide-counter")).toHaveText("Slide 3 / 3");
    await swipeHand(page, "previous_slide");
    await expect(page.locator("#slide-counter")).toHaveText("Slide 2 / 3");
    await swipeHand(page, "scroll_presentation");
    await page.clock.runFor(2200);
    await expect(page.locator("#assistance")).toHaveAttribute("data-step", "presence");
    await page.evaluate(() => window.demoCamera.frame(false));
    await page.clock.runFor(700);
    await expect(page.locator("#away-screen")).toBeVisible();
    await page.evaluate(() => window.demoCamera.frame(true));
    await page.clock.runFor(350);
    await page.evaluate(() => window.demoCamera.frame(true));
    await expect(page.locator("#finale")).toBeVisible();
    await expect(page.locator("#assistance")).toHaveAttribute("data-step", "finale");
});

test("camera sampling starts before recovery ends without unlocking navigation early", async ({ page }) => {
    await mockCamera(page);
    await page.clock.install();
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("./");
    await page.locator("#start-camera").click();
    await holdHandsInFrame(page);
    await swipeHand(page, "scroll_presentation");
    const position = await page.evaluate(() => scrollY);
    const bar = page.locator("#navigation-cooldown");
    await page.clock.runFor(1600);
    await page.evaluate(() => {
        window.restarts = 0;
        window.demoCamera.tracker = { restart() { window.restarts++; } };
        window.demoCamera.wrist = { x: .5, y: .5 };
        window.demoCamera.frame(true);
    });
    await page.clock.runFor(160);
    await page.evaluate(() => window.demoCamera.frame(true));
    await page.clock.runFor(70);
    await page.evaluate(() => {
        window.demoCamera.wrist = { x: .5, y: .64 };
        window.demoCamera.frame(true);
        window.demoCamera.action("scroll_previous");
    });
    await expect(bar).toBeVisible();
    expect(await page.evaluate(() => scrollY)).toBe(position);
    await page.clock.runFor(170);
    await expect(bar).toBeHidden();
    expect(await page.evaluate(() => window.restarts)).toBe(0);
    await page.clock.runFor(80);
    await page.evaluate(() => {
        window.demoCamera.wrist = { x: .5, y: .72 };
        window.demoCamera.frame(true);
    });
    expect(await page.evaluate(() => scrollY)).toBe(0);
    await expect(bar).toBeVisible();
});

test("theme touch interactions stay available during recovery and larger hands replace slide instructions", async ({ page }) => {
    await mockCamera(page);
    await page.clock.install();
    await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "dark" });
    await page.goto("./");
    await page.locator("#start-camera").click();
    await holdHandsInFrame(page);
    await swipeHand(page, "scroll_presentation");
    await expect(page.locator("#slide-gesture-tip .hand-left svg")).toHaveCSS("width", "72px");
    const allowed = await page.locator("#theme-toggle").evaluate(button => {
        button.dispatchEvent(new Event("touchstart", { bubbles: true, cancelable: true }));
        const allowed = button.dispatchEvent(new Event("touchmove", { bubbles: true, cancelable: true }));
        button.dispatchEvent(new Event("touchend", { bubbles: true }));
        button.click();
        return allowed;
    });
    expect(allowed).toBe(true);
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await expect(page.locator("#navigation-cooldown")).toBeVisible();
    await page.locator("#theme-toggle").evaluate(button => button.click());
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    const blocked = await page.locator("#slide").evaluate(slide =>
        !slide.dispatchEvent(new Event("touchmove", { bubbles: true, cancelable: true })));
    expect(blocked).toBe(true);
});

test("theme choice is remembered, works against the system palette and follows language", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("./");
    await page.getByRole("button", { name: "EN", exact: true }).click();
    await page.getByRole("button", { name: "Switch to dark theme" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--paper").trim())).toBe("#0b101a");
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await page.getByRole("button", { name: "FR", exact: true }).click();
    await page.locator("#theme-toggle").click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--paper").trim())).toBe("#f7f8fc");
    await expect(page.locator("#theme-toggle")).toHaveAttribute("aria-label", /sombre/);
    await page.emulateMedia({ colorScheme: "dark" });
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--paper").trim())).toBe("#f7f8fc");
});

test("an active guide allows manual scrolling, theme changes and gesture navigation after reopening", async ({ page }) => {
    await mockCamera(page);
    await page.clock.install();
    await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "dark" });
    await page.goto("./");
    await page.getByRole("button", { name: "EN", exact: true }).click();
    await page.locator("#start-camera").click();
    await holdHandsInFrame(page);
    await page.locator("#assistance-toggle").click();
    const assistant = page.locator("#assistance");
    await expect(assistant.locator(".assistance-bulb")).toHaveText("💡");
    await page.locator("#theme-toggle").click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await page.mouse.move(40, 120);
    await page.mouse.wheel(0, 350);
    await page.clock.runFor(100);
    await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(0);
    await assistant.locator("[data-assistance-next]").click();
    await assistant.locator("[data-assistance-next]").click();
    await assistant.locator("[data-assistance-next]").click();
    await page.clock.runFor(2200);
    for (let index = 0; index < 4; index++) await assistant.locator("[data-assistance-next]").click();
    await expect(assistant).toHaveAttribute("data-step", "scroll");
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await swipeHand(page, "scroll_presentation");
    await expect(assistant).toHaveAttribute("data-step", "ribbonForward");
    await expect(page.locator("#presentation h2")).toBeInViewport();
    await assistant.locator("[data-assistance-close]").click();
    await page.clock.runFor(2200);
    await page.evaluate(() => window.demoCamera.frame(false));
    await page.clock.runFor(4500);
    await page.evaluate(() => window.demoCamera.frame(false));
    await expect(assistant).toBeHidden();
    await page.mouse.wheel(0, -350);
    await page.clock.runFor(100);
    await expect(page.locator("#navigation-cooldown")).toBeHidden();
});


test("brief missing camera observations keep the outline steady; a closed guide stays closed", async ({ page }) => {
    await mockCamera(page);
    await page.clock.install();
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("./");
    await page.getByRole("button", { name: "EN", exact: true }).click();
    await page.locator("#start-camera").click();
    await holdHandsInFrame(page);
    const card = page.locator(".camera-card");
    await page.evaluate(() => window.demoCamera.frame(false));
    await page.clock.runFor(200);
    await page.evaluate(() => window.demoCamera.frame(false));
    await expect(card).toHaveClass(/has-hands/);
    await page.evaluate(() => window.demoCamera.frame(true));
    await page.locator("#assistance-toggle").click();
    await expect(page.locator("#assistance")).toHaveAttribute("data-step", "privacy");
    await page.locator("[data-assistance-close]").click();
    await page.evaluate(() => window.demoCamera.frame(false));
    await page.clock.runFor(4100);
    await page.evaluate(() => window.demoCamera.frame(false));
    await expect(page.locator("#assistance")).toBeHidden();
    await page.evaluate(() => { window.demoCamera.coordinate = index => ({ x: index === 15 ? .65 : index === 16 ? .35 : .5, y: .5 }); window.demoCamera.frame(true); });
    await page.clock.runFor(700);
    await page.evaluate(() => window.demoCamera.frame(true));
    await expect(page.locator("#assistance")).toBeHidden();
    await page.locator("#presentation").evaluate(node => node.scrollIntoView({ behavior: "instant" }));
    await expect(page.locator(".camera-preview")).toHaveClass(/preview-offscreen/);
    expect(await page.evaluate(() => window.demoCamera.state.running)).toBe(true);
});


test("assistance fits a phone and retries camera denial directly from the guide", async ({ page }) => {
    await mockCamera(page, "Permission denied");
    await page.setViewportSize({ width: 390, height: 700 });
    await page.goto("./");
    await page.locator("#start-assisted").click();
    expect(await page.locator(".assistance-bubble").evaluate(node => node.scrollTop)).toBe(0);
    const bubble = await page.locator(".assistance-bubble").boundingBox();
    expect(bubble.x).toBeGreaterThanOrEqual(0);
    expect(bubble.x + bubble.width).toBeLessThanOrEqual(390);
    expect(bubble.y + bubble.height).toBeLessThanOrEqual(700);
    await page.locator("[data-assistance-next]").focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("#assistance")).toHaveAttribute("data-step", "cameraError");
    await expect(page.locator("[data-assistance-next]")).toHaveText("Réessayer");
    await expect(page.locator("#camera-status")).toContainText("refus");
    await page.evaluate(() => { window.nextCameraFailure = ""; });
    await page.locator("[data-assistance-next]").click();
    await expect(page.locator("#assistance")).toHaveAttribute("data-step", "aim");
    expect(await page.evaluate(() => window.demoCamera.state.running)).toBe(true);
});

test("the guide follows manual scrolling past the ribbon and back to previous sections", async ({ page }) => {
    await mockCamera(page);
    await page.clock.install();
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("./");
    await page.locator("#start-assisted").click();
    await page.locator("[data-assistance-next]").click();
    await expect(page.locator("#assistance")).toHaveAttribute("data-step", "aim");
    await page.evaluate(() => {
        window.demoCamera.coordinate = index => ({ x: index === 15 ? .65 : index === 16 ? .35 : .5, y: .5 });
    });
    await holdHandsInFrame(page);
    await focusPresentation(page);
    await page.clock.runFor(100);
    await expect(page.locator("#assistance")).toHaveAttribute("data-step", "ribbonForward");
    await swipeHand(page, "next_slide");
    await expect(page.locator("#assistance")).toHaveAttribute("data-step", "ribbonBack");
    await finishRibbonAnimation(page);
    await page.clock.runFor(2200);
    await swipeHand(page, "scroll_previous");
    await page.clock.runFor(2200);
    await expect(page.locator("#assistance")).toHaveAttribute("data-step", "scroll");
    await swipeHand(page, "scroll_presentation");
    await page.clock.runFor(2200);
    await expect(page.locator("#assistance")).toHaveAttribute("data-step", "ribbonBack");
    await expect(page.locator("#slide-counter")).toHaveText("Slide 2 / 3");
    await page.locator("#presence-demo").evaluate(node => node.scrollIntoView({ behavior: "instant" }));
    await page.clock.runFor(100);
    await expect(page.locator("#assistance")).toHaveAttribute("data-step", "presence");
    await expect(page.locator("[data-assistance-message]")).toHaveText("Sortez du cadre.");
    await focusPresentation(page);
    await page.clock.runFor(100);
    await expect(page.locator("#assistance")).toHaveAttribute("data-step", "ribbonBack");
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await page.clock.runFor(100);
    await expect(page.locator("#assistance")).toHaveAttribute("data-step", "scroll");
});

test("aiming keeps a visual hand through brief gaps and recovery resumes with a cross", async ({ page }) => {
    await mockCamera(page);
    await page.clock.install();
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("./");
    await page.locator("#start-assisted").click();
    await page.locator("[data-assistance-next]").click();
    await expect(page.locator("#assistance")).toHaveAttribute("data-step", "aim");
    await page.evaluate(() => {
        window.demoCamera.coordinate = index => window.demoCamera.detected && index !== 16 ? { x: .2, y: .4 } : null;
        window.demoCamera.frame(true);
    });
    const pointer = page.locator("[data-assistance-pointer]");
    await expect(pointer.locator(".aim-hand")).toBeVisible();
    await expect(pointer.locator(".aim-cross")).toBeHidden();
    await page.clock.runFor(100);
    await page.evaluate(() => window.demoCamera.frame(false));
    await expect(pointer).toBeVisible();
    await page.clock.runFor(250);
    await page.evaluate(() => window.demoCamera.frame(false));
    await expect(pointer).toBeHidden();
    await page.evaluate(() => {
        window.demoCamera.coordinate = () => ({ x: .5, y: .5 });
        window.demoCamera.frame(true);
    });
    await expect(page.locator("[data-assistance-message]")).toContainText("Reculez");
    await expect(pointer).toBeVisible();
    await page.evaluate(() => {
        window.demoCamera.coordinate = index => window.demoCamera.detected ? { x: index === 15 ? .65 : index === 16 ? .35 : .5, y: .5 } : null;
        window.demoCamera.frame(true);
    });
    await page.clock.runFor(600);
    await page.evaluate(() => window.demoCamera.frame(true));
    await expect(page.locator("#assistance")).toHaveAttribute("data-step", "right");
    await focusPresentation(page);
    await page.clock.runFor(100);
    await page.evaluate(() => window.demoCamera.frame(false));
    await page.clock.runFor(4100);
    await page.evaluate(() => window.demoCamera.frame(false));
    await expect(page.locator("#assistance")).toHaveAttribute("data-step", "recover");
    await page.evaluate(() => window.demoCamera.frame(true));
    await expect(pointer.locator(".aim-cross")).toBeVisible();
    await expect(pointer.locator(".aim-hand")).toBeHidden();
    await page.clock.runFor(600);
    await page.evaluate(() => window.demoCamera.frame(true));
    await expect(page.locator("#assistance")).toHaveAttribute("data-step", "ribbonForward");
});


test("tracking teleports cannot navigate through either camera sweeps or native events", async ({ page }) => {
    await mockCamera(page);
    await page.clock.install();
    await page.goto("./");
    await page.locator("#start-camera").click();
    await holdHandsInFrame(page);
    await focusPresentation(page);
    await page.clock.runFor(3000);
    await page.keyboard.press("c");
    await expect(page.locator("#camera-debug")).toBeVisible();
    await page.evaluate(() => {
        const camera = window.demoCamera;
        camera.wrist = { x: .5, y: .5 };
        camera.coordinate = index => index === 15 ? camera.wrist
            : [11, 12, 16].includes(index) ? { x: .5, y: .5 } : null;
        camera.frame(true);
    });
    await page.clock.runFor(200);
    await page.evaluate(() => window.demoCamera.frame(true));
    await page.clock.runFor(20);
    await page.evaluate(() => {
        window.demoCamera.wrist = { x: .95, y: .5 };
        window.demoCamera.action("next_slide");
        window.demoCamera.frame(true);
    });
    await expect(page.locator("#slide-counter")).toHaveText("Slide 1 / 3");
    await expect(page.locator("#camera-debug ol")).toContainText("Saut de suivi rejeté");
    await page.keyboard.press("c");
    await swipeHand(page, "next_slide");
    await expect(page.locator("#slide-counter")).toHaveText("Slide 2 / 3");
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

test("oscillating ghost pose confidence cannot keep presence active", async ({ page }) => {
    await mockCamera(page);
    await page.clock.install();
    await page.goto("./");
    await page.locator("#start-camera").click();
    await holdHandsInFrame(page);
    await page.locator("#presence-demo").evaluate(node => node.scrollIntoView({ behavior: "instant" }));
    await page.evaluate(() => {
        window.demoCamera.coordinate = () => ({ x: .5, y: .5, confidence: .95 });
        window.demoCamera.frame(true);
    });
    await page.clock.runFor(100);
    await page.evaluate(() => {
        window.demoCamera.coordinate = () => ({ x: .5, y: .5, confidence: .7 });
        window.demoCamera.frame(true);
    });
    for (const confidence of [.95, .7, .95, .7, .95, .7]) {
        await page.clock.runFor(100);
        await page.evaluate(confidence => {
            window.demoCamera.coordinate = () => ({ x: .5, y: .5, confidence });
            window.demoCamera.frame(true);
        }, confidence);
    }
    await page.clock.runFor(100);
    await expect(page.locator("#away-screen")).toHaveClass(/is-dark/);
    await page.evaluate(() => {
        window.demoCamera.coordinate = () => ({ x: .5, y: .5, confidence: .95 });
        window.demoCamera.frame(true);
    });
    await page.clock.runFor(1200);
    await expect(page.locator("#away-screen")).toBeHidden();
});

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

test("one missing observation hides on departure, not on return, even with sparse frames", async ({ page }) => {
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
    await expect(page.locator("#away-screen")).toBeVisible();
    await expect(page.locator("#page-content")).toBeHidden();
    await page.clock.runFor(3000);
    await page.evaluate(() => window.demoCamera.frame(true));
    await page.clock.runFor(350);
    await expect(page.locator("#away-screen")).toBeHidden();
    await expect(page.locator("#finale")).toBeVisible();
    await page.clock.runFor(3000);
    await expect(page.locator("#away-screen")).toBeHidden();
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


test("both target hands are required and a low second wrist cannot complete positioning", async ({ page }) => {
    await mockCamera(page);
    await page.clock.install();
    await page.goto("./");
    await page.locator("#start-assisted").click();
    await page.locator("[data-assistance-next]").click();
    await expect(page.locator("#assistance")).toHaveAttribute("data-step", "aim");
    await expect(page.locator(".aim-circle")).toHaveCSS("width", "150px");
    await expect(page.locator(".aim-hand").first()).toHaveCSS("width", "76px");
    await page.evaluate(() => {
        window.demoCamera.coordinate = index => index === 15 ? { x: .68, y: .5 }
            : index === 16 ? { x: .5, y: .95 } : { x: .5, y: .5 };
        window.demoCamera.frame(true);
    });
    await page.clock.runFor(650);
    await page.evaluate(() => window.demoCamera.frame(true));
    await expect(page.locator("#assistance")).toHaveAttribute("data-step", "aim");
    await page.evaluate(() => {
        window.demoCamera.coordinate = index => ({ x: index === 15 ? .65 : index === 16 ? .35 : .5, y: .5 });
        window.demoCamera.frame(true);
    });
    await page.clock.runFor(650);
    await page.evaluate(() => window.demoCamera.frame(true));
    await expect(page.locator("#assistance")).toHaveAttribute("data-step", "right");
    await expect(page.locator('[data-camera-edge="bottom"]')).toBeHidden();
    await page.clock.runFor(2000);
    await page.evaluate(() => window.demoCamera.frame(true));
    await expect(page.locator(".camera-preview")).toHaveClass(/framing-confirmed/);
});

test("closing the guide cancels its automatic cooldown continuation", async ({ page }) => {
    await mockCamera(page);
    await page.clock.install();
    await page.goto("./");
    await page.locator("#start-assisted").click();
    const next = page.locator("[data-assistance-next]");
    await next.click();
    await next.click();
    await next.click();
    await expect(page.locator("#assistance")).toHaveAttribute("data-step", "cooldown");
    await page.clock.runFor(2100);
    await page.locator("[data-assistance-close]").click();
    await page.clock.runFor(1000);
    await expect(page.locator("#assistance")).toBeHidden();
});

test("gesture hints follow manual viewport changes and ignore a partially visible ribbon", async ({ page }) => {
    await mockCamera(page);
    await page.clock.install();
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("./");
    await page.locator("#start-camera").click();
    await holdHandsInFrame(page);
    const vertical = page.locator("#scroll-gesture-tip");
    const horizontal = page.locator("#slide-gesture-tip");
    await expect(vertical).toBeVisible();
    await expect(horizontal).toBeHidden();
    await page.locator("#presentation").evaluate(node => {
        window.scrollTo({ top: scrollY + node.getBoundingClientRect().top - innerHeight * .8, behavior: "instant" });
    });
    await expect(horizontal).toBeHidden();
    await focusPresentation(page);
    await expect(horizontal).toBeVisible();
    await expect(vertical).toBeHidden();
    await page.locator("#presence-demo").evaluate(node => node.scrollIntoView({ behavior: "instant", block: "start" }));
    await expect(horizontal).toBeHidden();
    await expect(vertical).toBeHidden();
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await expect(horizontal).toBeHidden();
    await expect(vertical).toBeVisible();
    await expect(vertical).toHaveAttribute("data-direction", "up");
});

test("a native event from the other wrist cannot borrow the centred wrist authorization", async ({ page }) => {
    await mockCamera(page);
    await page.clock.install();
    await page.goto("./");
    await page.locator("#start-camera").click();
    await holdHandsInFrame(page);
    await focusPresentation(page);
    await page.evaluate(() => {
        window.demoCamera.coordinate = index => index === 16 ? { x: .99, y: .99 } : { x: .5, y: .5 };
        window.demoCamera.frame(true);
    });
    await page.clock.runFor(200);
    await page.evaluate(() => {
        window.demoCamera.frame(true);
        window.demoCamera.options.onAction({ action: "next_slide", id: "next_slide_right_wrist" });
    });
    await expect(page.locator("#slide-counter")).toHaveText("Slide 1 / 3");
    await page.evaluate(() => window.demoCamera.options.onAction({ action: "next_slide", id: "next_slide_left_wrist" }));
    await expect(page.locator("#slide-counter")).toHaveText("Slide 1 / 3");
    await page.evaluate(() => {
        window.demoCamera.coordinate = () => ({ x: .5, y: .5, confidence: .9 });
        window.demoCamera.frame(true);
    });
    await page.clock.runFor(200);
    await page.evaluate(() => {
        window.demoCamera.frame(true);
        window.demoCamera.options.onAction({ action: "next_slide", id: "next_slide_left_wrist" });
    });
    await expect(page.locator("#slide-counter")).toHaveText("Slide 2 / 3");
});
