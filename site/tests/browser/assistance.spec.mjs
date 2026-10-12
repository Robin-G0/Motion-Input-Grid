import { test, expect } from "@playwright/test";
import { mockCamera, holdHandsInFrame, finishRibbonAnimation, swipeHand, focusPresentation } from "./support/camera.mjs";

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
    await expect(page.locator("#scroll-gesture-tip")).toBeHidden();
    await expect(page.locator("[data-assistance-gesture]")).toBeHidden();
    await next.click();
    await expect(assistant).toBeHidden();
    await expect(page.locator("#scroll-gesture-tip")).toBeHidden();
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
