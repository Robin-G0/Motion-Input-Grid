import { test, expect } from "@playwright/test";
import { mockCamera, holdHandsInFrame, swipeHand, focusPresentation } from "./support/camera.mjs";

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
    await expect(page).toHaveTitle("Motion Input Grid");
    await expect(page.locator('[data-text="finaleStar"]')).toHaveText("If you enjoyed the project, feel free to leave a ⭐ on GitHub!");
    await page.getByRole("button", { name: "FR", exact: true }).click();
    await expect(page).toHaveTitle("Motion Input Grid");
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
    await expect(page.locator("#away-screen")).toHaveCSS("transition-duration", "0.3s");
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
    await expect(page.locator("#scroll-gesture-tip")).toBeHidden();
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
