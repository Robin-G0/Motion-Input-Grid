import { test, expect } from "@playwright/test";

// Feed a synthetic camera and replace only the MediaPipe bundle. The real Lite
// file from the published runtime is still downloaded and verified by SHA-256.
async function fakePoseCamera(page) {
    await page.addInitScript(() => {
        const canvas = document.createElement("canvas"); canvas.width = 640; canvas.height = 360;
        const context = canvas.getContext("2d");
        window.cameraTimer = setInterval(() => { context.fillStyle = "#17232a"; context.fillRect(0, 0, 640, 360); }, 40);
        navigator.mediaDevices.getUserMedia = async () => canvas.captureStream(25);
    });
    await page.route("**/mig/vision/vision_bundle.mjs", route => route.fulfill({ contentType: "text/javascript", body: `
        export const FilesetResolver = { forVisionTasks: async () => ({}) };
        export class PoseLandmarker {
            static async createFromOptions(files, options) {
                window.loadedModels = [...(window.loadedModels ?? []), options.baseOptions.modelAssetBuffer.byteLength];
                return new PoseLandmarker();
            }
            detectForVideo(image, time) {
                const points = Array.from({ length: 33 }, () => ({ x: .5, y: .5, visibility: 0 }));
                points[11] = { x: .6, y: .4, visibility: 1 }; points[12] = { x: .4, y: .4, visibility: 1 };
                points[15] = { x: .62 + (time % 2) * .002, y: .6, visibility: 1 }; points[16] = { x: .38, y: .6, visibility: 1 };
                return { landmarks: [points] };
            }
            close() { window.closedModels = (window.closedModels ?? 0) + 1; }
        }
    ` }));
    // Offline for the downloadable variants: the page must explain, not fail silently.
    await page.route("https://storage.googleapis.com/**", route => route.abort("internetdisconnected"));
}

test("the Models tab compares the bundled model live and explains offline downloads", async ({ page }) => {
    const errors = []; page.on("pageerror", error => errors.push(error.message));
    await fakePoseCamera(page);
    await page.goto("./");
    await page.getByRole("navigation").getByRole("link", { name: "Modèles" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Comparer les modèles BlazePose");
    const lite = page.locator('.model-card[data-model="lite"]');
    const heavy = page.locator('.model-card[data-model="heavy"]');
    await expect(lite.getByRole("checkbox")).toBeChecked();
    await expect(heavy.getByRole("checkbox")).not.toBeChecked();
    await expect(page.evaluate(() => window.loadedModels)).resolves.toBeUndefined();

    await page.locator("#start").click();
    await expect(page.locator("#message")).toContainText("Caméra active");
    await expect(lite.locator(".model-status")).toHaveText("Fourni · CPU");
    expect(await page.evaluate(() => window.loadedModels)).toEqual([5777746]);
    await expect(lite.locator('[data-metric="median"]')).toContainText("ms");
    await expect(lite.locator('[data-metric="coverage"]')).toHaveText(/67\s%/);
    await expect(lite.locator('[data-metric="wristJitter"]')).not.toHaveText("–");

    await heavy.getByRole("checkbox").check();
    await expect(heavy.locator(".model-status")).toContainText("indisponible hors ligne");
    await expect(heavy.locator(".model-status")).toHaveAttribute("data-error", "true");
    await expect(lite.locator(".model-status")).toHaveText("Fourni · CPU");

    await page.getByRole("button", { name: "EN", exact: true }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Compare BlazePose models");
    await expect(heavy.locator(".model-status")).toContainText("unavailable offline");

    await page.locator("#delegate").selectOption("GPU");
    await expect(lite.locator(".model-status")).toHaveText("Bundled · GPU");
    expect(await page.evaluate(() => window.closedModels)).toBe(1);

    await page.locator("#stop").click();
    await expect(page.locator("#start")).toBeVisible();
    await expect(page.locator("#message")).toHaveText("Camera stopped. Measurements are kept.");
    await lite.getByRole("checkbox").uncheck();
    await heavy.getByRole("checkbox").uncheck();
    await expect(heavy.locator(".model-status")).toHaveText("Not loaded");
    expect(await page.evaluate(() => window.closedModels)).toBe(2);
    await page.locator("#start").click();
    await expect(page.locator("#message")).toHaveText("Tick at least one model.");
    expect(errors).toEqual([]);
});

test("the Studio links to the Models page", async ({ page }) => {
    await page.goto("./studio/");
    await page.getByRole("button", { name: "FR", exact: true }).click();
    await page.getByRole("navigation").getByRole("link", { name: "Modèles" }).click();
    await expect(page).toHaveURL(/\/models\/$/);
});
