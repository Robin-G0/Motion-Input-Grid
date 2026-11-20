import { ThemeToggle } from "../../src/ui/theme.mjs";
import { cameraError } from "../../src/camera/camera.mjs";
import { frameSize } from "../../src/camera/processing.mjs";
import { copy } from "./copy.mjs";
import { models, modelBytes } from "./catalog.mjs";
import { ModelStats } from "./metrics.mjs";

// Loads the published runtime's MediaPipe bundle directly: this page compares
// estimators only, so no MIG engine or profile is involved.
const runtime = new URL("../../mig/", import.meta.url);
const $ = id => document.getElementById(id);
let language = navigator.language.toLowerCase().startsWith("fr") ? "fr" : "en";
const t = key => copy[language][key] ?? key;
// Studio palette, readable in both themes; red and yellow keep their Forbidden/Trigger meaning.
const colors = { lite: "--required", full: "--notes", heavy: "--interaction" };
const bones = [[11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [11, 23], [12, 24], [23, 24]];
const entries = models.map(model => ({ model, selected: model.id === "lite", task: null,
    status: "idle", error: null, delegate: null, version: 0, stats: new ModelStats(), nodes: null }));
let vision = null, stream = null, busy = false, generation = 0, frameRequest = null;
let lastVideoTime = -1, lastTime = 0, lastMetrics = 0, messageKey = "ready", messageError = false;
let frame = null;

function visionModule() {
    vision ??= (async () => {
        const module = await import(new URL("vision/vision_bundle.mjs", runtime).href);
        const files = await module.FilesetResolver.forVisionTasks(new URL("vision/wasm", runtime).href);
        return { module, files };
    })().catch(error => { vision = null; throw error; });
    return vision;
}

// GPU (WebGL) is optional: a device that rejects it falls back to CPU.
async function createTask(entry, delegate) {
    const { bytes, source } = await modelBytes(entry.model, runtime);
    const { module, files } = await visionModule();
    const create = used => module.PoseLandmarker.createFromOptions(files, {
        baseOptions: { modelAssetBuffer: bytes, delegate: used }, runningMode: "VIDEO", numPoses: 1 });
    try {
        return { task: await create(delegate), source, delegate };
    } catch (error) {
        if (delegate !== "GPU") throw error;
        return { task: await create("CPU"), source, delegate: "CPU" };
    }
}

function release(entry) {
    ++entry.version; // Discards a load still in flight.
    entry.task?.close();
    entry.task = null;
    entry.stats.reset();
    entry.status = "idle";
    entry.error = null;
}

async function load(entry) {
    release(entry);
    const version = entry.version;
    entry.status = entry.model.bundled ? "loading" : "downloading";
    renderModels();
    try {
        const loaded = await createTask(entry, $("delegate").value);
        if (version !== entry.version) { loaded.task.close(); return; }
        Object.assign(entry, { task: loaded.task, status: loaded.source, delegate: loaded.delegate });
    } catch (error) {
        if (version !== entry.version) return;
        entry.status = "failed";
        entry.error = copy.en[error.message] ? error.message : cameraError(error.message);
    }
    renderModels();
}

function message(key, error = false) {
    messageKey = key;
    messageError = error;
    $("message").textContent = t(key);
    $("message").dataset.error = String(error);
}

function analyse() {
    const video = $("video");
    lastVideoTime = video.currentTime;
    const size = frameSize(video.videoWidth, video.videoHeight);
    if (!size) return;
    // Every model receives the same bounded image, as in the presentation's camera.
    frame ??= document.createElement("canvas");
    if (frame.width !== size.width || frame.height !== size.height) Object.assign(frame, size);
    frame.getContext("2d", { alpha: false }).drawImage(video, 0, 0, size.width, size.height);
    const time = lastTime = Math.max(lastTime + 1, Math.floor(performance.now()));
    const aspect = size.width / size.height;
    const poses = [];
    for (const entry of entries.filter(item => item.task)) {
        try {
            const started = performance.now();
            const points = entry.task.detectForVideo(frame, time).landmarks?.[0] ?? [];
            entry.stats.record(performance.now() - started, points, aspect);
            poses.push({ entry, points });
        } catch (error) {
            release(entry);
            entry.status = "failed";
            entry.error = cameraError(error.message);
            renderModels();
        }
    }
    drawPoses(poses, video);
    if (performance.now() - lastMetrics > 250) { lastMetrics = performance.now(); renderModels(); }
}

function drawPoses(poses, video) {
    const canvas = $("overlay");
    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
    }
    const context = canvas.getContext("2d");
    context.clearRect(0, 0, canvas.width, canvas.height);
    const style = getComputedStyle(document.body); // The palette is scoped to .studio.
    const visible = point => point && (point.visibility ?? 1) >= .6;
    context.lineWidth = Math.max(2, canvas.width / 320);
    for (const { entry, points } of poses) {
        context.strokeStyle = context.fillStyle = style.getPropertyValue(colors[entry.model.id]).trim();
        for (const [from, to] of bones) {
            if (!visible(points[from]) || !visible(points[to])) continue;
            context.beginPath();
            context.moveTo(points[from].x * canvas.width, points[from].y * canvas.height);
            context.lineTo(points[to].x * canvas.width, points[to].y * canvas.height);
            context.stroke();
        }
        for (const index of [15, 16]) {
            if (!visible(points[index])) continue;
            context.beginPath();
            context.arc(points[index].x * canvas.width, points[index].y * canvas.height, context.lineWidth * 3, 0, Math.PI * 2);
            context.fill();
        }
    }
}

function schedule() {
    const video = $("video");
    const run = generation;
    const next = () => {
        frameRequest = null;
        if (!stream || run !== generation) return;
        if (!document.hidden && video.readyState >= 2 && video.currentTime !== lastVideoTime) analyse();
        schedule();
    };
    frameRequest = typeof video.requestVideoFrameCallback === "function"
        ? { video: video.requestVideoFrameCallback(next) } : { animation: requestAnimationFrame(next) };
}

async function start() {
    if (busy || stream) return;
    if (!entries.some(entry => entry.selected)) { message("noModel", true); return; }
    const run = ++generation;
    busy = true;
    message("preparing");
    render();
    for (const entry of entries) if (entry.selected && !entry.task) load(entry);
    try {
        const media = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 }, audio: false });
        if (run !== generation) { media.getTracks().forEach(track => track.stop()); return; }
        stream = media;
        const video = $("video");
        video.srcObject = stream;
        await video.play();
        for (const track of stream.getTracks()) track.addEventListener("ended", () => {
            if (run === generation) { stop(); message("interruptedCamera", true); }
        }, { once: true });
        message("running");
        schedule();
    } catch (error) {
        if (run !== generation) return;
        stop();
        message(cameraError(`${error.name}: ${error.message}`), true);
    } finally {
        if (run === generation) busy = false;
        render();
    }
}

function stop() {
    ++generation;
    busy = false;
    if (frameRequest?.video != null) $("video").cancelVideoFrameCallback?.(frameRequest.video);
    if (frameRequest?.animation != null) cancelAnimationFrame(frameRequest.animation);
    frameRequest = null;
    stream?.getTracks().forEach(track => track.stop());
    stream = null;
    $("video").srcObject = null;
    lastVideoTime = -1;
    const canvas = $("overlay");
    canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
    message("stopped");
    render();
}

function formatted(value, unit = "", digits = 0) {
    if (value == null || !Number.isFinite(value)) return "–";
    return `${new Intl.NumberFormat(language, { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(value)}${unit}`;
}

function buildModels() {
    $("model-list").replaceChildren(...entries.map(entry => {
        const item = document.createElement("li");
        item.className = "model-card";
        item.dataset.model = entry.model.id;
        item.style.setProperty("--model-color", `var(${colors[entry.model.id]})`);
        const label = document.createElement("label");
        label.className = "check model-choice";
        const box = document.createElement("input");
        box.type = "checkbox";
        box.checked = entry.selected;
        box.addEventListener("change", () => {
            entry.selected = box.checked;
            if (!entry.selected) release(entry);
            else if (stream) load(entry);
            renderModels();
        });
        const name = document.createElement("strong");
        const size = document.createElement("span");
        size.className = "model-size";
        label.append(box, Object.assign(document.createElement("i"), { className: "model-swatch" }), name, size);
        const status = document.createElement("p");
        status.className = "hint model-status";
        status.setAttribute("aria-live", "polite");
        const values = document.createElement("dl");
        values.className = "model-metrics";
        const metrics = {};
        for (const key of ["median", "p95", "fps", "coverage", "wristJitter", "shoulderJitter"]) {
            const term = document.createElement("dt"), value = document.createElement("dd");
            term.dataset.copy = key;
            value.dataset.metric = key;
            values.append(term, value);
            metrics[key] = value;
        }
        entry.nodes = { box, name, size, status, metrics };
        item.append(label, status, values);
        return item;
    }));
}

function renderModels() {
    for (const entry of entries) {
        const { box, name, size, status, metrics } = entry.nodes;
        box.checked = entry.selected;
        box.disabled = busy;
        name.textContent = t(entry.model.id);
        size.textContent = formatted(entry.model.size / 1e6, language === "fr" ? " Mo" : " MB", 1);
        const fallback = entry.task && entry.delegate !== $("delegate").value ? ` · ${t("cpuFallback")}` : "";
        status.textContent = entry.status === "failed" ? `${t("failed")} · ${t(entry.error)}`
            : `${t(entry.status)}${entry.task ? ` · ${entry.delegate}` : ""}${fallback}`;
        status.dataset.error = String(entry.status === "failed");
        const summary = entry.stats.summary();
        metrics.median.textContent = formatted(summary.median, " ms");
        metrics.p95.textContent = formatted(summary.p95, " ms");
        metrics.fps.textContent = formatted(summary.fps);
        metrics.coverage.textContent = formatted(summary.coverage == null ? null : summary.coverage * 100, " %");
        for (const key of ["wristJitter", "shoulderJitter"]) {
            metrics[key].textContent = formatted(summary[key] == null ? null : summary[key] * 100, " %", 2);
        }
    }
}

function render() {
    document.documentElement.lang = language;
    for (const node of document.querySelectorAll("[data-copy]")) node.textContent = t(node.dataset.copy);
    for (const button of document.querySelectorAll("[data-language]")) {
        button.setAttribute("aria-pressed", String(button.dataset.language === language));
    }
    $("start").hidden = !!stream;
    $("start").disabled = busy;
    $("stop").hidden = !stream && !busy;
    $("delegate").disabled = busy;
    $("placeholder").hidden = !!stream;
    $("stage").dataset.running = String(!!stream);
    message(messageKey, messageError);
    theme.render();
    renderModels();
}

const theme = new ThemeToggle($("theme-toggle"), () => copy[language], { iconBase: "../" });
for (const button of document.querySelectorAll("[data-language]")) {
    button.addEventListener("click", () => { language = button.dataset.language; render(); });
}
$("start").addEventListener("click", start);
$("stop").addEventListener("click", stop);
$("reset").addEventListener("click", () => { for (const entry of entries) entry.stats.reset(); renderModels(); });
$("delegate").addEventListener("change", () => {
    for (const entry of entries) {
        if (entry.task || entry.status !== "idle") release(entry);
        if (entry.selected && stream) load(entry);
    }
    renderModels();
});
addEventListener("pagehide", () => { stop(); for (const entry of entries) release(entry); });
buildModels();
render();
