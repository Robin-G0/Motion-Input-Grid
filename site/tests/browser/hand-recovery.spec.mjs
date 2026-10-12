import { test, expect } from "@playwright/test";
import { mockCamera, holdHandsInFrame, focusPresentation, swipeHand } from "./support/camera.mjs";

test("lost hands reveal the camera after four seconds and returning hands cannot navigate", async ({ page }) => {
    await mockCamera(page);
    await page.clock.install();
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("./");
    await page.getByRole("button", { name: "EN", exact: true }).click();
    await page.locator("#start-camera").click();
    await expect(page.locator("#camera-hand-targets .recovery-left")).toBeVisible();
    await expect(page.locator("#camera-hand-targets .recovery-right")).toBeVisible();
    await holdHandsInFrame(page);
    await focusPresentation(page);
    await expect(page.locator("#camera-hand-targets")).toBeHidden();
    const counter = await page.locator("#slide-counter").textContent();
    await page.evaluate(() => window.demoCamera.frame(false));
    await page.clock.runFor(600);
    await page.evaluate(() => window.demoCamera.frame(false));
    await expect(page.locator(".camera-card")).not.toHaveClass(/recovering-hands/);
    await expect(page.locator("#hands-tip")).toHaveCount(0);
    await page.clock.runFor(3399);
    await page.evaluate(() => window.demoCamera.frame(false));
    await expect(page.locator("#camera-recovery")).toBeHidden();
    await page.clock.runFor(1);
    await page.evaluate(() => window.demoCamera.frame(false));
    await expect(page.locator("#camera-recovery")).toBeVisible();
    await expect(page.locator("#camera-recovery")).toContainText("Please center your hands");
    const box = await page.locator(".camera-card").boundingBox();
    const viewport = page.viewportSize();
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
    expect(box.y + box.height).toBeCloseTo(viewport.height - 16, 0);
    await page.evaluate(() => { window.demoCamera.frame(true); window.demoCamera.action("next_slide"); });
    await page.clock.runFor(999);
    await page.evaluate(() => window.demoCamera.frame(true));
    await expect(page.locator("#camera-recovery")).toBeVisible();
    await page.clock.runFor(1);
    await page.evaluate(() => { window.demoCamera.frame(true); window.demoCamera.action("next_slide"); });
    await expect(page.locator("#camera-recovery")).toBeHidden();
    await expect(page.locator("#slide-counter")).toHaveText(counter);
    await swipeHand(page, "next_slide");
    await expect(page.locator("#slide-counter")).not.toHaveText(counter);
    await expect(page.locator("#slide-gesture-tip")).toBeHidden();
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await focusPresentation(page);
    await expect(page.locator("#slide-gesture-tip")).toBeHidden();
});

test("visible hands outside the centre must stay outside continuously for four seconds", async ({ page }) => {
    await mockCamera(page);
    await page.clock.install();
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("./");
    await page.locator("#start-camera").click();
    await holdHandsInFrame(page);
    await focusPresentation(page);
    const outside = () => {
        window.demoCamera.coordinate = index => ({ x: index === 15 ? .9 : .5, y: .5 });
        window.demoCamera.frame(true);
    };
    await page.evaluate(outside);
    await page.clock.runFor(3500);
    await page.evaluate(outside);
    await expect(page.locator("#camera-recovery")).toBeHidden();
    await page.evaluate(() => {
        window.demoCamera.coordinate = () => ({ x: .5, y: .5 });
        window.demoCamera.frame(true);
    });
    await page.evaluate(outside);
    await page.clock.runFor(3999);
    await page.evaluate(outside);
    await expect(page.locator("#camera-recovery")).toBeHidden();
    await page.clock.runFor(1);
    await page.evaluate(outside);
    await expect(page.locator("#camera-recovery")).toBeVisible();
    await expect(page.locator("#camera-recovery p")).toHaveText("Centrez vos mains");
});

test("the onboarding camera stays at the top through cooldown and guide rendering", async ({ page }) => {
    await mockCamera(page);
    await page.clock.install();
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("./");
    await page.locator("#start-assisted").click();
    await page.locator("[data-assistance-next]").click();
    await holdHandsInFrame(page);
    await expect(page.locator("#assistance")).toHaveAttribute("data-step", "right");
    await swipeHand(page, "previous_slide");
    await expect(page.locator("#assistance")).toHaveAttribute("data-step", "cooldown");
    const card = page.locator(".camera-card");
    await expect(card).toHaveClass(/tutorial-camera/);
    expect((await card.boundingBox()).y).toBeCloseTo(16, 0);
    await page.getByRole("button", { name: "EN", exact: true }).click();
    await expect(card).toHaveClass(/tutorial-camera/);
    await page.clock.runFor(2400);
    await expect(page.locator("#assistance")).toHaveAttribute("data-step", "left");
    await expect(card).toHaveClass(/tutorial-camera/);
    expect((await card.boundingBox()).y).toBeCloseTo(16, 0);
});

for (const viewport of [{ width: 390, height: 600 }, { width: 800, height: 450 }]) {
    test(`tutorial leaves the camera visible at ${viewport.width}x${viewport.height}`, async ({ page }) => {
        await page.setViewportSize(viewport);
        await mockCamera(page);
        await page.emulateMedia({ reducedMotion: "reduce" });
        await page.goto("./");
        await page.locator("#start-assisted").click();
        await page.locator("[data-assistance-next]").click();
        const camera = await page.locator(".camera-card").boundingBox();
        const bubble = await page.locator(".assistance-bubble").boundingBox();
        expect(camera.y).toBeGreaterThanOrEqual(0);
        expect(camera.y + camera.height).toBeLessThan(bubble.y);
        expect(bubble.y + bubble.height).toBeLessThanOrEqual(viewport.height);
    });
}
