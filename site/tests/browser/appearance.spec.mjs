import { test, expect } from "@playwright/test";
import { mockCamera, holdHandsInFrame, swipeHand } from "./support/camera.mjs";

test("bilingual page, footer and controls work under the repository subpath", async ({ page }) => {
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.addInitScript(() => {
        const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
        window.cameraRequests = 0;
        navigator.mediaDevices.getUserMedia = (...args) => { ++window.cameraRequests; return original(...args); };
    });
    await page.goto("./");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Pilotez cette page d’un geste.");
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
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Control this page with a gesture.");
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
            const title = language === "fr" ? "Pilotez cette page d’un geste." : "Control this page with a gesture.";
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

test("small screens remain readable and touch navigation works", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("./");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.locator("#slide").dispatchEvent("pointerdown", { pointerType: "touch", pointerId: 1, clientX: 250, clientY: 100 });
    await page.locator("#slide").dispatchEvent("pointerup", { pointerType: "touch", pointerId: 1, clientX: 170, clientY: 350 });
    await expect(page.locator("#slide-counter")).toHaveText("Slide 1 / 3");
    await page.locator("#slide").dispatchEvent("pointerdown", { pointerType: "touch", pointerId: 1, clientX: 250 });
    await page.locator("#slide").dispatchEvent("pointerup", { pointerType: "touch", pointerId: 1, clientX: 80 });
    await expect(page.locator("#slide-counter")).toHaveText("Slide 2 / 3");
    await expect(page.locator("footer nav a[data-link=github]")).toHaveAttribute("href", "https://github.com/Robin-G0");
    await expect(page.locator("footer p a")).toHaveText("Robin-G0");
    await expect(page.locator("footer p a")).toHaveAttribute("href", "https://github.com/Robin-G0");
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

test("the welcome fills a large screen and introduces the camera only after the button is pressed", async ({ page }) => {
    await page.setViewportSize({ width: 2560, height: 1440 });
    await mockCamera(page);
    await page.clock.install();
    await page.goto("./");
    await page.getByRole("button", { name: "EN", exact: true }).click();
    await expect(page.locator(".camera-card")).toBeHidden();
    const title = await page.locator("h1").boundingBox();
    const study = await page.locator(".motion-study").boundingBox();
    expect(title.x + title.width).toBeLessThan(study.x);
    expect(study.x + study.width).toBeLessThanOrEqual(1880);
    const presentation = await page.locator("#presentation").boundingBox();
    expect(presentation.y).toBeGreaterThanOrEqual(1440);
    await page.locator("#start-camera").click();
    await expect(page.locator("#start-camera")).toBeHidden();
    await expect(page.locator(".camera-card")).toBeVisible();
    await expect(page.locator("#welcome")).toHaveClass(/camera-open/);
    await expect(page.locator(".motion-study")).toBeHidden();
    await expect(page.locator(".camera-preview")).toHaveCSS("outline-width", "3px");
    await holdHandsInFrame(page);
    const tip = page.locator("#scroll-gesture-tip");
    await expect(tip).toBeVisible();
    const bounds = await tip.boundingBox();
    expect(bounds.x + bounds.width / 2).toBeCloseTo(1280, 0);
    await expect(tip.locator('[data-text="scrollShort"]')).toHaveText("Raise your hand");
    expect(await tip.evaluate(node => getComputedStyle(node).animationName)).toBe("none");
    await page.emulateMedia({ reducedMotion: "reduce" });
    expect(await tip.evaluate(node => getComputedStyle(node).animationName)).toBe("none");
});

test("the welcome remains readable without horizontal overflow at phone and desktop widths", async ({ page }) => {
    await page.goto("./");
    for (const width of [320, 390, 800, 1280]) {
        await page.setViewportSize({ width, height: 844 });
        await expect(page.locator(".hero h1")).toHaveText("Pilotez cette page d’un geste.");
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
});

test("system palettes, square cells and the presentation remain usable", async ({ page }) => {
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
    await expect(page.locator(".carousel-track .slide")).toHaveCount(1);
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

test("theme touch interactions stay available during recovery and written gesture instructions remain visible", async ({ page }) => {
    await mockCamera(page);
    await page.clock.install();
    await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "dark" });
    await page.goto("./");
    await page.locator("#start-camera").click();
    await holdHandsInFrame(page);
    await swipeHand(page, "scroll_presentation");
    await expect(page.locator("#slide-gesture-tip .hand-left svg")).toHaveCSS("width", "28px");
    await expect(page.locator('#slide-gesture-tip [data-text="slideShort"]')).toBeVisible();
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
    await expect(page.locator(".brand-mark")).toHaveAttribute("src", "./favicon.svg");
    await expect(page.locator('link[rel="icon"][type="image/svg+xml"]')).toHaveAttribute("href", "./favicon.svg");
    await page.emulateMedia({ colorScheme: "dark" });
    await expect(page.locator(".brand-mark")).toHaveAttribute("src", "./favicon-dark.svg");
    await expect(page.locator('link[rel="icon"][type="image/svg+xml"]')).toHaveAttribute("href", "./favicon-dark.svg");
    await page.emulateMedia({ colorScheme: "light" });
    await page.getByRole("button", { name: "EN", exact: true }).click();
    await page.getByRole("button", { name: "Switch to dark theme" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(page.locator(".brand-mark")).toHaveAttribute("src", "./favicon-dark.svg");
    await expect(page.locator('link[rel="icon"][type="image/svg+xml"]')).toHaveAttribute("href", "./favicon-dark.svg");
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--paper").trim())).toBe("#0b101a");
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(page.locator(".brand-mark")).toHaveAttribute("src", "./favicon-dark.svg");
    await page.getByRole("button", { name: "FR", exact: true }).click();
    await page.locator("#theme-toggle").click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--paper").trim())).toBe("#f7f4ed");
    await expect(page.locator("#theme-toggle")).toHaveAttribute("aria-label", /sombre/);
    await page.emulateMedia({ colorScheme: "dark" });
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--paper").trim())).toBe("#f7f4ed");
    await expect(page.locator(".brand-mark")).toHaveAttribute("src", "./favicon.svg");
    await expect(page.locator('link[rel="icon"][type="image/svg+xml"]')).toHaveAttribute("href", "./favicon.svg");
    for (const name of ["favicon.svg", "favicon-dark.svg"]) {
        const response = await page.request.get(`./${name}`);
        expect(response.ok()).toBe(true);
    }
});
