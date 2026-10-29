import { SpotlightTour } from "./tour.mjs";
import { ThemeToggle } from "../../src/ui/theme.mjs";
import { cameraError } from "../../src/camera/camera.mjs";
import { copy } from "./copy.mjs";
import { MAX_BYTES, landmarks, clone, id, newInput, starter, parseProfile, parseDraft, regions, scopedRegions, cellRect, rectangle, addRegion, pasteRegions, ProfileHistory } from "./profile.mjs";
import { createStudioSession, validateProfile, disposeValidator, PreviewGrid, trackedPoint } from "./camera.mjs";
import { GridEditor, drawPreview, selectionRect, transformSelection, RegionHighlights } from "./grid.mjs";
import { Journal } from "./journal.mjs";
import { NoteLayer, LiveNoteBrush, previewCell } from "./notes.mjs";
import { FingerEditor, setFingerRule } from "./fingers.mjs";
import { KeyboardEditor, keyboardSummary, validateKeyboard } from "./keyboard.mjs";
import { latestControllerDownloads } from "./controller-downloads.mjs";
import { CaptureWizard } from "./capture-wizard.mjs";

const $ = id => document.getElementById(id);
const storageKey = "mig-studio-profile-v2";
let language = navigator.language.toLowerCase().startsWith("fr") ? "fr" : "en";
const t = key => copy[language][key] ?? key;
const initialProfile = starter();
if (language === "en") initialProfile.inputs[0].name = "Raise the left hand";
let history = new ProfileHistory(initialProfile);
let inputIndex = 0, scope = "0", selectedRegion = null, tool = "select";
let selectedRegions = [];
const selectionIds = () => selectedRegions.length ? selectedRegions : selectedRegion ? [selectedRegion] : [];
let view = "home", detail = "position", hasDraft = false, noteMode = null;
let guided = false, testScope = "movement";
let tourStage=0, tourPoint=false, tourRecognised=false;
let tour;
let editorPreview = "grid";
let gridZoom = 1;
let regionClipboard = null;
let previewOnly = false;
const cameraVisible = () => view === "test" || (view === "edit" && editorPreview === "camera");
const draftHint = document.createElement("p"); draftHint.id = "camera-draft-hint"; draftHint.className = "hint"; draftHint.setAttribute("role", "status"); draftHint.hidden = true; $("camera-message").after(draftHint);
const cameraParts = [$("test-stage"), $("camera-message"), draftHint, document.querySelector(".test-actions"), $("note-feedback"), document.querySelector(".preview-settings")].map(node => {
    const marker = document.createComment("camera control home"); node.before(marker); return { node, marker };
});
const notes = new NoteLayer();
const notesKey = "mig-studio-notes-v1";
let busy = false, session = null, operation = 0, storageAvailable = true;
let lastPaint = -Infinity, lastDebug = -Infinity, trackingState = null;
const geometry = new PreviewGrid();
const highlights = new RegionHighlights();
const input = () => history.value.inputs[inputIndex];
const currentRegion = () => regions(input()).find(region => region.id === selectedRegion);
const theme = new ThemeToggle($("theme-toggle"), () => copy[language], { iconBase: "../" });
const journal = new Journal($("log-list"), $("log-empty"), $("action-count"), $("journal-announcement"), t);
const keyboardEditor = new KeyboardEditor($("keyboard-dialog"), t, async draft => {
    const movement = clone(input());
    movement.keyboard = draft.keyboard;
    movement.action_mode = draft.action_mode;
    movement.repeat_interval_ms = draft.repeat_interval_ms;
    validateKeyboard(movement);
    await validateProfile(JSON.stringify({ ...history.value, inputs: [movement] }));
    if (!$("keyboard-dialog").open || keyboardEditor.draft !== draft) return;
    edit(current => Object.assign(current, movement));
    stopTest(); setView("moves"); feedback("movementSaved");
});
let replaceCapturedProfile = false;
const capture = new CaptureWizard({ language: () => language, label: t, onAccept: movement => {
    const profile = replaceCapturedProfile ? {schema_version:2,tracking:{hands:false},inputs:[]} : clone(history.value);
    profile.inputs.push(movement); inputIndex = profile.inputs.length - 1;
    scope = "0"; selectedRegion = null; selectedRegions = []; noteMode = null;
    changed(profile); setView("test"); keyboardEditor.open(input());
} });
function captureMovement() {
    if (busy || guided) return;
    replaceCapturedProfile = view === "home" && !hasDraft;
    if (!replaceCapturedProfile && history.value.inputs.length >= 64) { feedback("captureLimit", true); return; }
    stopTest();
    capture.open({landmark:$("landmark").value || "left_wrist",space:input()?.space});
}
const editor = new GridEditor($("editor-grid"), $("grid-regions"), $("drawing-selection"), drawRegion, t, (regionId, rect) => {
    edit(movement => {
        if (regionId === "__selection__") {
            const group = regions(movement).filter(region => selectedRegions.includes(region.id));
            transformSelection(group, selectionRect(group), rect);
        } else { const region = regions(movement).find(item => item.id === regionId); if (region) region.cell = [rect.x, rect.y, rect.w, rect.h]; }
    });
});
const fingerEditor = new FingerEditor($("finger-list"), $("finger-hand"), t, (hand, finger, pose, timing) => {
    edit((movement, profile) => {
        const region = regions(movement).find(region => region.id === selectedRegion);
        setFingerRule(region, hand, finger, pose, timing);
        if (pose) profile.tracking = { ...profile.tracking, hands: true };
    });
});
let feedbackKey = null, feedbackDetail = "", feedbackError = false, cameraMessageKey = "cameraReady", cameraMessageError = false;
let noteSnapshot = null, noteInputId = null;
const brush = new LiveNoteBrush($("camera-overlay"), {
    enabled: () => !!noteMode && cameraVisible() && !!session?.state.running,
    cellAt: event => previewCell(event, $("camera-overlay"), geometry,
        session.video.videoWidth / session.video.videoHeight, input()?.space ?? "calibrated", $("mirror-preview").checked),
    begin: () => { noteInputId = input()?.id; noteSnapshot = notes.cells(noteInputId); },
    paint: cells => { notes.paint(noteInputId, cells, noteMode === "erase"); renderNotes(); repaintPreview(); },
    finish: () => { noteSnapshot = null; saveNotes(); },
    cancel: () => { if (noteSnapshot) notes.restore(noteInputId, noteSnapshot); noteSnapshot = null; renderNotes(); repaintPreview(); },
    unavailable: () => { $("note-feedback").textContent = t("notesUnavailable"); }
});
const gridBrush = new LiveNoteBrush($("editor-grid"), {
    enabled: () => !!noteMode && view === "edit" && editorPreview === "grid" && !busy,
    cellAt: event => editor.cellAt(event),
    begin: () => { noteInputId = input()?.id; noteSnapshot = notes.cells(noteInputId); },
    paint: cells => { notes.paint(noteInputId, cells, noteMode === "erase"); renderNotes(); },
    finish: () => { noteSnapshot = null; saveNotes(); },
    cancel: () => { if (noteSnapshot) notes.restore(noteInputId, noteSnapshot); noteSnapshot = null; renderNotes(); },
    unavailable: () => {}
});
function renderShoulders() {
    if (!session?.state.running) { editor.renderShoulders(); return; }
    const points = {}, space = input()?.space ?? "calibrated";
    for (const [side, landmark] of [["left",11],["right",12]]) {
        const point = session.coordinate(landmark);
        if (!point || (point.confidence ?? 1) < .6 || !geometry.transform(space)) continue;
        points[side] = geometry.local(point.x, point.y, session.video.videoWidth / session.video.videoHeight, space);
    }
    editor.renderShoulders(points);
}
$("editor-grid").addEventListener("dblclick", () => { if (tool === "select" && !noteMode && selectedRegion) openRegion(selectedRegion); });

function saveNotes() {
    try { localStorage.setItem(notesKey, notes.serialize()); }
    catch { feedback("storageUnavailable"); }
}
function repaintPreview() {
    if (!session?.state.running || !cameraVisible()) return;
    drawPreview($("camera-overlay"), session, history.value, inputIndex, geometry, {
        grid: $("show-grid").checked, points: $("show-points").checked, full: $("full-grid").checked, notes: notes.cells(input()?.id), highlights, reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches, shoulderLabels: {left:t("shoulderLeftShort"),right:t("shoulderRightShort")}
    });
}
function renderNotes() {
    const cells = notes.cells(input()?.id);
    editor.renderNotes($("grid-notes"), cells);
    for (const prefix of ["editor", "test"]) {
        $(`${prefix}-note-toggle`).setAttribute("aria-pressed", String(noteMode === "draw"));
        $(`${prefix}-note-erase`).setAttribute("aria-pressed", String(noteMode === "erase"));
        $(`${prefix}-note-count`).textContent = cells.length ? `${cells.length} ${t("noteCells")}` : "";
        $(`clear-${prefix}-notes`).disabled = !cells.length || busy;
        for (const control of ["toggle", "erase"]) $(`${prefix}-note-${control}`).disabled = busy || !input();
    }
    $("test-stage").dataset.noteMode = String(!!noteMode);
}

function feedback(key, error = false, detail = "") {
    feedbackKey = key; feedbackDetail = detail.slice(0, 500); feedbackError = error;
    $("feedback").hidden = !key;
    $("feedback").dataset.error = String(error);
    $("feedback").textContent = key ? `${t(key)}${detail ? ` ${feedbackDetail}` : ""}` : "";
    $("region-error").hidden = !key || !error || !$("region-dialog").open;
    $("region-error").textContent = $("feedback").textContent;
}
function cameraMessage(key, error = false) {
    cameraMessageKey = key; cameraMessageError = error;
    $("camera-message").textContent = t(key); $("camera-message").dataset.error = String(error);
}
function errorDetails(error) {
    const known = ["size", "json", "schema", "bounds", "oneTrigger", "globalTrigger", "noInputs", "emptyField", "emptyPath", "copyReference", "emptyExport", "keyboardInvalid", "keyboardLimit", "holdNeedsKeys", "keyboardInterval"];
    return known.includes(error.message) ? { key: error.message, detail: "" } : { key: "invalid", detail: error.message };
}
function save() {
    hasDraft = true;
    try {
        const text = JSON.stringify(history.value);
        if (new TextEncoder().encode(text).length > MAX_BYTES) throw new Error("size");
        localStorage.setItem(storageKey, text); storageAvailable = true;
        hasDraft = true;
    } catch { storageAvailable = false; }
    $("draft-status").textContent = t(storageAvailable ? "saved" : "storageUnavailable");
}
function selectOptions(node, options, selected) {
    node.replaceChildren(...options.map(([value, label]) => {
        const option = document.createElement("option"); option.value = value; option.textContent = label; return option;
    }));
    node.value = selected;
}
function setBusy(value) {
    busy = value;
    for (const name of ["new-profile", "import-profile", "export-profile", "open-json", "add-input", "add-step", "apply-json", "input-select", "capture-profile", "capture-input", "capture-edit"]) $(name).disabled = busy;
    render();
}
function setView(next, focus = true) {
    brush.cancel(); gridBrush.cancel(); editor.cancel();
    if ((next === "edit" || next === "test") && !input()) next = "moves";
    view = next;
    document.body.dataset.view = view;
    $("start-menu").hidden = view !== "home";
    $("workspace").hidden = view === "home";
    for (const screen of ["moves", "edit", "test"]) {
        const panel = $(screen === "edit" ? "editor-panel" : screen === "test" ? "test-panel" : "moves-panel");
        panel.hidden = view !== screen;
        $(`tab-${screen}`).setAttribute("aria-selected", String(view === screen));
        $(`tab-${screen}`).tabIndex = view === screen ? 0 : -1;
    }
    render();
    if (focus) {
        window.scrollTo({ top: 0, behavior: "instant" });
        $(view === "home" ? "studio-title" : view === "moves" ? "moves-title" : view === "edit" ? "editor-title" : "test-title").focus({ preventScroll: true });
    }
}
function renderEditorPreview() {
    const camera = view === "edit" && editorPreview === "camera";
    $("editor-camera").hidden = !camera;
    document.querySelector(".grid-viewport").hidden = camera;
    $("editor-camera-controls").hidden = !camera;
    document.querySelector(".grid-footnote").hidden = camera;
    $("editor-camera-toggle").checked = editorPreview === "camera";
    for (const {node, marker} of cameraParts) {
        const host = node.id === "test-stage" ? $("editor-camera") : $("editor-camera-controls");
        if (camera) { if (node.parentElement !== host) host.append(node); }
        else if (node.parentNode !== marker.parentNode) marker.after(node);
    }
    repaintPreview();
}
function setDetail(next) {
    if (next === "sign" && currentRegion()?.type !== "interaction") next = "position";
    detail = next;
    for (const name of ["position", "sign", "fingers"]) {
        $(`detail-${name}`).hidden = detail !== name;
        $(`detail-${name}-tab`).setAttribute("aria-selected", String(detail === name));
        $(`detail-${name}-tab`).tabIndex = detail === name ? 0 : -1;
    }
}
function openRegion(regionId) {
    selectedRegions = [];
    selectedRegion = regionId;
    const region = currentRegion();
    if (!region) return;
    $("finger-hand").value = region.landmark.startsWith("right_") ? "right" : "left";
    setDetail(region.type === "interaction" ? "sign" : "position");
    render();
    $("region-error").hidden = true;
    if (!$("region-dialog").open) $("region-dialog").showModal();
    $(`detail-${detail}-tab`).focus();
}
function render() {
    $("test-scope").textContent = t(testScope === "configuration" ? "wholeTest" : "selectedTest");
    $("test-keyboard").hidden = testScope === "configuration";
    $("test-configuration").disabled = busy || !history.value.inputs.length;
    $("save-movement").disabled = $("edit-keyboard").disabled = busy || !input();
    $("test-keyboard").disabled = busy || !input();
    renderEditorPreview();
    document.querySelector(".movement-switch").hidden = view === "moves" || view === "home";
    draftHint.hidden = !previewOnly || !session?.state.running;
    draftHint.textContent = t("cameraDraft");
    const profile = history.value;
    inputIndex = Math.max(0, Math.min(inputIndex, profile.inputs.length - 1));
    const movement = input();
    if (scope !== "global" && !movement?.steps?.[Number(scope)]) scope = movement?.steps?.length ? "0" : "global";
    for (const control of $("input-fields").querySelectorAll("input, select, button")) {
        if (["stop-test", "editor-camera-toggle"].includes(control.id)) continue;
        control.disabled = busy || !movement;
    }
    $("empty-editor").hidden = !!movement;
    $("input-fields").hidden = !movement;
    $("region-fields").disabled = busy;
    $("resume-profile").hidden = !hasDraft;
    $("resume-profile").disabled = busy;
    $("delete-input").disabled = busy || !movement;
    $("undo").disabled = busy || !history.past.length; $("redo").disabled = busy || !history.future.length;
    $("start-test").disabled = busy || !profile.inputs.length;
    $("quick-test").disabled = busy;
    $("start-test").hidden = !!session?.state.running;
    $("stop-test").hidden = !session && !busy;
    $("header-stop").hidden = (!session?.state.running && !busy) || cameraVisible();
    $("header-stop").textContent = t(busy ? "cancelCamera" : "activeCamera");
    $("recalibrate").disabled = busy || !session?.state.running;
    $("live-badge").textContent = t(session?.state.running ? "online" : "offline");
    $("live-badge").dataset.live = String(!!session?.state.running);
    $("camera-placeholder").hidden = !!session?.state.running;
    $("test-stage").dataset.running = String(!!session?.state.running);
    $("test-stage").dataset.mirror = String($("mirror-preview").checked);
    $("movement-list").replaceChildren(...profile.inputs.map((item, index) => {
        const card = document.createElement("article"); card.className = "movement-card";
        const title = document.createElement("h3"); title.textContent = item.name;
        const summary = document.createElement("p"); summary.textContent = `${item.action} · ${regions(item).length} ${t("zoneCount")} · ${keyboardSummary(item,t)}`;
        const actions = document.createElement("div"); actions.className = "card-actions";
        for (const target of ["edit", "test"]) {
            const button = document.createElement("button"); button.type = "button"; button.className = "text-button";
            button.disabled = busy; button.textContent = t(target === "edit" ? "editCard" : "testCard");
            button.addEventListener("click", () => { stopTest(); testScope = "movement"; inputIndex = index; scope = "0"; selectedRegion = null; selectedRegions = []; setView(target); }); actions.append(button);
        }
        const remove = document.createElement("button"); remove.type = "button"; remove.className = "text-button danger-text";
        remove.textContent = t("deleteCard"); remove.disabled = busy; remove.dataset.deleteMovement = item.id;
        remove.setAttribute("aria-label", `${t("deleteInput")} : ${item.name}`);
        remove.addEventListener("click", () => deleteMovement(index)); actions.append(remove);
        card.append(title, summary, actions); return card;
    }));
    selectOptions($("input-select"), profile.inputs.map((item, i) => [String(i), item.name]), String(inputIndex));
    const names = Object.keys(landmarks);
    // Preserve and show imported landmark names, even outside the basic menu.
    for (const name of regions(movement).map(region => region.landmark)) if (!names.includes(name)) names.push(name);
    for (const name of ["landmark", "region-landmark"]) {
        const selected = $(name).value || "left_wrist";
        selectOptions($(name), names.map(point => [point, t(point)]), selected);
    }
    const scopes = [...(movement?.steps ?? []).map((step, index) => [String(index), `${t("step")} ${index + 1}`]), ["global", t("global")]];
    selectOptions($("scope"), scopes, scope);
    $("input-name").value = movement?.name ?? ""; $("input-action").value = movement?.action ?? "";
    $("input-space").value = movement?.space ?? "calibrated";
    $("input-cooldown").value = movement?.cooldown_ms ?? 0;
    $("input-duration").value = movement?.max_duration_ms ?? 0;
    $("track-hands").checked = !!profile.tracking?.hands;
    $("track-hands").disabled = busy;
    const cameraEditing = editorPreview === "camera";
    for (const button of document.querySelectorAll("[data-tool]")) button.disabled = busy || cameraEditing || !movement;
    for (const name of ["zoom-in", "zoom-out", "zoom-reset"]) $(name).disabled = busy || cameraEditing || !movement;
    $("zoom-in").disabled ||= gridZoom >= 2;
    $("zoom-out").disabled ||= gridZoom <= .5;
    $("zoom-reset").textContent = `${Math.round(gridZoom * 100)}%`;
    $("creation-settings").hidden = cameraEditing || !!noteMode || !["required", "trigger", "forbidden", "interaction"].includes(tool);
    $("step-mode-field").hidden = scope === "global";
    $("step-settings-title").textContent = t(scope === "global" ? "globalGuardSettings" : "stepSettings");
    $("scope-help").textContent = t(scope === "global" ? "globalGuardHint" : `${movement?.steps?.[Number(scope)]?.mode ?? "visited"}StepHelp`);
    $("step-mode").disabled = busy || scope === "global";
    $("step-mode").value = scope === "global" ? "simultaneous" : movement?.steps?.[Number(scope)]?.mode ?? "ordered";
    $("tool-help").textContent = t(editorPreview === "camera" ? "cameraEditHelp" : noteMode ? (noteMode === "erase" ? "noteEraseHelp" : "noteHelp") : `${tool}Help`);
    for (const button of document.querySelectorAll("[data-tool]")) button.setAttribute("aria-pressed", String(!noteMode && button.dataset.tool === tool));
    editor.noteMode = !!noteMode; editor.selectionEnabled = !noteMode && tool === "select";
    selectedRegions = selectedRegions.filter(regionId => regions(movement).some(region => region.id === regionId));
    const selected = regions(movement).filter(region => selectionIds().includes(region.id));
    $("selection-inspector").hidden = !selected.length;
    $("selection-summary").textContent = selected.length ? `${selected.length} ${t("zoneCount")} · ${t("selectionHint")}` : "";
    $("selection-details").hidden = selected.length !== 1;
    editor.render(movement, scope, selectionIds(), $("full-grid").checked, !busy, $("mirror-preview").checked);
    renderShoulders();
    $("editor-grid").dataset.pan = String(!noteMode && tool === "select");
    renderNotes();
    $("grid-range").textContent = $("full-grid").checked ? "[−9, −9] → [17, 17]" : "[−4, −4] → [13, 13]";
    const constraints = scopedRegions(movement, scope);
    $("region-count").textContent = String(constraints.length);
    const focusedRegion = document.activeElement?.dataset.region;
    $("region-list").replaceChildren(...constraints.map(region => {
        const button = document.createElement("button"); button.type = "button"; button.dataset.region = region.id;
        button.disabled = busy; button.setAttribute("aria-pressed", String(selectionIds().includes(region.id)));
        const color = document.createElement("i"); color.className = `swatch ${region.type}`;
        const label = document.createElement("span"); label.textContent = `${t(region.type)}${region.order ? ` ${region.order}` : ""} · ${t(region.landmark)}`;
        const position = document.createElement("span"); position.className = "region-coordinate";
        position.textContent = `[${region.cell.join(", ")}]`;
        button.append(color, label, position);
        button.addEventListener("click", () => openRegion(region.id)); return button;
    }));
    if (focusedRegion) [...$("region-list").children].find(button => button.dataset.region === focusedRegion)?.focus();
    const region = currentRegion();
    $("region-fields").hidden = !region;
    if (region) {
        $("region-description").textContent = `${t(region.type)} · ${t(region.landmark)} · [${region.cell.join(", ")}]`;
        $("detail-sign-tab").disabled = region.type !== "interaction";
        setDetail(detail);
        fingerEditor.render(region);
        const rect = cellRect(region.cell);
        $("region-landmark").value = region.landmark;
        for (const property of ["x", "y", "w", "h"]) $(`region-${property}`).value = rect[property];
        $("region-order").value = region.order ?? 0;
        $("region-order").disabled = region.type === "forbidden" || region.priority === "low" || scope === "global" || $("step-mode").value !== "ordered";
        $("interaction-fields").hidden = region.type !== "interaction";
        if (region.interaction) {
            $("region-sign").value = region.interaction.gesture; $("region-hand").value = region.interaction.hand;
            $("region-hold").value = region.interaction.hold_ms ?? 0;
        }
    }
    if (!region && $("region-dialog").open) $("region-dialog").close();
    $("draft-status").textContent = t(storageAvailable ? "saved" : "storageUnavailable");
    tour?.schedule();
}
function renderLanguage() {
    document.title = "Motion Input Grid Studio";
    document.documentElement.lang = language;
    for (const node of document.querySelectorAll("[data-i18n]")) node.textContent = t(node.dataset.i18n);
    for (const node of document.querySelectorAll("[data-label]")) { node.setAttribute("aria-label", t(node.dataset.label)); node.title = t(node.dataset.label); }
    for (const node of document.querySelectorAll("[data-language]")) node.setAttribute("aria-pressed", String(node.dataset.language === language));
    theme.render(); render(); journal.render();
    feedback(feedbackKey, feedbackError, feedbackDetail); cameraMessage(cameraMessageKey, cameraMessageError);
}
function stopTest(message = "stopped") {
    brush.cancel(); gridBrush.cancel();
    operation++;
    const current = session; session = null;
    current?.dispose();
    geometry.reset(); highlights.reset(); trackingState = null;
    $("action-flash").hidden = true;
    if (current) journal.add("info", t("stopped"));
    cameraMessage(message); setBusy(false);
}
function changed(profile, message = null) {
    if (!history.commit(profile)) { render(); return; }
    if (session) { if (view === "edit") updateLiveProfile(); else stopTest("changed"); }
    highlights.reset(); save(); render();
    if (message) feedback(message);
}
async function updateLiveProfile() {
    const current = session, json = JSON.stringify(history.value);
    try {
        const configuration = await cameraConfiguration(json, true);
        if (current !== session || json !== JSON.stringify(history.value)) return;
        await current.importJSON(configuration.json);
        if (current !== session || json !== JSON.stringify(history.value)) return;
        previewOnly = configuration.previewOnly;
        geometry.reset(); trackingState = null; cameraMessage("liveEdit"); render(); repaintPreview();
    } catch (error) {
        if (current !== session || json !== JSON.stringify(history.value)) return;
        stopTest("changed"); const {key, detail} = errorDetails(error); feedback(key, true, detail);
    }
}
async function cameraConfiguration(json, allowDraft) {
    try { await validateProfile(json); return { json, previewOnly: false }; }
    catch (error) {
        if (!allowDraft) throw error;
        // A draft can still use the camera to position its zones. An empty native
        // profile supplies tracking without recognising obsolete or invalid actions.
        const profile = JSON.parse(json);
        return { json: JSON.stringify({ schema_version: 2, tracking: profile.tracking ?? {hands:false}, inputs: [] }), previewOnly: true };
    }
}
function edit(mutator) {
    if (busy) return;
    try { const profile = clone(history.value); mutator(profile.inputs[inputIndex], profile); changed(profile); feedback(null); }
    catch (error) { const { key, detail } = errorDetails(error); feedback(key, true, detail); render(); }
}
function removeRegions(movement, ids) {
    // Tolerances cannot survive the deletion of their referenced High region.
    for (const list of [movement.constraints, ...(movement.steps ?? []).map(step => step.constraints)]) {
        if (!list) continue;
        for (let i = list.length - 1; i >= 0; i--) if (ids.has(list[i].id) || ids.has(list[i].tolerance_for)) list.splice(i, 1);
    }
}
function drawRegion(from, to) {
    if (noteMode) {
        const [x, y, w, h] = rectangle(from, to), cells = [];
        for (let row = y; row < y + h; row++) for (let column = x; column < x + w; column++) cells.push({ x: column, y: row });
        notes.paint(input()?.id, cells, noteMode === "erase"); saveNotes(); renderNotes(); return;
    }
    if (tool === "select") {
        selectedRegions = [];
        const candidates = scopedRegions(input(), scope).filter(region => {
            const r = cellRect(region.cell); return to.x >= r.x && to.x < r.x + r.w && to.y >= r.y && to.y < r.y + r.h;
        }).sort((a, b) => { const x = cellRect(a.cell), y = cellRect(b.cell); return x.w * x.h - y.w * y.h; });
        if (candidates.length) { selectedRegion = candidates[0].id; render(); }
        else { selectedRegion = null; selectedRegions = []; render(); }
        return;
    }
    selectedRegions = [];
    edit((movement, profile) => {
        const rect = rectangle(from, to);
        if(guided && ["required","trigger"].includes(tool))removeRegions(movement,new Set(regions(movement).filter(r=>r.type===tool).map(r=>r.id)));
        if (tool === "erase") {
            const [x, y, w, h] = rect;
            const removed = new Set(scopedRegions(movement, scope).filter(region => {
                const r = cellRect(region.cell); return x < r.x + r.w && x + w > r.x && y < r.y + r.h && y + h > r.y;
            }).map(region => region.id));
            removeRegions(movement, removed); selectedRegion = null; selectedRegions = [];
        } else {
            selectedRegion = addRegion(movement, scope, rect, { type: tool, landmark: $("landmark").value });
            if (tool === "interaction") { profile.tracking = { ...profile.tracking, hands: true }; $("region-details").open = true; }
        }
    });
    if (tool === "interaction" && currentRegion()) openRegion(selectedRegion);
}
function selectImported(profile) {
    inputIndex = 0; scope = profile.inputs[0]?.steps?.length ? "0" : "global"; selectedRegion = null; selectedRegions = [];
    $("full-grid").checked = profile.inputs.some(movement => regions(movement).some(region => {
        const r = cellRect(region.cell); return r.x < -4 || r.y < -4 || r.x + r.w > 14 || r.y + r.h > 14;
    }));
}
async function acceptJSON(text, target = "feedback") {
    const token = ++operation;
    setBusy(true);
    if (target === "feedback") feedback("validating"); else $("json-error").hidden = true;
    try {
        const profile = parseProfile(text);
        await validateProfile(text);
        if (token !== operation) return false;
        changed(profile);
        selectImported(profile); render(); feedback("imported");
        if (target === "feedback") setView("moves");
        return true;
    } catch (error) {
        if (token !== operation) return false;
        const { key, detail } = errorDetails(error);
        if (target === "feedback") feedback(key, true, detail);
        else { $("json-error").textContent = `${t(key)} ${detail.slice(0, 500)}`; $("json-error").hidden = false; $("json-error").dataset.error = "true"; }
        return false;
    } finally { if (token === operation) setBusy(false); }
}
function onAction(event) {
    if(guided && event.id===input()?.id){tourRecognised=true;tour.schedule();}
    const movement = history.value.inputs.find(item => item.id === event.id);
    journal.add("action", `${movement?.name ?? event.id} · ${event.action} · ${t("keyboardPreview")}: ${keyboardSummary(movement,t)}`);
    if (movement) highlights.confirm(movement, performance.now());
    const flash = $("action-flash");
    for (const animation of flash.getAnimations()) animation.cancel();
    clearTimeout(flash.hideTimer);
    flash.textContent = `${event.action} · ${keyboardSummary(movement,t)}`; flash.hidden = false;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) flash.hideTimer = setTimeout(() => { flash.hidden = true; }, 2400);
    else flash.animate([{ opacity: 0 }, { opacity: 1, offset: .1 }, { opacity: 1, offset: .85 }, { opacity: 0 }], { duration: 2400, easing: "ease-out" }).finished
        .then(() => { flash.hidden = true; }).catch(() => {});
}
function onFrame(current) {
    if (current !== session || !current.state.running) return;
    const now = performance.now(), video = current.video;
    if (!video?.videoWidth || !video.videoHeight) return;
    const state = geometry.observe(current.coordinate(11), current.coordinate(12), video.videoWidth / video.videoHeight, now);
    if (state !== trackingState) {
        trackingState = state; cameraMessage(state); journal.add("info", t(state));
    }
    if (now - lastPaint >= 50) {
        lastPaint = now;
        highlights.observe(input(), current, geometry, video.videoWidth / video.videoHeight, now);
        renderShoulders();
        $("test-stage").style.aspectRatio = String(video.videoWidth / video.videoHeight);
        $("test-stage").style.setProperty("--preview-ratio", video.videoWidth / video.videoHeight);
        repaintPreview();
    }
    if (journal.level === "debug" && now - lastDebug >= 500) {
        lastDebug = now;
        const tracked = new Set(regions(input()).map(region => region.landmark));
        const values = [...tracked].map(name => {
            const point = trackedPoint(current, name);
            return point ? `${name}: x=${point.x.toFixed(3)} y=${point.y.toFixed(3)} confidence=${(point.confidence ?? 0).toFixed(2)}` : `${name}: —`;
        });
        journal.add("debug", values.slice(0, 12).join(" | ") || state);
    }
}
async function startTest() {
    if (busy || session?.state.running) return;
    if (!history.value.inputs.length) { feedback("noInputs", true); return; }
    const token = ++operation;
    setBusy(true); cameraMessage("loading"); feedback(null);
    let candidate;
    try {
        const profile = view === "test" && testScope === "movement" ? {...history.value, inputs: [input()]} : history.value;
        let json = JSON.stringify(profile);
        if (view !== "edit" && profile.inputs.some(movement => !regions(movement).length && !(movement.fingers?.length))) throw new Error("emptyPath");
        const configuration = await cameraConfiguration(json, view === "edit");
        if (token !== operation) return;
        json = configuration.json; previewOnly = configuration.previewOnly;
        candidate = await createStudioSession(onAction, onFrame, cameraVisible);
        if (token !== operation) { candidate.dispose(); return; }
        session = candidate;
        geometry.reset(); lastPaint = lastDebug = -Infinity; trackingState = null;
        await candidate.importJSON(json);
        if (token !== operation) return;
        let previousRunning, previousBusy;
        candidate.subscribe(state => {
            if (candidate !== session) return;
            if (state.running !== previousRunning || state.busy !== previousBusy) render();
            previousRunning = state.running; previousBusy = state.busy;
            if (!state.running && !state.busy && !busy) cameraMessage(state.status === "Camera stopped." ? "stopped" : cameraError(state.status), state.status !== "Camera stopped.");
        });
        await candidate.start($("camera-video"), $("camera-overlay"));
        if (token !== operation) return;
        if (!candidate.state.running) throw new Error(candidate.state.status);
        cameraMessage("running"); journal.add("info", t("running"));
        for (const track of candidate.stream?.getTracks() ?? []) track.addEventListener("ended", () => {
            if (candidate !== session) return;
            stopTest(); cameraMessage("unavailable", true); journal.add("error", t("unavailable"));
        }, { once: true });
    } catch (error) {
        if (token !== operation) return;
        candidate?.dispose(); if (session === candidate) session = null;
        const configFailure = !candidate;
        const { key, detail } = configFailure ? errorDetails(error) : { key: cameraError(error.message), detail: "" };
        const resolved = key === "error" ? "cameraError" : key;
        cameraMessage(resolved, true); feedback(resolved, true, detail); journal.add("error", `${t(resolved)} ${detail}`);
    } finally { if (token === operation) setBusy(false); }
}

$("input-select").addEventListener("change", () => { brush.cancel(); gridBrush.cancel(); inputIndex = Number($("input-select").value); scope = "0"; selectedRegion = null; selectedRegions = []; render(); repaintPreview(); });
$("scope").addEventListener("change", () => { brush.cancel(); gridBrush.cancel(); editor.cancel(); scope = $("scope").value; selectedRegion = null; selectedRegions = []; render(); });
$("full-grid").addEventListener("change", () => { brush.cancel(); gridBrush.cancel(); editor.cancel(); render(); repaintPreview(); });
for (const button of document.querySelectorAll("[data-tool]")) button.addEventListener("click", () => { brush.cancel(); gridBrush.cancel(); editor.cancel(); noteMode = null; tool = button.dataset.tool; render(); });
for (const button of document.querySelectorAll("[data-language]")) button.addEventListener("click", () => { language = button.dataset.language; renderLanguage(); });
$("add-input").addEventListener("click", () => {
    if (history.value.inputs.length >= 64) { feedback("invalid", true, "inputs: maximum 64"); return; }
    const profile = clone(history.value), movement = newInput(profile.inputs.length + 1);
    movement.name = `${t("movement")} ${profile.inputs.length + 1}`;
    profile.inputs.push(movement);
    inputIndex = profile.inputs.length - 1; scope = "0"; selectedRegion = null; selectedRegions = []; changed(profile);
    tool = "required"; noteMode = null; setView("edit");
    $("input-name").focus(); $("input-name").select();
});
function deleteMovement(index) {
    if (busy) return;
    const selectedId = input()?.id, profile = clone(history.value);
    profile.inputs.splice(index, 1);
    inputIndex = Math.max(0, profile.inputs.findIndex(item => item.id === selectedId));
    selectedRegion = null; selectedRegions = []; changed(profile);
    if (!input()) setView("moves");
}
$("delete-input").addEventListener("click", () => deleteMovement(inputIndex));
$("add-step").addEventListener("click", () => edit(movement => {
    const steps = movement.steps ??= [];
    steps.push({ id: id("step"), mode: "ordered", constraints: [] }); scope = String(steps.length - 1); selectedRegion = null; selectedRegions = [];
}));
for (const [name, property] of [["input-name", "name"], ["input-action", "action"]]) $(name).addEventListener("change", () => {
    const value = $(name).value.trim(); edit(movement => { if (!value) throw new Error("emptyField"); movement[property] = value; });
});
$("input-space").addEventListener("change", () => edit(movement => { movement.space = $("input-space").value; }));
for (const [name, property] of [["input-cooldown", "cooldown_ms"], ["input-duration", "max_duration_ms"]]) $(name).addEventListener("change", () => {
    if (!$(name).checkValidity() || $(name).value === "") { render(); return; }
    const value = Number($(name).value); edit(movement => { movement[property] = value; });
});
$("step-mode").addEventListener("change", () => {
    const mode = $("step-mode").value;
    edit(movement => {
        const step = movement.steps[Number(scope)]; step.mode = mode;
        const lanes = new Map();
        for (const region of step.constraints) {
            if (mode !== "ordered" || region.type === "forbidden" || region.priority === "low") { region.order = 0; continue; }
            const order = (lanes.get(region.landmark) ?? 0) + 1; lanes.set(region.landmark, order); region.order = order;
        }
    });
});
$("track-hands").addEventListener("change", () => edit((movement, profile) => { profile.tracking = { ...profile.tracking, hands: $("track-hands").checked }; }));
for (const property of ["x", "y", "w", "h"]) $(`region-${property}`).addEventListener("change", () => {
    const values = ["x", "y", "w", "h"].map(p => Number($(`region-${p}`).value));
    edit(movement => {
        const [x, y, w, h] = values;
        if (values.some(v => !Number.isInteger(v)) || x < -9 || y < -9 || w < 1 || h < 1 || x + w > 18 || y + h > 18) throw new Error("bounds");
        regions(movement).find(region => region.id === selectedRegion).cell = values;
    });
});
$("region-landmark").addEventListener("change", () => { const value = $("region-landmark").value; edit(movement => { regions(movement).find(region => region.id === selectedRegion).landmark = value; }); });
$("region-order").addEventListener("change", () => {
    if (!$("region-order").checkValidity() || $("region-order").value === "") { render(); return; }
    const value = Number($("region-order").value); edit(movement => { regions(movement).find(region => region.id === selectedRegion).order = value; });
});
for (const [name, property] of [["region-sign", "gesture"], ["region-hand", "hand"], ["region-hold", "hold_ms"]]) $(name).addEventListener("change", () => {
    if (!$(name).checkValidity() || $(name).value === "") { render(); return; }
    const value = property === "hold_ms" ? Number($(name).value) : $(name).value;
    edit(movement => { regions(movement).find(region => region.id === selectedRegion).interaction[property] = value; });
});
$("delete-region").addEventListener("click", () => edit(movement => { removeRegions(movement, new Set([selectedRegion])); selectedRegion = null; selectedRegions = []; }));
function historyAction(direction) {
    if (busy) return;
    brush.cancel(); gridBrush.cancel(); editor.cancel();
    const previous = new Set(regions(input()).map(region => region.id));
    if (!history[direction]()) return;
    if (session) { if (view === "edit") updateLiveProfile(); else stopTest("changed"); }
    const current = regions(input());
    selectedRegions = selectedRegions.filter(regionId => current.some(region => region.id === regionId));
    const added = current.filter(region => !previous.has(region.id));
    if (direction === "redo" && added.length > 1) selectedRegions = added.map(region => region.id);
    selectedRegion = current.find(region => region.id === selectedRegion)?.id
        ?? (direction === "redo" ? current.find(region => !previous.has(region.id))?.id : null);
    if (selectedRegion && view === "edit") { tool = "select"; noteMode = null; }
    save(); render(); feedback(null);
}
for (const direction of ["undo", "redo"]) $(direction).addEventListener("click", () => historyAction(direction));
function copySelectedRegion() {
    const group = regions(input()).filter(region => selectionIds().includes(region.id));
    if (!group.length) { feedback("selectToCopy"); return; }
    regionClipboard = clone(group); feedback("regionCopied");
}
function pasteSelectedRegion() {
    if (!regionClipboard) { feedback("selectToCopy"); return; }
    brush.cancel(); gridBrush.cancel(); editor.cancel();
    let pastedId;
    edit((movement, profile) => {
        const pasted = pasteRegions(movement, scope, regionClipboard, $("mirror-preview").checked ? -1 : 1);
        pastedId = selectedRegion = pasted[0]; selectedRegions = pasted.length > 1 ? pasted : [];
        if (regionClipboard.some(region => region.fingers?.length || region.interaction)) profile.tracking = {...profile.tracking, hands:true};
        tool = "select"; noteMode = null; editorPreview = "grid";
    });
    if (!pastedId || selectedRegion !== pastedId || !currentRegion()) return;
    const handle = editor.handles.querySelector(".handle-edge");
    if (!editor.handles.hidden) { handle?.focus({preventScroll:true}); handle?.scrollIntoView({block:"nearest",inline:"nearest"}); }
}
document.addEventListener("keydown", event => {
    if (!(event.ctrlKey || event.metaKey) || event.altKey || event.isComposing || busy || guided || view === "home") return;
    if (document.querySelector("dialog[open]") || event.target.closest('input:not([type="range"]):not([type="checkbox"]), textarea, select, [contenteditable]:not([contenteditable="false"])')) return;
    const key = event.key.toLowerCase();
    if (key === "a" && view === "edit" && input() && !event.shiftKey) {
        event.preventDefault(); brush.cancel(); gridBrush.cancel(); editor.cancel();
        selectedRegions = scopedRegions(input(), scope).map(region => region.id); selectedRegion = null;
        tool = "select"; noteMode = null; editorPreview = "grid"; render();
        feedback("allSelected", false, String(selectedRegions.length));
        return;
    }
    if (key === "z" || key === "y") {
        event.preventDefault(); historyAction(key === "y" || event.shiftKey ? "redo" : "undo"); return;
    }
    if (view !== "edit" || !input() || event.shiftKey || !["c", "v"].includes(key)) return;
    if (key === "c" && window.getSelection()?.toString() && !event.target.closest("button, .grid-viewport, #camera-overlay")) return;
    event.preventDefault();
    if (event.repeat) return;
    if (key === "c") copySelectedRegion(); else pasteSelectedRegion();
});
$("undo").setAttribute("aria-keyshortcuts", "Control+Z Meta+Z");
$("redo").setAttribute("aria-keyshortcuts", "Control+Y Meta+Shift+Z Control+Shift+Z");
$("new-profile").addEventListener("click", () => {
    const movement = newInput(); movement.name = `${t("movement")} 1`;
    inputIndex = 0; scope = "0"; selectedRegion = null; selectedRegions = []; tool = "required"; noteMode = null;
    changed({ schema_version: 2, tracking: { hands: false }, inputs: [movement] });
    feedback(null); setView("edit"); $("input-name").focus(); $("input-name").select();
});
for (const name of ["capture-profile", "capture-input", "capture-edit"]) $(name).addEventListener("click", captureMovement);
for (const name of ["edit-keyboard", "test-keyboard", "save-movement"]) $(name).addEventListener("click", () => {
    if (busy || !input()) return;
    if (!regions(input()).length && !input().fingers?.length) { feedback("emptyPath", true); return; }
    stopTest();
    keyboardEditor.open(input());

});

$("test-back-moves").addEventListener("click",()=>{stopTest();setView("moves");});
$("test-configuration").addEventListener("click",()=>{stopTest();testScope="configuration";setView("test");});
$("close-export").addEventListener("click",()=>$("export-dialog").close());
$("import-profile").addEventListener("click", () => $("import-file").click());
$("import-file").addEventListener("change", async () => {
    const file = $("import-file").files[0];
    $("import-file").value = "";
    if (!file) return;
    if (file.size > MAX_BYTES) { feedback("size", true); return; }
    try { await acceptJSON(await file.text()); } catch (error) { feedback("invalid", true, error.message); }
});
$("export-profile").addEventListener("click", async () => {
    // Release the device before handing the profile to the desktop Controller.
    if (session) stopTest();
    const token = ++operation; setBusy(true);
    try {
        if (!history.value.inputs.length) throw new Error("emptyExport");
        for (const movement of history.value.inputs) {
            validateKeyboard(movement);
            if (!regions(movement).length && !movement.fingers?.length) throw new Error("emptyPath");
        }
        const json = JSON.stringify(history.value, null, 2);
        await validateProfile(json);
        if (token !== operation) return;
        const url = URL.createObjectURL(new Blob([json + "\n"], { type: "application/json" }));
        const link = document.createElement("a"); link.href = url; link.download = "mig-profile.json"; link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000); feedback("exported");
        $("controller-guide").href = `./controller/?lang=${language}`;
        $("export-guide-step").hidden = !guided;
        $("export-dialog").showModal();
        $("export-download-status").textContent=t("checkingDownloads");
        for(const platform of ["windows","linux"]) $(`export-${platform}`).hidden=true;
        latestControllerDownloads().then(downloads=>{
            for(const [platform,url] of Object.entries(downloads)) {const link=$(`export-${platform}`);link.href=url;link.hidden=false;}
            $("export-download-status").textContent=t(downloads.windows&&downloads.linux?"directDownloads":"pendingDownloads");
        }).catch(()=>{$("export-download-status").textContent=t("unverifiedDownloads");});
    } catch (error) { if (token === operation) { const { key, detail } = errorDetails(error); feedback(key, true, detail); } }
    finally { if (token === operation) setBusy(false); }
});
$("open-json").addEventListener("click", () => { $("json-source").value = JSON.stringify(history.value, null, 2); $("json-error").hidden = true; $("json-dialog").showModal(); $("json-source").focus(); });
for (const name of ["close-json", "cancel-json"]) $(name).addEventListener("click", () => { if (!busy) $("json-dialog").close(); });
$("json-dialog").addEventListener("cancel", event => { if (busy) event.preventDefault(); });
$("apply-json").addEventListener("click", async () => { if (await acceptJSON($("json-source").value, "json-error")) $("json-dialog").close(); });
$("start-test").addEventListener("click", startTest);
$("quick-test").addEventListener("click", () => {
    guided = false;
    $("new-profile").click();
    guided=true;tourStage=0;tourPoint=false;tourRecognised=false;
    $("full-grid").checked=false;render();$("landmark").add(new Option(t("tour_choosePoint"),"",true,true),0);
    tour.schedule();
});
$("stop-test").addEventListener("click", () => stopTest());
$("recalibrate").addEventListener("click", () => { brush.cancel(); gridBrush.cancel(); session?.recalibrate(); geometry.reset(); trackingState = null; cameraMessage("recalibrating"); journal.add("info", t("recalibrating")); });
$("mirror-preview").addEventListener("change", () => { brush.cancel(); gridBrush.cancel(); editor.cancel(); render(); repaintPreview(); });
$("log-level").addEventListener("change", () => { journal.level = $("log-level").value; journal.render(); });
$("clear-logs").addEventListener("click", () => journal.clear());
$("header-stop").addEventListener("click", () => stopTest());
$("back-menu").addEventListener("click", () => { if (session || busy) stopTest(); feedback(null); setView("home"); });
$("resume-profile").addEventListener("click", () => { feedback(null); setView("moves"); });
$("edit-test").addEventListener("click", () => {stopTest(); testScope="movement"; setView("test");});
$("test-edit").addEventListener("click", () => setView("edit"));
$("editor-camera-toggle").addEventListener("change", () => {
    brush.cancel(); gridBrush.cancel(); editor.cancel(); editorPreview = $("editor-camera-toggle").checked ? "camera" : "grid"; render();
});
function zoomGrid(next) {
    if (editorPreview !== "grid" || busy) return;
    brush.cancel(); gridBrush.cancel(); editor.cancel();
    const viewport = document.querySelector(".grid-viewport");
    const centre = {x: (viewport.scrollLeft + viewport.clientWidth / 2) / gridZoom, y: (viewport.scrollTop + viewport.clientHeight / 2) / gridZoom};
    gridZoom = Math.max(.5, Math.min(2, Math.round(next * 100) / 100));
    document.querySelector(".drawing-column").style.setProperty("--grid-zoom", gridZoom);
    viewport.scrollLeft = centre.x * gridZoom - viewport.clientWidth / 2;
    viewport.scrollTop = centre.y * gridZoom - viewport.clientHeight / 2;
    render();
}
$("zoom-in").addEventListener("click", () => zoomGrid(gridZoom + .25));
$("zoom-out").addEventListener("click", () => zoomGrid(gridZoom - .25));
$("zoom-reset").addEventListener("click", () => zoomGrid(1));
$("open-profile-settings").addEventListener("click", () => $("profile-dialog").showModal());
for (const name of ["close-profile-settings", "done-profile-settings"]) $(name).addEventListener("click", () => $("profile-dialog").close());
$("selection-details").addEventListener("click", () => openRegion(selectionIds()[0]));
$("copy-selection").addEventListener("click", copySelectedRegion);
$("delete-selection").addEventListener("click", () => edit(movement => {
    removeRegions(movement, new Set(selectionIds())); selectedRegion = null; selectedRegions = [];
}));
for (const button of document.querySelectorAll(".view-tabs [data-view]")) button.addEventListener("click", () => setView(button.dataset.view));
for (const button of document.querySelectorAll("[data-detail]")) button.addEventListener("click", () => setDetail(button.dataset.detail));
for (const name of ["close-region", "done-region"]) $(name).addEventListener("click", () => $("region-dialog").close());
$("clear-fingers").addEventListener("click", () => edit(movement => {
    const region = regions(movement).find(region => region.id === selectedRegion);
    const retained = (region.fingers ?? []).filter(rule => rule.hand !== $("finger-hand").value);
    if (retained.length) region.fingers = retained; else delete region.fingers;
}));
for (const prefix of ["editor", "test"]) {
    for (const [name, mode] of [["toggle", "draw"], ["erase", "erase"]]) $(`${prefix}-note-${name}`).addEventListener("click", () => {
        brush.cancel(); gridBrush.cancel(); noteMode = noteMode === mode ? null : mode; render();
        $("note-feedback").textContent = t(noteMode ? "notesReady" : "notesHint");
    });
    $(`clear-${prefix}-notes`).addEventListener("click", () => {
        brush.cancel(); gridBrush.cancel(); notes.clear(input()?.id); saveNotes(); renderNotes(); repaintPreview();
        $("note-feedback").textContent = t("notesCleared");
    });
}
function tabKeys(group, selector, activate) {
    group.addEventListener("keydown", event => {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
        const buttons = [...group.querySelectorAll(selector)].filter(button => !button.disabled);
        const index = buttons.indexOf(document.activeElement);
        if (index < 0) return;
        event.preventDefault();
        const next = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1
            : (index + (event.key === "ArrowRight" ? 1 : -1) + buttons.length) % buttons.length;
        activate(buttons[next]); buttons[next].focus();
    });
}
tabKeys(document.querySelector(".view-tabs"), "button", button => setView(button.dataset.view, false));
tabKeys(document.querySelector(".detail-tabs"), "button", button => setDetail(button.dataset.detail));
window.addEventListener("pagehide", () => {
    const field = document.activeElement;
    if (hasDraft && field?.matches('input[type="text"], input:not([type]), input[type="number"], select')
        && field.closest("#input-fields, #region-dialog")) field.dispatchEvent(new Event("change", {bubbles:true}));
    stopTest(); disposeValidator();
});

tour = new SpotlightTour(() => {
    if(!guided)return null;
    const list=regions(input());
    const states=[
        ["name","#input-name",()=>input()?.name==="HI"],
        ["point","#landmark",()=>tourPoint&&$("landmark").value==="left_wrist"],
        ["drawStart",".grid-viewport",()=>list.some(r=>r.type==="required"&&r.landmark==="left_wrist")],
        ["toolFinish",'[data-tool="trigger"]',()=>tool==="trigger"],
        ["drawFinish",".grid-viewport",()=>list.some(r=>r.type==="trigger"&&r.landmark==="left_wrist")],
        ["try","#edit-test",()=>view==="test"],
        ["camera","#start-test",()=>!!session?.state.running],
        ["recognise","#test-stage",()=>tourRecognised,"#stop-test, #start-test, #camera-message, #log-list"],
        ["keys","#test-keyboard",()=>$("keyboard-dialog").open],
        ["plus","#add-chord",()=>keyboardEditor.pending!==null],
        ["right",keyboardEditor.pending!==null?"#key-picker":keyboardEditor.draft?.keyboard?.length?"#keyboard-steps":"#add-chord",()=>keyboardEditor.draft?.keyboard?.length===1&&keyboardEditor.draft.keyboard[0].keys?.join() === "39","#add-chord"],
        ["save","#keyboard-save",()=>view==="moves"&&!$("keyboard-dialog").open],
        ["whole","#test-configuration",()=>view==="test"&&testScope==="configuration"],
        ["cameraAgain","#start-test",()=>!!session?.state.running],
        ["recogniseAgain","#test-stage",()=>tourRecognised,"#stop-test, #start-test, #camera-message, #log-list"],
        ["back","#test-back-moves",()=>view==="moves"],
        ["export","#export-profile",()=>$("export-dialog").open],
        ["controller","#controller-guide",()=>false,"#export-dialog .dialog-actions, #close-export"]
    ];
    while(tourStage<states.length-1&&states[tourStage][2]()){
        tourStage++;
        if([7,14].includes(tourStage))tourRecognised=false;
    }
    const [id,target,,extra]=states[tourStage];
    document.querySelectorAll(".tour-draw-cell").forEach(cell=>cell.classList.remove("tour-draw-cell"));
    if([2,4].includes(tourStage))for(const cell of $("editor-grid").children){const y=Number(cell.dataset.y);if(tourStage===2?y>=4&&y<=7:y>=-3&&y<=2)cell.classList.add("tour-draw-cell");}
    return {id,target,extra,message:t(`tour_${id}`)};
},()=>{guided=false;document.querySelectorAll(".tour-draw-cell").forEach(cell=>cell.classList.remove("tour-draw-cell"));},t);
$("landmark").addEventListener("change",()=>{tourPoint=true;});
$("export-dialog").addEventListener("close",()=>{if(guided){guided=false;tour.schedule();}});
renderLanguage();
try { notes.load(localStorage.getItem(notesKey)); } catch { /* Invalid notes never block a profile. */ }
// A saved draft may be unfinished. Validate its editable shape here, and keep
// native execution validation for imports, exports and camera tests.
try {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
        try {
            const profile = parseDraft(saved);
            history = new ProfileHistory(profile); selectImported(profile); hasDraft = true;
        } catch { feedback("draftUnreadable", true); }
    }
} catch { storageAvailable = false; }
setView("home", false);
