import { expect } from "@playwright/test";

// Feed simulated camera observations at the MIG boundary; never add a test mode
// or fake actions to the deployed page itself.
export async function mockCamera(page, failure = "") {
    await page.route("**/mig/session.mjs*", route => route.fulfill({
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

export async function holdHandsInFrame(page) {
    await expect(page.locator("#start-camera")).toBeHidden();
    await page.clock.pauseAt(new Date(await page.evaluate(() => Date.now() + 1000)));
    await page.evaluate(() => window.demoCamera.frame(true));
    for (let index = 0; index < 5; index++) {
        await page.clock.runFor(200);
        await page.evaluate(() => window.demoCamera.frame(true));
    }
}


// CSS/Web Animations have a separate timeline from Playwright's simulated timers.
export async function finishRibbonAnimation(page) {
    await page.evaluate(() => {
        for (const animation of document.querySelector(".carousel-track").getAnimations({ subtree: true })) {
            if (Number.isFinite(animation.effect.getComputedTiming().endTime)) animation.finish();
        }
    });
}

export async function swipeHand(page, action, landmark = 15, wait = true) {
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

export async function focusPresentation(page) {
    await page.locator("#presentation h2").evaluate(node => window.scrollTo({ top: scrollY + node.getBoundingClientRect().top - 16, behavior: "instant" }));
}
