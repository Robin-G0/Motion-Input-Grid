import { fakeStudioCamera as fakeObservations } from "./support/studio-camera.mjs";
import { test, expect } from "@playwright/test";
import { starter } from "../../studio/src/profile.mjs";
import { readFile } from "node:fs/promises";

async function openStudio(page, screen = "edit") {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("./studio/");
    await page.getByRole("button", { name: "FR", exact: true }).click();
    await expect(page.locator("#start-menu")).toBeVisible();
    await expect(page.locator("#workspace")).toBeHidden();
    if (screen === "home") return;
    await page.locator("#import-file").setInputFiles({name:"example.json",mimeType:"application/json",buffer:Buffer.from(JSON.stringify(starter()))});
    await expect(page.locator("#moves-panel")).toBeVisible();
    await page.locator("#tab-edit").click();
    await page.locator("#full-grid").uncheck();
    await page.locator("#landmark").selectOption("left_wrist");
    if (screen === "test") await page.locator("#tab-test").click();
    await expect(page.locator("#editor-grid button")).toHaveCount(324);
}

test("Studio draws with pointer and keyboard, supports undo, restores drafts and exports real MIG JSON", async ({ page }) => {
    const errors = []; page.on("pageerror", error => errors.push(error.message));
    await openStudio(page);
    await page.locator("#back-menu").click();
    await page.locator("#new-profile").click(); await page.locator("#add-drawn-input").click(); await page.locator("#landmark").selectOption("left_wrist");
    await expect(page.locator(".grid-region")).toHaveCount(0);
    await page.locator("#input-name").fill("Mon parcours"); await page.locator("#input-name").press("Tab");
    const first = page.locator('#editor-grid button[data-x="2"][data-y="4"]');
    const second = page.locator('#editor-grid button[data-x="3"][data-y="4"]');
    await first.scrollIntoViewIfNeeded();
    const a = await first.boundingBox(), b = await second.boundingBox();
    await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2); await page.mouse.down();
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2); await page.mouse.up();
    await expect(page.locator(".grid-region.required")).toHaveCount(1);
    await expect(page.locator("#region-count")).toHaveText("1");
    await page.locator('[data-tool="trigger"]').click();
    const trigger = page.locator('#editor-grid button[data-x="2"][data-y="2"]');
    await trigger.focus(); await trigger.press("Enter");
    await expect(page.locator(".grid-region.trigger")).toHaveCount(1);
    await page.locator("#undo").click(); await expect(page.locator(".grid-region.trigger")).toHaveCount(0);
    await page.locator("#redo").click(); await expect(page.locator(".grid-region.trigger")).toHaveCount(1);
    const downloading = page.waitForEvent("download");
    await page.locator("#export-profile").click(); const download = await downloading;
    expect(download.suggestedFilename()).toBe("mig-profile.json");
    await expect(page.locator("#feedback")).toContainText("validée et exportée");
    await page.reload(); await expect(page.locator("#resume-profile")).toBeVisible();
    await page.locator("#resume-profile").click(); await page.locator(".movement-card button").first().click();
    await expect(page.locator("#input-name")).toHaveValue("Mon parcours");
    await expect(page.locator(".grid-region")).toHaveCount(2);
    expect(errors).toEqual([]);
});

test("unfinished local drafts and pending names survive reload and reopening without fetching the native validator", async ({ page }) => {
    await openStudio(page,"home"); await page.locator("#new-profile").click(); await page.locator("#add-drawn-input").click(); await page.locator("#landmark").selectOption("left_wrist");
    await page.locator("#editor-note-toggle").click();
    await page.locator('#editor-grid button[data-x="3"][data-y="3"]').click();
    await page.locator("#input-name").fill("Brouillon incomplet");
    await page.context().route("**/mig/mig-tracker.mjs", route => route.abort());
    await page.reload();
    await expect(page.locator("#resume-profile")).toBeVisible();
    await page.locator("#resume-profile").click(); await page.locator(".movement-card button").first().click();
    await expect(page.locator("#input-name")).toHaveValue("Brouillon incomplet");
    await expect(page.locator(".grid-region")).toHaveCount(0);
    await expect(page.locator(".grid-note")).toHaveCount(1);
    const reopened = await page.context().newPage(); await page.close();
    await reopened.goto("./studio/"); await reopened.getByRole("button",{name:"FR",exact:true}).click();
    await expect(reopened.locator("#resume-profile")).toBeVisible();
    await reopened.locator("#resume-profile").click();
    await expect(reopened.locator(".movement-card h3")).toHaveText("Brouillon incomplet");
    await expect(reopened.locator("#feedback")).toBeHidden();
});

test("damaged local drafts show recovery feedback and retain their saved data", async ({ page }) => {
    const saved = JSON.stringify({schema_version:2,inputs:[null]});
    const errors = []; page.on("pageerror",error => errors.push(error.message));
    await page.addInitScript(saved => localStorage.setItem("mig-studio-profile-v2",saved), saved);
    await page.goto("./studio/"); await page.getByRole("button",{name:"FR",exact:true}).click();
    await expect(page.locator("#feedback")).toContainText("endommagé");
    await expect(page.locator("#resume-profile")).toBeHidden();
    expect(await page.evaluate(() => localStorage.getItem("mig-studio-profile-v2"))).toBe(saved);
    expect(errors).toEqual([]);
});

test("invalid imports and JSON edits preserve the current profile; advanced imports keep all options", async ({ page }) => {
    await openStudio(page);
    const original = await page.locator("#input-name").inputValue();
    for (const data of ["{", '{"schema_version":1,"inputs":[]}', '{"schema_version":2,"inputs":[],"unknown":true}']) {
        await page.locator("#import-file").setInputFiles({ name: "profile.json", mimeType: "application/json", buffer: Buffer.from(data) });
        await expect(page.locator("#feedback")).toHaveAttribute("data-error", "true");
        await expect(page.locator("#input-name")).toHaveValue(original);
    }
    const advanced = { schema_version: 2, tracking: { hands: false }, inputs: [{ id: "custom", name: "Profil avancé", action: "custom_action", space: "calibrated", keyboard: [{ text: "Text preserved" }], steps: [{ id: "s", mode: "ordered", constraints: [
        { id: "start", landmark: "right_wrist", cell: [-5, 4, 3, 1], type: "required", priority: "high", order: 1 },
        { id: "finish", landmark: "right_wrist", cell: [-5, 2, 3, 1], type: "trigger", priority: "high", order: 2 }
    ] }] }] };
    await page.locator("#import-file").setInputFiles({ name: "advanced.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(advanced)) });
    await expect(page.locator("#input-name")).toHaveValue("Profil avancé");
    await expect(page.locator("#full-grid")).toBeChecked();
    await expect(page.locator("#editor-grid button")).toHaveCount(729);
    await page.locator(".movement-card button").first().click();
    await page.locator("#input-name").fill("Renamed"); await page.locator("#input-name").press("Tab");
    await page.locator("#open-json").click();
    let edited = JSON.parse(await page.locator("#json-source").inputValue());
    expect(edited.inputs[0].keyboard).toEqual(advanced.inputs[0].keyboard);
    await page.locator("#json-source").fill('{"schema_version":2,"inputs":[],"unknown":true}');
    await page.locator("#apply-json").click(); await expect(page.locator("#json-error")).toBeVisible();
    await expect(page.locator("#json-dialog")).toBeVisible();
    await page.locator("#cancel-json").click(); await expect(page.locator("#input-name")).toHaveValue("Renamed");
    await page.locator("#undo").click(); await expect(page.locator("#input-name")).toHaveValue("Profil avancé");
    await page.locator("#undo").click(); await expect(page.locator("#input-name")).toHaveValue(original);
});

test("the live Studio uses native recognition, filters logs, applies edits and releases the camera", async ({ page }) => {
    await fakeObservations(page);
    await openStudio(page, "test");
    await page.locator("#start-test").click();
    await expect(page.locator("#live-badge")).toHaveAttribute("data-live", "true");
    await expect(page.locator("#camera-message")).toContainText("Suivi actif", { timeout: 15000 });
    const zoneOpacity = y => page.locator("#camera-overlay").evaluate((canvas, y) => canvas.getContext("2d").getImageData(Math.floor(canvas.width * .45), Math.floor(canvas.height * y), 1, 1).data[3], y);
    await expect.poll(() => zoneOpacity(.60)).toBeGreaterThan(80);
    await page.evaluate(() => { window.studioWristY = .45; });
    // Allow the selected pose to reach the actual session before the next one.
    await expect.poll(() => page.locator("#camera-overlay").evaluate(canvas => canvas.width)).toBe(960);
    await page.waitForTimeout(150);
    await page.evaluate(() => { window.studioWristY = .29; });
    await expect(page.locator('#log-list [data-level="action"]')).toContainText("hand_raised");
    await expect.poll(() => zoneOpacity(.20)).toBeGreaterThan(80);
    await expect.poll(() => zoneOpacity(.60)).toBe(51);
    await expect(page.locator("#action-count")).toHaveText("1 Action émise");
    await expect(page.locator("#log-list li")).toHaveCount(1);
    await page.locator("#log-level").selectOption("info");
    await expect(page.locator('#log-list [data-level="info"]')).not.toHaveCount(0);
    await page.locator("#log-level").selectOption("debug");
    await expect(page.locator('#log-list [data-level="debug"]').first()).toContainText("left_wrist");
    await page.locator("#log-level").selectOption("actions");
    await expect(page.locator("#log-list li")).toHaveCount(1);
    await page.locator("#test-edit").click();
    await page.locator("#input-name").fill("Edited live"); await page.locator("#input-name").press("Tab");
    await expect(page.locator("#live-badge")).toHaveAttribute("data-live", "true");
    expect(await page.evaluate(() => window.studioStream.getTracks().every(track => track.readyState === "live"))).toBe(true);
    await expect(page.locator("#camera-message")).toContainText("Profil actualisé");
    await page.locator("#tab-test").click();
    await page.locator("#clear-logs").click(); await expect(page.locator("#log-empty")).toBeVisible();
    await expect(page.locator("#live-badge")).toHaveAttribute("data-live", "true");
    await page.locator("#stop-test").click();
    expect(await page.evaluate(() => window.studioStream.getTracks().every(track => track.readyState === "ended"))).toBe(true);
});

test("the welcome menu and screen tabs reveal only the current task without requesting a camera", async ({ page }) => {
    await fakeObservations(page);
    await openStudio(page, "home");
    for (const id of ["import-profile", "new-profile", "quick-test"]) await expect(page.locator(`#${id}`)).toBeVisible();
    expect(await page.evaluate(() => !!window.studioStream)).toBe(false);
    await page.locator("#quick-test").click();
    await expect(page.locator("#editor-panel")).toBeVisible();
    await expect(page.locator("#pipeline-guide")).toBeVisible();
    await expect(page.locator("#test-panel")).toBeHidden();
    expect(await page.evaluate(() => !!window.studioStream)).toBe(false);
    await page.locator("#leave-guide").click();
    await page.locator("#tab-edit").focus(); await page.keyboard.press("Home");
    await expect(page.locator("#tab-moves")).toBeFocused();
    await expect(page.locator("#moves-panel")).toBeVisible();
    await expect(page.locator("#test-panel")).toBeHidden();
    await page.keyboard.press("ArrowRight");
    await expect(page.locator("#editor-panel")).toBeVisible();
    await expect(page.locator("#moves-panel")).toBeHidden();
    await page.locator("#back-menu").click();
    await expect(page.locator("#resume-profile")).toBeVisible();
});

test("zone details focus finger conditions and retain both hands and timing in valid exported JSON", async ({ page }) => {
    await openStudio(page);
    await page.locator("#region-list button").first().click();
    await expect(page.locator("#region-dialog")).toBeVisible();
    await expect(page.locator("#detail-position-tab")).toBeFocused();
    await page.locator("#region-w").fill("27");
    await page.locator("#region-x").fill("17"); await page.locator("#region-x").press("Tab");
    await expect(page.locator("#region-error")).toContainText("doit rester dans la grille");
    await expect(page.locator("#region-x")).toHaveValue("-9");
    await page.locator("#detail-fingers-tab").click();
    await expect(page.locator("#detail-position")).toBeHidden();
    const thumb = page.locator('select[data-finger="thumb"]');
    await thumb.selectOption("extended");
    await expect(page.locator("#region-error")).toBeHidden();
    await page.locator(".finger-row").first().locator("summary").click();
    const stable = page.locator('input[data-finger="thumb"][data-timing="stable_ms"]');
    await stable.fill("200"); await stable.press("Tab");
    await page.locator("#finger-hand").selectOption("right");
    await thumb.selectOption("closed");
    await page.locator("#finger-hand").selectOption("left");
    await expect(thumb).toHaveValue("extended");
    await expect(stable).toHaveValue("200");
    await page.locator("#done-region").click();
    await expect(page.locator("#region-dialog")).toBeHidden();
    await expect(page.locator("#track-hands")).toBeChecked();
    await page.locator("#open-json").click();
    const profile = JSON.parse(await page.locator("#json-source").inputValue());
    expect(profile.inputs[0].steps[0].constraints[0].fingers).toEqual(expect.arrayContaining([
        expect.objectContaining({hand:"left", finger:"thumb", pose:"extended", stable_ms:200}),
        expect.objectContaining({hand:"right", finger:"thumb", pose:"closed"})
    ]));
    await page.locator("#cancel-json").click();
    const downloading = page.waitForEvent("download");
    await page.locator("#export-profile").click(); await downloading;
    await expect(page.locator("#feedback")).toContainText("validée et exportée");
});

test("live grid notes survive editing and reload without changing the profile and can be erased", async ({ page }) => {
    await fakeObservations(page);
    await openStudio(page, "test");
    const original = await page.evaluate(() => localStorage.getItem("mig-studio-profile-v2"));
    await page.locator("#start-test").click();
    await expect(page.locator("#camera-message")).toContainText("Suivi actif", {timeout:15000});
    await expect(page.locator("#camera-draft-hint")).toBeHidden();
    await page.locator("#test-note-toggle").click();
    const bounds = await page.locator("#camera-overlay").boundingBox();
    // The mirrored body grid is anchored on the shoulders: [4,4] to [6,4].
    await page.mouse.move(bounds.x + bounds.width * .5, bounds.y + bounds.height * .53);
    await page.mouse.down();
    await page.mouse.move(bounds.x + bounds.width * .38, bounds.y + bounds.height * .53, {steps:6});
    await page.mouse.up();
    await expect(page.locator("#test-note-count")).toContainText("3");
    await page.locator("#test-edit").click();
    await expect(page.locator("#grid-notes .grid-note")).toHaveCount(3);
    await expect(page.locator('#editor-grid button[data-x="4"][data-y="4"]')).toHaveAttribute("aria-label", /Case annotée/);
    await expect(page.locator("#header-stop")).toBeVisible();
    await page.waitForTimeout(150);
    const pausedCount = await page.evaluate(() => window.studioInferenceCount);
    await page.waitForTimeout(180);
    expect(await page.evaluate(() => window.studioInferenceCount)).toBe(pausedCount);
    expect(await page.evaluate(() => localStorage.getItem("mig-studio-profile-v2"))).toBe(original);
    await page.locator("#editor-note-erase").click();
    await page.locator('#editor-grid button[data-x="4"][data-y="4"]').click();
    await expect(page.locator("#grid-notes .grid-note")).toHaveCount(2);
    await page.locator("#back-menu").click();
    expect(await page.evaluate(() => window.studioStream.getTracks().every(track => track.readyState === "ended"))).toBe(true);
    await page.reload(); await page.locator("#resume-profile").click();
    await page.locator(".movement-card button").first().click();
    await expect(page.locator("#grid-notes .grid-note")).toHaveCount(2);
    await page.locator("#clear-editor-notes").click();
    await expect(page.locator("#grid-notes .grid-note")).toHaveCount(0);
    expect(await page.evaluate(() => localStorage.getItem("mig-studio-profile-v2"))).toBe(original);
});

test("editor mirrors coordinates, drawing and arrow navigation to match the camera setting", async ({ page }) => {
    await openStudio(page);
    const cell = x => page.locator(`#editor-grid button[data-x="${x}"][data-y="4"]`);
    await cell(4).scrollIntoViewIfNeeded();
    let a = await cell(4).boundingBox(), b = await cell(5).boundingBox();
    expect(b.x).toBeLessThan(a.x);
    await cell(4).focus(); await page.keyboard.press("ArrowLeft");
    await expect(cell(5)).toBeFocused();
    await page.locator("#editor-note-toggle").click();
    await cell(4).click();
    const note = page.locator("#grid-notes .grid-note").first();
    expect((await note.boundingBox()).x).toBeCloseTo((await cell(4).boundingBox()).x, 0);
    await page.locator("#editor-camera-toggle").check();
    await page.locator(".preview-settings summary").click();
    await page.locator("#mirror-preview").uncheck();
    await page.locator("#editor-camera-toggle").uncheck(); await page.locator("#zoom-reset").click();
    await cell(4).scrollIntoViewIfNeeded();
    a = await cell(4).boundingBox(); b = await cell(5).boundingBox();
    expect(b.x).toBeGreaterThan(a.x);
    expect((await note.boundingBox()).x).toBeCloseTo(a.x, 0);
    await cell(4).focus(); await page.keyboard.press("ArrowRight");
    await expect(cell(5)).toBeFocused();
});

test("camera starts in an empty editor, stays active across views and applies edits without reopening capture", async ({ page }) => {
    await fakeObservations(page);
    await openStudio(page, "home");
    await page.locator("#new-profile").click(); await page.locator("#add-drawn-input").click(); await page.locator("#landmark").selectOption("left_wrist");
    await page.locator("#editor-camera-toggle").check();
    await expect(page.locator("#editor-camera #test-stage")).toBeVisible();
    await expect(page.locator(".grid-viewport")).toBeHidden();
    await page.locator("#start-test").click();
    await expect(page.locator("#camera-message")).toContainText("Suivi actif", {timeout:15000});
    await expect(page.locator("#camera-draft-hint")).toBeVisible();
    await page.evaluate(() => { window.originalStudioStream = window.studioStream; });
    await page.locator("#editor-camera-toggle").uncheck(); await page.locator("#zoom-reset").click();
    await page.locator('#editor-grid button[data-x="4"][data-y="4"]').click();
    await expect(page.locator(".grid-region.required")).toHaveCount(1);
    await page.locator("#editor-camera-toggle").check();
    await expect(page.locator("#camera-message")).toContainText("Suivi actif", {timeout:15000});
    await expect.poll(() => page.evaluate(() => window.studioInferenceCount)).toBeGreaterThan(15);
    await page.locator("#editor-note-toggle").click();
    const bounds = await page.locator("#camera-overlay").boundingBox();
    await page.mouse.click(bounds.x + bounds.width * .5, bounds.y + bounds.height * .53);
    await expect(page.locator("#editor-note-count")).toContainText("1");
    await page.locator("#tab-test").click();
    await expect(page.locator("#test-panel #test-stage")).toBeVisible();
    await page.locator("#test-edit").click();
    await expect(page.locator("#editor-camera #test-stage")).toBeVisible();
    expect(await page.evaluate(() => window.originalStudioStream === window.studioStream && window.studioStream.getTracks().every(track => track.readyState === "live"))).toBe(true);
    await page.locator("#stop-test").click();
    expect(await page.evaluate(() => window.studioStream.getTracks().every(track => track.readyState === "ended"))).toBe(true);
});

test("camera refusal offers recovery and leaves editing available", async ({ page }) => {
    await fakeObservations(page, "Permission denied");
    await openStudio(page, "test");
    await page.locator("#start-test").click();
    await expect(page.locator("#camera-message")).toContainText("Autorisez-le");
    await expect(page.locator("#start-test")).toBeEnabled();
    await expect(page.locator("#input-name")).toBeEnabled();
    await page.evaluate(() => { window.cameraFailure = ""; });
    await page.locator("#start-test").click(); await expect(page.locator("#live-badge")).toHaveAttribute("data-live", "true");
    await page.locator("#stop-test").click();
});

test("a cancelled model load cannot reopen the camera or lock the editor", async ({ page }) => {
    await fakeObservations(page);
    let release;
    const pending = new Promise(resolve => { release = resolve; });
    await page.route("**/mig/models.mjs", async route => { await pending; await route.fallback(); });
    await openStudio(page);
    await page.locator("#editor-camera-toggle").check();
    await page.locator("#start-test").click();
    await expect(page.locator("#stop-test")).toBeVisible();
    await page.locator("#editor-camera-toggle").uncheck();
    await page.locator("#header-stop").click();
    release();
    await expect(page.locator("#start-test")).toBeEnabled();
    await expect(page.locator("#input-name")).toBeEnabled();
    await expect(page.locator("#live-badge")).toHaveAttribute("data-live", "false");
    await page.locator("#editor-camera-toggle").check();
    await page.locator("#start-test").click();
    await expect(page.locator("#live-badge")).toHaveAttribute("data-live", "true");
    await page.locator("#stop-test").click();
    expect(await page.evaluate(() => window.studioStream.getTracks().every(track => track.readyState === "ended"))).toBe(true);
});

for (const [width, height] of [[1920, 1080], [1080, 1920]]) {
    test(`Studio loads real models and preserves ${width}x${height} camera framing`, async ({ page }) => {
        const errors = []; page.on("pageerror", error => errors.push(error.message));
        await page.addInitScript(({ width, height }) => {
            const canvas = document.createElement("canvas"); canvas.width = width; canvas.height = height;
            const context = canvas.getContext("2d");
            window.studioVideoTimer = setInterval(() => context.fillRect(0, 0, width, height), 100);
            navigator.mediaDevices.getUserMedia = async () => {
                window.studioStream = canvas.captureStream(10); return window.studioStream;
            };
        }, { width, height });
        await openStudio(page, "test");
        await page.locator("#start-test").click();
        await expect(page.locator("#live-badge")).toHaveAttribute("data-live", "true", { timeout: 30000 });
        await expect.poll(() => page.locator("#camera-overlay").evaluate(canvas => canvas.height)).not.toBe(150);
        const bounds = await page.locator("#test-stage").boundingBox();
        expect(bounds.width / bounds.height).toBeCloseTo(width / height, 1);
        const size = await page.locator("#camera-overlay").evaluate(canvas => ({ width: canvas.width, height: canvas.height }));
        expect(Math.max(size.width, size.height)).toBeLessThanOrEqual(960);
        expect(size.width / size.height).toBeCloseTo(width / height, 2);
        await page.locator("#stop-test").click();
        expect(await page.evaluate(() => window.studioStream.getTracks().every(track => track.readyState === "ended"))).toBe(true);
        await page.evaluate(() => clearInterval(window.studioVideoTimer));
        expect(errors).toEqual([]);
    });
}

test("the expanded grid preserves square size and keeps drawing and scrolling inside the page", async ({ page }) => {
    await openStudio(page);
    for (const viewport of [{width:1440,height:1100}, {width:390,height:844}]) {
        await page.setViewportSize(viewport);
        await page.locator("#full-grid").uncheck();
        const column = await page.locator(".drawing-column").boundingBox();
        if (viewport.width > 660) {
            const sidebar = await page.locator(".edit-sidebar").boundingBox();
            expect(sidebar.x).toBeGreaterThan(column.x + column.width);
        }
        const expected = viewport.width <= 660 ? column.width / 9 : Math.min(column.width, Math.max(280, viewport.height - 500)) / 9;
        const square = await page.locator("#editor-grid button").first().boundingBox();
        const area = await page.locator(".drawing-area").boundingBox();
        expect(square.width).toBeCloseTo(expected, 0);
        expect(square.height).toBeCloseTo(expected, 0);
        expect(area.width).toBeCloseTo(square.width * 18, 0);
        expect(area.height).toBeCloseTo(square.height * 18, 0);
        await page.locator("#full-grid").check();
        const fullSquare = await page.locator("#editor-grid button").first().boundingBox();
        expect(fullSquare.width).toBeCloseTo(square.width, 0);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
});

test("horizontal scrollbar reaches distant cells and both shoulder markers follow the mirror", async ({ page }) => {
    await page.setViewportSize({width:1440,height:1100});
    await openStudio(page);
    await expect(page.locator('[data-shoulder="left"]')).toHaveAttribute("aria-label", /Épaule gauche \[7.0, 3.5\]/);
    await expect(page.locator('[data-shoulder="right"]')).toHaveAttribute("aria-label", /Épaule droite \[2.0, 3.5\]/);
    const a = await page.locator('[data-shoulder="left"]').boundingBox(), b = await page.locator('[data-shoulder="right"]').boundingBox();
    expect(a.x).toBeLessThan(b.x);
    await expect(page.locator("#grid-scroll-x")).toHaveCount(0);
    await page.locator(".grid-viewport").focus();
    for (let i = 0; i < 4; i++) await page.keyboard.press("ArrowRight");
    await expect.poll(() => page.locator(".grid-viewport").evaluate(node => Math.round(node.scrollLeft))).toBeGreaterThan(100);
    // Wait for the browser's keyboard scroll animation before resetting its position.
    await expect.poll(async () => {
        const before = await page.locator(".grid-viewport").evaluate(node => node.scrollLeft);
        await page.waitForTimeout(100);
        return await page.locator(".grid-viewport").evaluate(node => node.scrollLeft) === before;
    }).toBe(true);
    await page.locator(".grid-viewport").evaluate(node => node.scrollTo({left:0,behavior:"instant"}));
    await expect.poll(() => page.locator(".grid-viewport").evaluate(node => node.scrollLeft)).toBe(0);
});

test("selection moves by an edge, resizes by a mirrored corner, cancels and supports undo", async ({ page }) => {
    await openStudio(page, "home");
    await page.locator("#new-profile").click(); await page.locator("#add-drawn-input").click(); await page.locator("#landmark").selectOption("left_wrist");
    const cell = (x,y) => page.locator(`#editor-grid button[data-x="${x}"][data-y="${y}"]`);
    await cell(3,3).scrollIntoViewIfNeeded();
    let a = await cell(3,3).boundingBox(), b = await cell(4,4).boundingBox();
    await page.mouse.move(a.x+a.width/2,a.y+a.height/2); await page.mouse.down();
    await page.mouse.move(b.x+b.width/2,b.y+b.height/2); await page.mouse.up();
    await page.locator('[data-tool="select"]').click();
    await expect(page.locator(".region-handles")).toBeVisible();
    const coordinates = () => page.locator(".region-coordinate").first();
    await expect(coordinates()).toHaveText("[3, 3, 2, 2]");
    const edge = page.locator('.handle-edge[data-corner="n"]');
    await edge.evaluate(node => node.scrollIntoView({block:"center",inline:"center"}));
    a = await edge.boundingBox(); const unit = (await cell(3,3).boundingBox()).width;
    await page.mouse.move(a.x+a.width/2,a.y+a.height/2); await page.mouse.down();
    await page.mouse.move(a.x+a.width/2-unit,a.y+a.height/2+unit); await page.mouse.up();
    await expect(coordinates()).toHaveText("[4, 4, 2, 2]");
    const corner = page.locator('.handle-corner[data-corner="sw"]');
    await corner.evaluate(node => node.scrollIntoView({block:"center",inline:"center"}));
    a = await corner.boundingBox();
    await page.mouse.move(a.x+a.width/2,a.y+a.height/2); await page.mouse.down();
    await page.mouse.move(a.x+a.width/2-unit,a.y+a.height/2+unit); await page.mouse.up();
    await expect(coordinates()).toHaveText("[4, 4, 3, 3]");
    await page.locator("#undo").click(); await expect(coordinates()).toHaveText("[4, 4, 2, 2]");
    await cell(4,4).click();
    await edge.evaluate(node => node.scrollIntoView({block:"center",inline:"center"}));
    a = await edge.boundingBox();
    await page.mouse.move(a.x+a.width/2,a.y+a.height/2); await page.mouse.down();
    await page.mouse.move(a.x+a.width/2-unit,a.y+a.height/2+unit);
    await page.locator(".handle-edge").first().focus(); await page.keyboard.press("Escape"); await page.mouse.up();
    await expect(coordinates()).toHaveText("[4, 4, 2, 2]");
    await edge.focus(); await page.keyboard.press("ArrowLeft");
    await expect(coordinates()).toHaveText("[5, 4, 2, 2]");
});

test("cell pencil draws a diagonal stroke and eraser removes cells without changing MIG regions", async ({ page }) => {
    await openStudio(page);
    await page.locator("#editor-note-toggle").click();
    const cell = (x,y) => page.locator(`#editor-grid button[data-x="${x}"][data-y="${y}"]`);
    await cell(4,4).scrollIntoViewIfNeeded();
    const a = await cell(4,4).boundingBox(), b = await cell(6,6).boundingBox();
    await page.mouse.move(a.x+a.width/2,a.y+a.height/2); await page.mouse.down();
    await page.mouse.move(b.x+b.width/2,b.y+b.height/2); await page.mouse.up();
    await expect(page.locator(".grid-note")).toHaveCount(3);
    await expect(page.locator(".grid-region")).toHaveCount(2);
    await page.locator("#editor-note-erase").click(); await cell(5,5).click();
    await expect(page.locator(".grid-note")).toHaveCount(2);
    await page.locator("#clear-editor-notes").click(); await expect(page.locator(".grid-note")).toHaveCount(0);
});

test("copy and paste select the new region for immediate resizing and keyboard undo/redo", async ({ page }) => {
    await openStudio(page, "home"); await page.locator("#new-profile").click(); await page.locator("#add-drawn-input").click(); await page.locator("#landmark").selectOption("left_wrist");
    const cell = page.locator('#editor-grid button[data-x="3"][data-y="3"]');
    await cell.click(); await cell.focus();
    await page.keyboard.press("Control+c");
    await expect(page.locator("#feedback")).toContainText("Zone copiée");
    await page.keyboard.press("Control+v");
    await expect(page.locator(".grid-region")).toHaveCount(2);
    await expect(page.locator('[data-tool="select"]')).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(".region-handles")).toBeVisible();
    await expect(page.locator(".region-coordinate").last()).toHaveText("[2, 4, 1, 1]");
    const profile = await page.evaluate(() => JSON.parse(localStorage.getItem("mig-studio-profile-v2")));
    expect(profile.inputs[0].steps[0].constraints[0].id).not.toBe(profile.inputs[0].steps[0].constraints[1].id);
    await page.locator('.handle-corner[data-corner="sw"]').focus(); await page.keyboard.press("ArrowLeft");
    await expect(page.locator(".region-coordinate").last()).toHaveText("[2, 4, 2, 1]");
    await page.keyboard.press("Control+z");
    await expect(page.locator(".region-coordinate").last()).toHaveText("[2, 4, 1, 1]");
    await page.keyboard.press("Control+z"); await expect(page.locator(".grid-region")).toHaveCount(1);
    await page.keyboard.press("Control+y"); await expect(page.locator(".grid-region")).toHaveCount(2);
    await expect(page.locator(".region-handles")).toBeVisible();
    await page.keyboard.press("Control+z"); await expect(page.locator(".grid-region")).toHaveCount(1);
    await page.keyboard.press("Control+Shift+z"); await expect(page.locator(".grid-region")).toHaveCount(2);
    await expect(page.locator(".region-handles")).toBeVisible();
    await page.locator("#input-name").focus();
    await page.keyboard.press("Control+a"); await page.keyboard.press("Control+c"); await page.keyboard.press("Control+v");
    await page.keyboard.press("Control+z");
    await expect(page.locator(".grid-region")).toHaveCount(2);
});

test("pasting from camera editing returns to the grid with handles, while invalid duplicates preserve the profile", async ({ page }) => {
    await openStudio(page);
    await page.locator("#region-list button").first().click(); await page.locator("#done-region").click();
    await page.locator("#editor-camera-toggle").check();
    await page.keyboard.press("Control+c"); await page.keyboard.press("Control+v");
    await expect(page.locator(".grid-region")).toHaveCount(3);
    await expect(page.locator(".grid-viewport")).toBeVisible();
    await expect(page.locator("#editor-camera")).toBeHidden();
    await expect(page.locator(".region-handles")).toBeVisible();
    await page.locator("#region-list button").nth(1).click(); await page.locator("#done-region").click();
    await page.keyboard.press("Control+c"); await page.keyboard.press("Control+v");
    await expect(page.locator("#feedback")).toHaveAttribute("data-error", "true");
    await expect(page.locator(".grid-region")).toHaveCount(3);
});

test("Ctrl+A selects and moves the step's regions together, supports copying the group and leaves text selection native", async ({ page }) => {
    await openStudio(page,"home"); await page.locator("#new-profile").click(); await page.locator("#add-drawn-input").click(); await page.locator("#landmark").selectOption("left_wrist");
    for (const x of [3,5]) await page.locator(`#editor-grid button[data-x="${x}"][data-y="3"]`).click();
    await page.keyboard.press("Control+a");
    await expect(page.locator(".grid-region.selected")).toHaveCount(2);
    await expect(page.locator(".region-handles")).toBeVisible();
    const edge = page.locator('.handle-edge[data-corner="n"]');
    await edge.focus(); await page.keyboard.press("ArrowRight");
    await expect(page.locator(".region-coordinate").first()).toHaveText("[2, 3, 1, 1]");
    await expect(page.locator(".region-coordinate").last()).toHaveText("[4, 3, 1, 1]");
    await page.keyboard.press("Control+z");
    await expect(page.locator(".region-coordinate").first()).toHaveText("[3, 3, 1, 1]");
    await expect(page.locator(".grid-region.selected")).toHaveCount(2);
    await page.locator('.handle-corner[data-corner="sw"]').focus();
    await page.keyboard.press("ArrowRight"); await page.keyboard.press("ArrowRight");
    await expect(page.locator(".region-coordinate").first()).toHaveText("[3, 3, 1, 1]");
    await expect(page.locator(".region-coordinate").last()).toHaveText("[3, 3, 1, 1]");
    await page.keyboard.press("Control+z"); await page.keyboard.press("Control+z");
    await expect(page.locator(".region-coordinate").last()).toHaveText("[5, 3, 1, 1]");
    await page.keyboard.press("Control+c");
    await page.locator("#tab-moves").click(); await page.locator("#add-input").click(); await page.locator("#add-drawn-input").click(); await page.locator("#landmark").selectOption("left_wrist");
    await page.locator("#editor-camera-toggle").uncheck(); await page.locator("#zoom-reset").click(); await page.keyboard.press("Control+v");
    await expect(page.locator(".grid-region.selected")).toHaveCount(2);
    await expect(page.locator(".region-coordinate").first()).toHaveText("[2, 4, 1, 1]");
    await expect(page.locator(".region-coordinate").last()).toHaveText("[4, 4, 1, 1]");
    await page.locator("#input-name").fill("Native selection");
    await page.keyboard.press("Control+a");
    expect(await page.locator("#input-name").evaluate(node => node.selectionEnd - node.selectionStart)).toBe(16);
    await expect(page.locator(".grid-region.selected")).toHaveCount(2);
});

test("camera display keeps the editor frame and tools fixed; grid zoom preserves notes and editing coordinates", async ({ page }) => {
    await fakeObservations(page); await openStudio(page, "home"); await page.locator("#new-profile").click(); await page.locator("#add-drawn-input").click(); await page.locator("#landmark").selectOption("left_wrist");
    for (const size of [{width:1440,height:1000}, {width:390,height:844}]) {
        await page.setViewportSize(size);
        const before = await page.locator(".editor-frame").boundingBox();
        const gridBounds = await page.locator(".grid-viewport").boundingBox();
        const tools = await page.locator(".tool-group").boundingBox();
        await page.locator("#editor-camera-toggle").check();
        expect(await page.locator(".editor-frame").boundingBox()).toEqual(before);
        expect(await page.locator("#test-stage").boundingBox()).toEqual(gridBounds);
        expect(await page.locator(".tool-group").boundingBox()).toEqual(tools);
        await expect(page.locator("#zoom-in")).toBeDisabled();
        await page.locator("#editor-camera-toggle").uncheck();
        expect(await page.locator(".editor-frame").boundingBox()).toEqual(before);
    }
    const square = await page.locator("#editor-grid button").first().boundingBox();
    await page.locator("#zoom-in").click(); await page.locator("#zoom-in").click();
    await expect(page.locator("#zoom-reset")).toHaveText("150%");
    expect((await page.locator("#editor-grid button").first().boundingBox()).width).toBeCloseTo(square.width * 1.5, 0);
    const cell = page.locator('#editor-grid button[data-x="3"][data-y="3"]');
    await cell.click(); await expect(page.locator(".region-coordinate").first()).toHaveText("[3, 3, 1, 1]");
    await page.locator("#editor-note-toggle").click(); await cell.click();
    await expect(page.locator(".grid-note")).toHaveCount(1);
    await page.locator("#zoom-reset").click(); await expect(page.locator("#zoom-reset")).toHaveText("100%");
    await expect(page.locator(".grid-note")).toHaveCount(1);
    await page.locator("#zoom-out").click(); await expect(page.locator("#zoom-reset")).toHaveText("75%");
    await page.locator("#editor-camera-toggle").check(); await page.locator("#start-test").click();
    await expect(page.locator("#camera-message")).toContainText("Suivi actif", {timeout:15000});
    const active = await page.locator(".editor-frame").boundingBox();
    await page.locator("#editor-camera-toggle").uncheck();
    expect(await page.locator(".editor-frame").boundingBox()).toEqual(active);
    await expect(page.locator("#zoom-reset")).toHaveText("75%");
    await page.locator("#header-stop").click();
});

test("profile, movement, step and selection options have distinct scopes and contextual controls", async ({ page }) => {
    await openStudio(page,"home"); await page.locator("#new-profile").click(); await page.locator("#add-drawn-input").click(); await page.locator("#landmark").selectOption("left_wrist");
    await expect(page.locator("#selection-inspector")).toBeHidden();
    await expect(page.locator("#creation-settings")).toBeVisible();
    await expect(page.locator(".movement-inspector #input-name")).toBeVisible();
    await expect(page.locator(".step-inspector #step-mode")).toBeVisible();
    await page.locator("#open-profile-settings").click();
    await expect(page.locator("#profile-dialog #track-hands")).toBeVisible();
    await page.locator("#done-profile-settings").click();
    for (const x of [3,5]) await page.locator(`#editor-grid button[data-x="${x}"][data-y="3"]`).click();
    await page.locator('[data-tool="select"]').click(); await page.keyboard.press("Control+a");
    await expect(page.locator("#creation-settings")).toBeHidden();
    await expect(page.locator("#selection-inspector")).toBeVisible();
    await expect(page.locator("#selection-summary")).toContainText("2 zones");
    await expect(page.locator("#selection-details")).toBeHidden();
    await page.locator("#delete-selection").click(); await expect(page.locator(".grid-region")).toHaveCount(0);
    await page.locator("#undo").click(); await expect(page.locator(".grid-region")).toHaveCount(2);
    await page.locator("#scope").selectOption("global");
    await expect(page.locator("#step-mode-field")).toBeHidden();
    await expect(page.locator("#scope-help")).toContainText("toutes les étapes");
});

test("camera commands stay outside its frame and shoulder references survive live edits and lost observations", async ({ page }) => {
    await fakeObservations(page); await openStudio(page,"home"); await page.locator("#new-profile").click(); await page.locator("#add-drawn-input").click(); await page.locator("#landmark").selectOption("left_wrist");
    await page.locator("#editor-camera-toggle").check();
    const frame = await page.locator(".editor-frame").boundingBox();
    const controls = await page.locator("#editor-camera-controls").boundingBox();
    expect(controls.y).toBeGreaterThanOrEqual(frame.y+frame.height);
    await page.locator("#start-test").click();
    await expect(page.locator("#camera-message")).toContainText("Suivi actif",{timeout:15000});
    await page.locator("#editor-camera-toggle").uncheck();
    for (const side of ["left","right"]) await expect(page.locator(`[data-shoulder="${side}"]`)).toBeVisible();
    await page.locator('#editor-grid button[data-x="3"][data-y="3"]').click();
    for (const side of ["left","right"]) await expect(page.locator(`[data-shoulder="${side}"]`)).toBeVisible();
    await page.evaluate(() => { window.studioShouldersVisible = false; });
    await page.locator("#editor-camera-toggle").check();
    await expect(page.locator("#camera-message")).toContainText("épaules",{timeout:15000});
    await page.locator("#editor-camera-toggle").uncheck();
    for (const side of ["left","right"]) {
        const marker = page.locator(`[data-shoulder="${side}"]`);
        await expect(marker).toBeVisible(); await expect(marker).toHaveAttribute("data-tracked","false");
    }
    await page.locator("#editor-note-toggle").click(); await page.locator('#editor-grid button[data-x="7"][data-y="3"]').click();
    for (const side of ["left","right"]) await expect(page.locator(`[data-shoulder="${side}"]`)).toBeVisible();
    await page.locator("#header-stop").click();
});

test("changing step modes exports native modes and appropriate order numbers, with undo", async ({ page }) => {
    await openStudio(page);
    for (const mode of ["visited","simultaneous","ordered"]) {
        await page.locator("#step-mode").selectOption(mode);
        await page.locator("#open-json").click();
        const configuration = JSON.parse(await page.locator("#json-source").inputValue());
        const step = configuration.inputs[0].steps[0];
        expect(step.mode).toBe(mode);
        expect(step.constraints.map(region => region.order)).toEqual(mode === "ordered" ? [1,2] : [0,0]);
        await page.locator("#cancel-json").click();
    }
    await page.locator("#undo").click(); await expect(page.locator("#step-mode")).toHaveValue("simultaneous");
});

test("movement cards offer reversible deletion and hide the redundant movement picker", async ({ page }) => {
    await openStudio(page);
    await page.locator("#tab-moves").click();
    await expect(page.locator(".movement-switch")).toBeHidden();
    const remove = page.locator("[data-delete-movement]");
    await expect(remove).toHaveText("Supprimer");
    await expect(remove).toHaveClass(/danger-text/);
    await remove.click(); await expect(page.locator(".movement-card")).toHaveCount(0);
    await page.locator("#undo").click(); await expect(page.locator(".movement-card")).toHaveCount(1);
    await page.locator(".movement-card .card-actions button").first().click();
    await expect(page.locator(".movement-switch")).toBeVisible();
    await page.locator("#tab-test").click(); await expect(page.locator(".movement-switch")).toBeVisible();
});

test("Studio fits phone and desktop screens, changes language and shares theme and icon", async ({ page }) => {
    await openStudio(page);
    for (const theme of ["light", "dark"]) {
        await page.evaluate(theme => localStorage.setItem("mig-theme", theme), theme);
        await page.reload(); await expect(page.locator("#input-name")).toBeEnabled();
        await page.locator("#resume-profile").click(); await page.locator(".movement-card button").first().click();
        await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
        await expect(page.locator(".brand-mark")).toHaveAttribute("src", `../favicon${theme === "dark" ? "-dark" : ""}.svg`);
        for (const viewport of [{ width: 360, height: 800 }, { width: 768, height: 1024 }, { width: 1440, height: 1000 }]) {
            await page.setViewportSize(viewport);
            expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
            await page.locator("#full-grid").check();
            expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
            await page.locator("#full-grid").uncheck();
        }
    }
    await page.getByRole("button", { name: "EN", exact: true }).click();
    await expect(page.locator("#studio-title")).toHaveText("Motion Input Grid Studio");
    await page.locator("#open-json").click(); await page.keyboard.press("Escape");
    await expect(page.locator("#open-json")).toBeFocused();
});


test("authoring explicitly assigns simultaneous keys, text and sequential presses before exporting", async ({page})=>{
    await openStudio(page,"home");
    await page.locator("#new-profile").click(); await page.locator("#add-drawn-input").click(); await page.locator("#landmark").selectOption("left_wrist");
    await page.locator("#input-name").fill("Next slide"); await page.locator("#input-name").press("Tab");
    await page.locator('#editor-grid button[data-x="2"][data-y="4"]').focus(); await page.keyboard.press("Enter");
    await page.locator('[data-tool="trigger"]').click();
    await page.locator('#editor-grid button[data-x="2"][data-y="2"]').focus(); await page.keyboard.press("Enter");
    await page.locator("#edit-test").click();
    await expect(page.locator("#test-scope")).toContainText("sélectionné");
    await page.locator("#test-keyboard").click();
    await page.locator("#add-chord").click();
    await page.getByRole("button",{name:"Capturer un raccourci",exact:true}).click();
    await page.keyboard.press("Control+Shift+k");
    await page.locator("#add-text").click();
    await page.locator("#keyboard-steps textarea").fill("Hello");
    await page.locator("#add-chord").click();
    await page.locator("#key-picker select").selectOption("39");
    await page.locator("#add-chord").click();
    await page.locator("#key-picker select").selectOption("39");
    await page.screenshot({path:"test-results/keyboard-editor.png",fullPage:true});
    await expect(page.locator("#keyboard-preview")).toContainText('Ctrl + Shift + K → "Hello" → Right → Right');
    await page.locator("#keyboard-save").click();
    await expect(page.locator("#moves-panel")).toBeVisible();
    await expect(page.locator(".movement-card")).toContainText("Ctrl + Shift + K");
    const downloading=page.waitForEvent("download");await page.locator("#export-profile").click();const download=await downloading;
    const profile=JSON.parse(await readFile(await download.path(),"utf8"));
    expect(profile.inputs[0].keyboard).toEqual([{keys:[17,16,75]},{text:"Hello"},{keys:[39]},{keys:[39]}]);
    await expect(page.locator("#export-dialog")).toBeVisible();
    await expect(page.locator("#controller-guide")).toHaveAttribute("href",/controller/);
    await page.locator("#close-export").click();
    await page.locator("#test-configuration").click();
    await expect(page.locator("#test-scope")).toContainText("toute la configuration");
    await expect(page.locator("#test-keyboard")).toBeHidden();
});

test("keyboard editor rejects invalid hold and preserves existing keys on cancel", async ({page})=>{
    await openStudio(page);
    await page.locator("#edit-keyboard").click();
    await page.locator("#add-text").click();await page.locator("#keyboard-steps textarea").fill("Hello");
    await page.locator("#keyboard-mode").selectOption("hold");await page.locator("#keyboard-save").click();
    await expect(page.locator("#keyboard-error")).toContainText("maintien");
    await page.locator("#keyboard-cancel").click();
    await page.locator("#edit-keyboard").click();await expect(page.locator("#keyboard-steps li")).toHaveCount(0);
    await page.locator("#add-chord").click();await page.locator("#key-picker select").selectOption("39");await page.locator("#keyboard-mode").selectOption("repeat");
    await page.locator("#keyboard-interval").fill("375");await page.locator("#keyboard-interval").press("Tab");
    await page.locator("#keyboard-save").click();await expect(page.locator("#moves-panel")).toBeVisible();
    const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem("mig-studio-profile-v2")));
    expect(saved.inputs[0].action_mode).toBe("repeat");expect(saved.inputs[0].repeat_interval_ms).toBe(375);
});

test("whole configuration test recognises actions and shows simulated keyboard output", async ({page})=>{
    await fakeObservations(page);await openStudio(page,"home");
    const profile=starter();profile.inputs[0].keyboard=[{keys:[17,67]},{keys:[39]}];
    const second=structuredClone(profile.inputs[0]);second.id="another";second.name="Another movement";second.action="other_action";second.keyboard=[{text:"Next"}];
    for(const step of second.steps){step.id+="_other";for(const region of step.constraints)region.id+="_other";}
    profile.inputs.push(second);
    await page.locator("#import-file").setInputFiles({name:"all.json",mimeType:"application/json",buffer:Buffer.from(JSON.stringify(profile))});
    await expect(page.locator("#moves-panel")).toBeVisible();await page.locator("#test-configuration").click();
    await page.locator("#start-test").click();await expect(page.locator("#camera-message")).toContainText("Suivi actif",{timeout:15000});
    await page.evaluate(()=>{window.studioWristY=.45;});await page.waitForTimeout(150);await page.evaluate(()=>{window.studioWristY=.29;});
    await expect(page.locator('#log-list [data-level="action"]').filter({hasText:"hand_raised"})).toContainText("Ctrl + C → Right");
    await expect(page.locator('#log-list [data-level="action"]').filter({hasText:"other_action"})).toContainText('"Next"');
    const downloading=page.waitForEvent("download");
    await page.locator("#export-profile").click();await downloading;
    expect(await page.evaluate(()=>window.studioStream.getTracks().every(track=>track.readyState==="ended"))).toBe(true);
});

test("Controller handoff has direct latest downloads, three actual application screenshots and offline recovery", async ({page})=>{
    const base="https://github.com/Robin-G0/Motion-Input-Grid/releases/download/v2/";
    await page.route("https://api.github.com/repos/Robin-G0/Motion-Input-Grid/releases/latest",route=>route.fulfill({json:{assets:["motion-input-grid-controller-windows-x64.exe","motion-input-grid-controller-linux-x64.run"].map(name=>({name,browser_download_url:base+name}))}}));
    await page.goto("./studio/controller/?lang=en");
    await expect(page.locator("#windows-download")).toHaveAttribute("href",base+"motion-input-grid-controller-windows-x64.exe");
    await expect(page.locator("#linux-download")).toBeVisible();await expect(page.locator(".controller-steps img")).toHaveCount(3);
    await expect.poll(()=>page.locator(".controller-steps img").evaluateAll(images=>images.every(img=>img.complete&&img.naturalWidth>500&&img.src.endsWith(".png")))).toBe(true);
    await page.getByRole("button",{name:"FR",exact:true}).click();await expect(page.locator("h1")).toContainText("gestes");
    await page.unrouteAll();await page.route("https://api.github.com/**",route=>route.abort());
    await page.reload();await expect(page.locator("#release-status")).toContainText("could not be verified");
    await expect(page.locator("#release-link")).toBeVisible();
});

test("keyboard setup fits a phone and saves without horizontal scrolling", async ({page})=>{
    await page.setViewportSize({width:390,height:844});
    await openStudio(page);
    await page.locator("#edit-keyboard").click();
    await page.locator("#add-chord").click();
    await page.locator("#key-picker select").selectOption("39");
    await page.locator("#add-text").click();
    await page.locator("#keyboard-steps textarea").fill("Bonjour");
    expect(await page.locator("#keyboard-dialog").evaluate(node=>node.scrollWidth<=node.clientWidth)).toBe(true);
    await page.locator("#keyboard-save").click();
    await expect(page.locator("#moves-panel")).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});


for(const width of [1280,390])test(`HI spotlight tutorial follows drawing, recognition, explicit keys and export at ${width}px`,async({page})=>{
    await page.setViewportSize({width,height:900});
    await fakeObservations(page);await openStudio(page,"home");
    await page.locator("#quick-test").click();
    const stage=id=>expect(page.locator("body")).toHaveAttribute("data-tour-step",id);
    await stage("name");
    expect(await page.locator("#export-profile").evaluate(node=>!!node.closest("[inert]"))).toBe(true);
    await expect(page.locator("#input-name")).toHaveClass(/tour-target/);
    await page.locator("#input-name").fill("Wrong");await page.locator("#input-name").press("Tab");await stage("name");
    await page.locator("#input-name").fill("HI");await page.locator("#input-name").press("Tab");
    await stage("point");await expect(page.locator("#landmark")).toHaveValue("");
    await page.locator("#input-name").evaluate(node=>node.dispatchEvent(new Event("change",{bubbles:true})));
    await expect(page.locator("#landmark")).toHaveValue("");
    await page.locator("#landmark").selectOption("left_wrist");await stage("drawStart");
    const draw=async(y1,y2)=>{
        const a=await page.locator(`#editor-grid button[data-x="-4"][data-y="${y1}"]`).boundingBox();
        const b=await page.locator(`#editor-grid button[data-x="13"][data-y="${y2}"]`).boundingBox();
        await page.mouse.move(a.x+a.width/2,a.y+a.height/2);await page.mouse.down();await page.mouse.move(b.x+b.width/2,b.y+b.height/2,{steps:8});await page.mouse.up();
    };
    await page.screenshot({path:`test-results/HI-draw-${width}.png`});
    await draw(4,7);await stage("toolFinish");
    await page.locator('[data-tool="trigger"]').focus();await page.keyboard.press("Control+z");
    expect(await page.evaluate(()=>JSON.parse(localStorage.getItem("mig-studio-profile-v2")).inputs[0].steps[0].constraints)).toHaveLength(1);
    await page.locator('[data-tool="trigger"]').click();await draw(-3,2);
    await stage("try");await page.locator("#edit-test").click();await stage("camera");
    await page.locator("#start-test").click();await stage("recognise");
    await expect(page.locator("#camera-message")).toContainText("Suivi actif",{timeout:15000});
    await stage("recognise");
    await page.evaluate(()=>window.studioWristY=.45);await page.waitForTimeout(150);await page.evaluate(()=>window.studioWristY=.29);
    await stage("keys");await page.locator("#test-keyboard").click();await stage("plus");
    await expect(page.locator("#keyboard-steps li")).toHaveCount(0);await expect(page.locator("#keyboard-preview")).not.toContainText("Right");
    await page.locator("#add-chord").click();await stage("right");await expect(page.locator("#key-picker select")).toHaveValue("");
    await page.locator("#key-picker select").selectOption("65");await stage("right");
    await page.locator("#keyboard-steps .key-chips button").click();await page.locator("#add-chord").click();
    await page.locator("#key-picker select").selectOption("39");await stage("save");await page.locator("#keyboard-save").click();
    await stage("whole");await page.locator("#test-configuration").click();await stage("cameraAgain");
    await page.evaluate(()=>window.studioWristY=.61);await page.locator("#start-test").click();await stage("recogniseAgain");
    await expect(page.locator("#camera-message")).toContainText("Suivi actif",{timeout:15000});
    await page.evaluate(()=>window.studioWristY=.45);await page.waitForTimeout(150);await page.evaluate(()=>window.studioWristY=.29);
    await stage("back");await expect(page.locator("#log-list")).toContainText("Right");
    await page.locator("#test-back-moves").click();await stage("export");
    const downloading=page.waitForEvent("download");await page.locator("#export-profile").click();const downloaded=await downloading;
    const profile=JSON.parse(await readFile(await downloaded.path(),"utf8"));
    expect(profile.inputs[0].name).toBe("HI");expect(profile.inputs[0].keyboard).toEqual([{keys:[39]}]);
    expect(profile.inputs[0].steps[0].constraints.every(r=>r.landmark==="left_wrist")).toBe(true);
    await expect(page.locator("#export-dialog")).toBeVisible();
    await expect(page.locator("#export-guide-step")).toBeVisible();
    await expect(page.locator("#pipeline-guide")).toBeHidden();
    await expect(page.locator("dialog[open]")).toHaveCount(1);
    await expect(page.locator("body")).not.toHaveAttribute("data-tour-step");
    await page.screenshot({path:"test-results/HI-export.png"});
    await page.locator("#close-export").click();expect(await page.locator("[inert]").count()).toBe(0);
});

test("leaving a tutorial restores normal editing and keyboard plus never adds an implicit key",async({page})=>{
    await openStudio(page,"home");await page.locator("#quick-test").click();await page.locator("#leave-guide").click();
    await page.locator("#back-menu").click();await page.locator("#quick-test").click();
    await expect(page.locator("#input-name")).toBeInViewport();await page.locator("#input-name").press("Escape");
    await expect(page.locator("#pipeline-guide")).toBeHidden();
    await page.locator("#back-menu").click();await page.locator("#resume-profile").click();
    await page.locator(".movement-card button").first().click();
    await page.locator("#landmark").selectOption("left_wrist");
    await page.locator('#editor-grid button[data-x="2"][data-y="4"]').focus();await page.keyboard.press("Enter");
    await page.locator("#edit-keyboard").click();await page.locator("#add-chord").click();
    await expect(page.locator("#keyboard-preview")).not.toContainText("Right");
    await page.locator("#key-picker select").selectOption("65");
    await page.getByRole("button",{name:"Ajouter une touche simultanée",exact:true}).click();
    await page.locator("#key-picker select").selectOption("17");
    await expect(page.locator("#keyboard-preview")).toContainText("A + Ctrl");
    await page.locator("#keyboard-save").click();
    await expect(page.locator("#moves-panel")).toBeVisible();
    expect(await page.evaluate(()=>JSON.parse(localStorage.getItem("mig-studio-profile-v2")).inputs[0].keyboard)).toEqual([{keys:[65,17]}]);
});


test("new region point stays unselected across renders and new movements require an explicit choice",async({page})=>{
    await openStudio(page,"home");await page.locator("#new-profile").click();await page.locator("#add-drawn-input").click();
    await expect(page.locator("#landmark")).toHaveValue("");
    await page.locator("#input-name").fill("Fresh");await page.locator("#input-name").press("Tab");
    await expect(page.locator("#landmark")).toHaveValue("");
    const cell=page.locator('#editor-grid button[data-x="2"][data-y="4"]');
    await cell.focus();await page.keyboard.press("Enter");
    expect(await page.evaluate(()=>JSON.parse(localStorage.getItem("mig-studio-profile-v2")).inputs[0].steps[0].constraints)).toHaveLength(0);
    await page.locator("#landmark").selectOption("left_wrist");
    await page.locator("#input-name").fill("Chosen");await page.locator("#input-name").press("Tab");
    await expect(page.locator("#landmark")).toHaveValue("left_wrist");
    await cell.focus();await page.keyboard.press("Enter");
    expect(await page.evaluate(()=>JSON.parse(localStorage.getItem("mig-studio-profile-v2")).inputs[0].steps[0].constraints[0].landmark)).toBe("left_wrist");
    await page.locator("#tab-moves").click();await page.locator("#add-input").click();await page.locator("#add-drawn-input").click();
    await expect(page.locator("#landmark")).toHaveValue("");
});
