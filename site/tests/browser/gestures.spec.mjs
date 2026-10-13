import { test, expect } from "@playwright/test";
import { mockCamera, holdHandsInFrame, finishRibbonAnimation, swipeHand, focusPresentation } from "./support/camera.mjs";

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
    await expect(page.locator(".camera-preview")).toHaveCSS("outline-color", "rgb(103, 188, 148)");
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
    await page.clock.runFor(1000);
    await page.evaluate(() => window.demoCamera.frame(false));
    await expect(page.locator("#camera-recovery")).toBeVisible();
    await expect(page.locator("#camera-recovery")).toContainText("Please center your hands");
    await expect(page.locator("#away-screen")).toBeHidden();
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
