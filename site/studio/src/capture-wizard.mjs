import { CaptureSequence, mergeTakes, TAKE_MS } from "./motion-capture.mjs";
import { captureCopy } from "./capture-copy.mjs";
import { createStudioSession, PreviewGrid, trackedPoint, validateProfile } from "./camera.mjs";
import { drawPreview } from "./grid.mjs";
import { landmarks, id } from "./profile.mjs";

export class CaptureWizard {
    constructor({ language, label, onAccept }) {
        this.language = language; this.label = label; this.onAccept = onAccept;
        this.generation = 0; this.revision = 0; this.session = null;
        this.dialog = document.createElement("dialog"); this.dialog.id = "capture-dialog";
        this.dialog.className = "capture-dialog"; this.dialog.setAttribute("aria-labelledby", "capture-title");
        this.dialog.innerHTML = `
            <div class="dialog-heading"><h2 id="capture-title" data-capture-text="title"></h2><button id="capture-close" type="button" class="square-button">×</button></div>
            <p class="hint" data-capture-text="hint"></p>
            <ol class="capture-steps"><li data-capture-text="record"></li><li data-capture-text="test"></li><li data-capture-text="keys"></li></ol>
            <div class="field-row"><label class="field"><span data-capture-text="part"></span><select id="capture-part"></select></label>
            <label class="field"><span data-capture-text="preset"></span><select id="capture-preset" aria-describedby="capture-tradeoff"><option value="tolerant" data-capture-text="tolerant"></option><option value="normal" data-capture-text="normal"></option><option value="precise" data-capture-text="precise"></option></select></label></div>
            <p id="capture-tradeoff" class="hint" data-capture-text="tradeoff"></p>
            <details id="capture-settings"><summary data-capture-text="settings"></summary>
                <label class="field"><span data-capture-text="name"></span><input id="capture-name" maxlength="80"></label>
                <label class="field"><span data-capture-text="reference"></span><select id="capture-space"><option value="body" data-capture-text="body"></option><option value="calibrated" data-capture-text="calibrated"></option></select></label>
                <p class="hint" data-capture-text="referenceHint"></p></details>
            <div class="capture-camera" data-mirror="true"><video id="capture-video" muted playsinline aria-hidden="true"></video><canvas id="capture-overlay" aria-hidden="true"></canvas><strong id="capture-countdown" aria-hidden="true"></strong></div>
            <p id="capture-status" role="status" aria-live="polite" aria-atomic="true" tabindex="-1"></p>
            <progress id="capture-progress" max="5000" value="0" hidden></progress>
            <p id="capture-error" class="feedback" role="alert" data-error="true" hidden></p>
            <p id="capture-legend" class="hint" data-capture-text="legend" hidden></p>
            <p class="privacy" data-capture-text="privacy"></p>
            <div class="dialog-actions capture-actions"><button id="capture-reset" class="text-button" type="button" data-capture-text="reset"></button>
            <button id="capture-camera-start" class="button primary" type="button" data-capture-text="camera"></button>
            <button id="capture-record" class="button primary" type="button" data-capture-text="start"></button>
            <button id="capture-stop" class="button primary" type="button" data-capture-text="stop" aria-keyshortcuts="S Space"></button>
            <button id="capture-use" class="button primary" type="button" data-capture-text="use"></button></div>`;
        document.body.append(this.dialog);
        this.$ = key => this.dialog.querySelector(`#capture-${key}`);
        this.$("close").onclick = () => this.close();
        this.dialog.addEventListener("cancel", event => { event.preventDefault(); this.close(); });
        this.$("camera-start").onclick = () => this.startCamera();
        this.$("record").onclick = () => { if (!this.canRecord()) return; this.sequence.start(performance.now()); this.error = null; this.render(); };
        this.$("stop").onclick = () => this.finish();
        this.$("reset").onclick = () => this.reset();
        this.$("preset").onchange = () => { if (this.sequence.phase === "complete") this.prepare(); else this.render(); };
        this.$("part").onchange = () => { this.point = null; this.render(); };
        this.$("space").onchange = () => { this.geometry.reset(); this.point = null; this.render(); };
        this.$("name").onchange = () => {
            if (this.sequence.phase === "complete" && !this.candidate) this.prepare();
        };
        this.$("use").onclick = () => this.accept();
        this.dialog.addEventListener("keydown", event => {
            if (this.sequence?.phase !== "recording" || event.ctrlKey || event.metaKey || event.altKey || event.isComposing
                || event.target.closest("input, textarea, select, [contenteditable='true'], #capture-close")) return;
            if (event.key.toLowerCase() !== "s" && event.key !== " ") return;
            event.preventDefault(); if (!event.repeat) this.finish();
        });
        document.addEventListener("visibilitychange", () => { if (document.hidden) this.close(); });
        window.addEventListener("pagehide", () => this.close());
    }
    text(key, values = {}) {
        return Object.entries(values).reduce((result, [name, value]) => result.replaceAll(`{${name}}`, String(value)), captureCopy[this.language()][key] ?? captureCopy.en.unknown);
    }
    open({ landmark = "left_wrist", space = "body" } = {}) {
        this.close(); this.sequence = new CaptureSequence(); this.geometry = new PreviewGrid();
        this.identifier = id("captured"); this.candidate = null; this.matches = 0; this.error = null; this.lastFrame = -Infinity;
        this.$("part").replaceChildren(...Object.keys(landmarks).map(key => {
            const option = document.createElement("option"); option.value = key; option.textContent = this.label(key); return option;
        }));
        this.$("part").value = Object.hasOwn(landmarks, landmark) ? landmark : "left_wrist";
        this.$("space").value = space === "calibrated" ? space : "body";
        this.$("preset").value = "normal"; this.$("name").value = this.text("defaultName");
        for (const node of this.dialog.querySelectorAll("[data-capture-text]")) node.textContent = this.text(node.dataset.captureText);
        this.$("close").setAttribute("aria-label", this.text("close"));
        this.$("progress").setAttribute("aria-label", this.text("time"));
        this.dialog.showModal(); this.render(); this.$("part").focus();
        this.timer = setInterval(() => {
            const was = this.sequence.phase; this.sequence.tick(performance.now());
            if (was === "recording" && this.sequence.phase !== was) this.finished();
            this.render();
            if (was === "countdown" && this.sequence.phase === "recording") this.$("stop").focus();
        }, 100);
    }
    close() {
        ++this.generation; ++this.revision; clearInterval(this.timer); this.timer = null;
        this.sequence?.cancel(); this.session?.dispose(); this.session = null; this.cameraBusy = false; this.preparing = false;
        this.candidate = null; if (this.dialog.open) this.dialog.close();
    }
    canRecord() {
        const local = this.point && this.geometry.local(this.point.x, this.point.y,
            this.session?.video?.videoWidth / this.session?.video?.videoHeight, this.$("space").value);
        return this.sequence.phase === "ready" && !this.cameraBusy && this.session?.state.running && local
            && local.x >= -9 && local.x < 18 && local.y >= -9 && local.y < 18
            && (this.point.confidence ?? 1) >= .6 && performance.now() - this.lastFrame <= 180;
    }
    async startCamera() {
        if (this.cameraBusy || this.session?.state.running) return;
        const token = ++this.generation; this.error = null; this.cameraBusy = true; this.render();
        let candidate;
        try {
            candidate = await createStudioSession(event => {
                if (this.session === candidate && this.candidate && this.sequence.phase === "complete" && !this.preparing
                    && event.id === this.candidate.id) { this.matches++; this.render(); }
            }, current => this.frame(current), () => this.dialog.open);
            if (token !== this.generation) { candidate.dispose(); return; }
            this.session = candidate; this.geometry.reset();
            await candidate.start(this.$("video"), this.$("overlay"));
            if (token !== this.generation) { candidate.dispose(); return; }
            if (!candidate.state.running) throw new Error("cameraError");
            for (const track of candidate.stream?.getTracks() ?? []) track.addEventListener("ended", () => {
                if (this.session !== candidate) return;
                this.cameraFailed();
            }, { once: true });
            candidate.subscribe(state => {
                if (this.session === candidate && !state.running && !state.busy && !this.cameraBusy) this.cameraFailed();
            });
            if (this.sequence.phase === "complete") await this.prepare();
        } catch {
            candidate?.dispose();
            if (token !== this.generation) return;
            this.session = null; this.error = "cameraError";
        } finally { if (token === this.generation) { this.cameraBusy = false; this.render(); } }
    }
    cameraFailed() {
        ++this.revision; this.preparing = false; this.matches = 0;
        const current = this.session; this.session = null; current?.dispose();
        if (["countdown", "recording"].includes(this.sequence.phase)) {
            this.sequence.take = null; this.sequence.phase = "ready"; this.sequence.deadline = null;
        }
        this.geometry.reset(); this.point = null; this.error = "captureCameraEnded"; this.render();
    }
    frame(current) {
        if (current !== this.session || !this.dialog.open) return;
        const video = current.video, now = performance.now();
        if (!video?.videoWidth || !video.videoHeight) return;
        this.lastFrame = now;
        const aspect = video.videoWidth / video.videoHeight;
        this.geometry.observe(current.coordinate(11), current.coordinate(12), aspect, now);
        this.point = trackedPoint(current, this.$("part").value);
        const local = this.point && this.geometry.local(this.point.x, this.point.y, aspect, this.$("space").value);
        this.sequence.observe(local && { ...local, confidence: this.point.confidence }, now);
        const display = this.candidate ?? { space: this.$("space").value, steps: [] };
        drawPreview(this.$("overlay"), current, {inputs:[display]}, 0, this.geometry, { points: false });
        const canvas = this.$("overlay"), ctx = canvas.getContext("2d");
        if (this.point && (this.point.confidence ?? 1) >= .6 && ctx) {
            ctx.beginPath(); ctx.arc(this.point.x * canvas.width, this.point.y * canvas.height, 7, 0, Math.PI * 2);
            ctx.fillStyle = "#fff"; ctx.strokeStyle = "#111923"; ctx.lineWidth = 2; ctx.fill(); ctx.stroke();
        }
        this.render();
    }
    finish() {
        if (this.sequence.phase !== "recording") return;
        this.sequence.finish(performance.now()); this.finished(); this.render();
    }
    finished() {
        this.error = this.sequence.error;
        if (this.sequence.phase === "complete") this.prepare();
        else { this.render(); this.$("record").focus(); }
    }
    reset() {
        ++this.revision; this.preparing = false; this.sequence = new CaptureSequence(); this.candidate = null; this.matches = 0; this.error = null;
        const current = this.session, revision = this.revision;
        current?.importJSON('{"schema_version":2,"inputs":[]}').catch(() => {
            if (current === this.session && revision === this.revision) this.cameraFailed();
        });
        this.geometry.reset(); this.render();
    }
    async prepare() {
        const revision = ++this.revision; this.preparing = true; this.candidate = null; this.matches = 0; this.error = null; this.render();
        try {
            if (!this.$("name").value.trim() || new TextEncoder().encode(this.$("name").value.trim()).length > 80) throw new Error("captureName");
            const candidate = mergeTakes(this.sequence.takes, { landmark: this.$("part").value, preset: this.$("preset").value,
                space: this.$("space").value, name: this.$("name").value.trim(), id: this.identifier });
            const json = JSON.stringify({schema_version:2,tracking:{hands:false},inputs:[candidate]});
            await validateProfile(json);
            if (revision !== this.revision || !this.dialog.open) return;
            await this.session?.importJSON(json);
            if (revision !== this.revision || !this.dialog.open) return;
            this.candidate = candidate; this.geometry.reset(); this.$("status").focus();
        } catch (error) { if (revision === this.revision) this.error = Object.hasOwn(captureCopy.en, error.message) ? error.message : "unknown"; }
        finally { if (revision === this.revision) { this.preparing = false; this.render(); } }
    }
    async accept() {
        if (!this.candidate || !this.matches || this.preparing || this.cameraBusy || !this.session?.state.running) return;
        const movement = this.candidate;
        const name = this.$("name").value.trim();
        if (!name || new TextEncoder().encode(name).length > 80) { this.error = "captureName"; this.render(); return; }
        movement.name = name; this.close(); this.onAccept(movement);
    }
    render() {
        if (!this.dialog.open) return;
        const phase = this.sequence.phase, running = !!this.session?.state.running;
        const timed = phase === "countdown" || phase === "recording", complete = phase === "complete";
        const remaining = Math.max(0, Math.ceil((this.sequence.deadline - performance.now()) / 1000));
        const local = this.point && this.geometry.local(this.point.x, this.point.y,
            this.session?.video?.videoWidth / this.session?.video?.videoHeight, this.$("space").value);
        const outside = local && (local.x < -9 || local.x >= 18 || local.y < -9 || local.y >= 18);
        const key = this.cameraBusy ? "loading" : this.preparing ? "merging" : !running ? "idle" : complete
            ? this.matches ? "recognized" : "try" : timed ? phase : this.canRecord() ? "ready" : outside ? "captureOutsideGrid" : "calibrate";
        const status = this.text(key, {take:this.sequence.takes.length + 1,seconds:remaining,count:this.matches});
        if (this.$("status").textContent !== status) this.$("status").textContent = status;
        this.$("countdown").textContent = phase === "countdown" ? String(remaining) : "";
        this.$("progress").hidden = phase !== "recording"; this.$("progress").value = timed ? Math.max(0, TAKE_MS - (this.sequence.deadline - performance.now())) : 0;
        this.$("camera-start").hidden = running; this.$("camera-start").disabled = !!this.cameraBusy;
        this.$("record").hidden = !running || timed || complete; this.$("record").disabled = !this.canRecord();
        this.$("stop").hidden = phase !== "recording";
        this.$("reset").hidden = !this.sequence.takes.length && !this.error; this.$("reset").disabled = timed || !!this.preparing;
        this.$("use").hidden = !complete; this.$("use").disabled = !this.candidate || !this.matches || !!this.preparing || !!this.cameraBusy || !running;
        this.$("legend").hidden = !this.candidate;
        for (const field of ["part", "space"]) this.$(field).disabled = timed || !!this.sequence.takes.length || !!this.preparing || !!this.cameraBusy;
        this.$("preset").disabled = timed || !!this.preparing;
        this.$("name").disabled = timed;
        const error = this.error ? this.text(this.error) : "";
        this.$("error").hidden = !error;
        if (this.$("error").textContent !== error) this.$("error").textContent = error;
        this.dialog.querySelectorAll(".capture-steps li").forEach((node, index) => {
            if (index === (complete ? 1 : 0)) node.setAttribute("aria-current", "step"); else node.removeAttribute("aria-current");
        });
    }
}
