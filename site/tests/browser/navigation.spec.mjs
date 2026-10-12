import { test, expect } from "@playwright/test";
import { mockCamera, holdHandsInFrame, finishRibbonAnimation, swipeHand, focusPresentation } from "./support/camera.mjs";

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
    const checkNumberScale = async name => {
        const originalViewport = page.viewportSize();
        for (const viewport of [{ width: 800, height: 600 }, { width: 1280, height: 720 }, { width: 2560, height: 1440 }]) {
            await page.setViewportSize(viewport);
            const gridWidth = await grid.evaluate(node => node.clientWidth);
            const fontSize = await cell(name).evaluate(node => parseFloat(getComputedStyle(node).fontSize));
            const firstFont = await cell("first").evaluate(node => parseFloat(getComputedStyle(node).fontSize));
            expect(fontSize).toBeCloseTo(firstFont, 1);
            expect(fontSize / gridWidth).toBeCloseTo(.08, 3);
        }
        await page.setViewportSize(originalViewport);
    };
    await expect(cell("cancel")).toBeHidden();
    await expect(cell("condition")).toBeHidden();
    await expect(grid.locator("button:visible")).toHaveCount(3);
    await expect(cell("trigger")).toHaveText("3");
    await checkNumberScale("trigger");
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
    await checkNumberScale("condition");
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
