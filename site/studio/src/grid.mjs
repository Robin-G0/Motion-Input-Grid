import { cellRect, regions } from "./profile.mjs";
import { trackedPoint } from "./camera.mjs";

export function drawPreview(canvas, session, profile, inputIndex, geometry, { grid = true, points = true, full = false, notes = [] } = {}) {
    const video = session.video;
    if (!video?.videoWidth || !video.videoHeight) return;
    const aspect = video.videoWidth / video.videoHeight;
    const scale = Math.min(1, 960 / Math.max(video.videoWidth, video.videoHeight));
    const width = Math.max(1, Math.round(video.videoWidth * scale)), height = Math.max(1, Math.round(video.videoHeight * scale));
    if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);
    const input = profile.inputs[inputIndex];
    if (!input) return;
    const space = input.space ?? "calibrated";
    const active = !!session.tracker?.active?.(inputIndex);
    const colors = { required: "#a7d7c3", trigger: "#e9c18a", forbidden: "#ffaaa6", interaction: "#c7b1e0" };
    const project = (x, y) => geometry.project(x, y, aspect, space);
    const path = list => {
        const vertices = list.map(([x, y]) => project(x, y));
        if (vertices.some(p => !p)) return false;
        ctx.beginPath();
        vertices.forEach((p, i) => ctx[i ? "lineTo" : "moveTo"](p.x * width, p.y * height));
        return true;
    };
    if (grid && geometry.transform(space)) {
        const min = full ? -9 : -4, max = full ? 18 : 14;
        ctx.strokeStyle = "#ffffff55"; ctx.lineWidth = 1;
        for (let cell = min; cell <= max; cell++) {
            if (path([[min, cell], [max, cell]])) ctx.stroke();
            if (path([[cell, min], [cell, max]])) ctx.stroke();
        }
        for (const region of regions(input)) {
            const { x, y, w, h } = cellRect(region.cell);
            if (!path([[x, y], [x + w, y], [x + w, y + h], [x, y + h]])) continue;
            ctx.closePath();
            const color = colors[region.type] ?? "#fff";
            ctx.fillStyle = `${color}33`; ctx.strokeStyle = color;
            ctx.lineWidth = active ? 3 : 1.5;
            ctx.setLineDash(region.priority === "low" ? [4, 4] : []);
            ctx.fill(); ctx.stroke(); ctx.setLineDash([]);
            const centre = project(x + w / 2, y + h / 2);
            ctx.save();
            ctx.translate(centre.x * width, centre.y * height);
            if (canvas.closest("[data-mirror='true']")) ctx.scale(-1, 1);
            const label = region.type === "forbidden" ? "×" : region.type === "interaction" ? "◇" : String(region.order || "•");
            ctx.font = "bold 13px Consolas, monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
            ctx.fillStyle = "#111923d9"; ctx.fillRect(-11, -11, 22, 22);
            ctx.fillStyle = color; ctx.fillText(label, 0, 0); ctx.restore();
        }
    }
    if (geometry.transform(space)) {
        ctx.strokeStyle = "#a1d5f3"; ctx.fillStyle = "#75bdec55"; ctx.lineWidth = 1.5; ctx.setLineDash([3, 3]);
        for (const { x, y } of notes) {
            if (!path([[x, y], [x + 1, y], [x + 1, y + 1], [x, y + 1]])) continue;
            ctx.closePath(); ctx.fill(); ctx.stroke();
        }
        ctx.setLineDash([]);
    }
    if (points) {
        const names = new Set(["left_shoulder", "right_shoulder", ...regions(input).map(c => c.landmark)]);
        for (const name of names) {
            const point = trackedPoint(session, name);
            if (!point || (point.confidence ?? 1) < .6) continue;
            ctx.beginPath(); ctx.arc(point.x * width, point.y * height, name.includes("shoulder") ? 3 : 5, 0, Math.PI * 2);
            ctx.fillStyle = "#fff"; ctx.strokeStyle = "#111923"; ctx.lineWidth = 2; ctx.fill(); ctx.stroke();
        }
    }
}

export class GridEditor {
    constructor(root, overlays, selection, onDraw, text) {
        this.root = root; this.overlays = overlays; this.selection = selection; this.onDraw = onDraw; this.text = text;
        this.min = -4; this.size = 18; this.focusCell = 0;
        root.addEventListener("pointerdown", event => {
            if (event.button !== 0 || !this.enabled) return;
            this.from = this.cellAt(event); this.to = this.from;
            root.setPointerCapture(event.pointerId); this.showSelection();
        });
        root.addEventListener("pointermove", event => {
            if (!this.from) return;
            this.to = this.cellAt(event); this.showSelection();
        });
        root.addEventListener("pointerup", () => {
            if (!this.from) return;
            const from = this.from, to = this.to; this.cancel(); this.onDraw(from, to);
        });
        root.addEventListener("pointercancel", () => this.cancel());
        root.addEventListener("lostpointercapture", () => this.cancel());
        root.addEventListener("click", event => {
            if (event.detail || !this.enabled || !event.target.closest("button")) return;
            const cell = { x: Number(event.target.dataset.x), y: Number(event.target.dataset.y) };
            this.onDraw(cell, cell);
        });
        root.addEventListener("keydown", event => {
            if (event.key === "Escape") { this.cancel(); return; }
            const offset = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -this.size, ArrowDown: this.size }[event.key];
            if (offset == null) return;
            event.preventDefault();
            this.focusCell = Math.max(0, Math.min(this.size ** 2 - 1, this.focusCell + offset));
            this.root.querySelectorAll("button").forEach((button, i) => button.tabIndex = i === this.focusCell ? 0 : -1);
            this.root.children[this.focusCell].focus();
        });
        root.addEventListener("focusin", event => {
            if (event.target.tagName !== "BUTTON") return;
            this.focusCell = [...root.children].indexOf(event.target);
            for (const button of root.children) button.tabIndex = button === event.target ? 0 : -1;
        });
    }
    cancel() { this.from = this.to = null; this.selection.hidden = true; }
    cellAt(event) {
        const bounds = this.root.getBoundingClientRect();
        return { x: this.min + Math.max(0, Math.min(this.size - 1, Math.floor((event.clientX - bounds.left) / bounds.width * this.size))),
            y: this.min + Math.max(0, Math.min(this.size - 1, Math.floor((event.clientY - bounds.top) / bounds.height * this.size))) };
    }
    position(node, { x, y, w, h }) {
        node.style.left = `${(x - this.min) / this.size * 100}%`;
        node.style.top = `${(y - this.min) / this.size * 100}%`;
        node.style.width = `${w / this.size * 100}%`; node.style.height = `${h / this.size * 100}%`;
    }
    showSelection() {
        this.selection.hidden = false;
        this.position(this.selection, { x: Math.min(this.from.x, this.to.x), y: Math.min(this.from.y, this.to.y), w: Math.abs(this.from.x - this.to.x) + 1, h: Math.abs(this.from.y - this.to.y) + 1 });
    }
    render(input, scope, selected, full, enabled = true) {
        this.enabled = enabled && !!input; this.min = full ? -9 : -4; this.size = full ? 27 : 18;
        const active = document.activeElement?.closest("#editor-grid button");
        const cellsChanged = this.root.children.length !== this.size ** 2;
        this.root.style.setProperty("--cells", this.size);
        this.root.parentElement.style.setProperty("--cells", this.size);
        if (cellsChanged) {
            this.focusCell = 0;
            const fragment = document.createDocumentFragment();
            for (let y = this.min; y < this.min + this.size; y++) for (let x = this.min; x < this.min + this.size; x++) {
                const button = document.createElement("button");
                button.type = "button"; button.className = "grid-cell"; button.dataset.x = x; button.dataset.y = y;
                fragment.append(button);
            }
            this.root.replaceChildren(fragment);
        }
        const all = regions(input);
        const occupancy = new Map();
        for (const region of all) {
            const r = cellRect(region.cell);
            for (let y = Math.max(this.min, r.y); y < Math.min(this.min + this.size, r.y + r.h); y++) {
                for (let x = Math.max(this.min, r.x); x < Math.min(this.min + this.size, r.x + r.w); x++) {
                    const key = `${x},${y}`;
                    if (!occupancy.has(key)) occupancy.set(key, new Set());
                    occupancy.get(key).add(region.type);
                }
            }
        }
        [...this.root.children].forEach((button, index) => {
            button.tabIndex = index === this.focusCell ? 0 : -1;
            button.disabled = !this.enabled;
            const matches = occupancy.get(`${button.dataset.x},${button.dataset.y}`);
            button.setAttribute("aria-label", `[${button.dataset.x}, ${button.dataset.y}]${matches?.size ? ` · ${[...matches].map(type => this.text(type)).join(", ")}` : ""}`);
            button.dataset.baseLabel = button.getAttribute("aria-label");
        });
        if (active && cellsChanged) this.root.children[this.focusCell]?.focus();
        const current = scope === "global" ? input?.constraints : input?.steps?.[Number(scope)]?.constraints;
        const fragment = document.createDocumentFragment();
        for (const region of all) {
            const node = document.createElement("div");
            node.className = `grid-region ${region.type}${current?.includes(region) ? "" : " other-scope"}${region.id === selected ? " selected" : ""}${input.constraints?.includes(region) ? " global-region" : ""}${region.priority === "low" ? " low-region" : ""}`;
            node.classList.toggle("wide", cellRect(region.cell).w > 1);
            this.position(node, cellRect(region.cell));
            const r = cellRect(region.cell);
            node.style.setProperty("--label-left", `${Math.max(.2, this.min - r.x + .25) / r.w * 100}%`);
            const visibleTop = Math.max(this.min, r.y), visibleBottom = Math.min(this.min + this.size, r.y + r.h);
            node.style.setProperty("--label-top", `${((visibleTop + visibleBottom) / 2 - r.y) / r.h * 100}%`);
            const label = document.createElement("span"); label.textContent = region.type === "forbidden" ? "×" : region.type === "interaction" ? "◇" : String(region.order || "•");
            node.append(label); fragment.append(node);
        }
        this.overlays.replaceChildren(fragment);
        const area = this.root.parentElement;
        area.style.setProperty("--anchor-x", `${(4.5 - this.min) / this.size * 100}%`);
        area.style.setProperty("--anchor-y", `${(3.5 - this.min) / this.size * 100}%`);
    }
    renderNotes(root, cells) {
        const marked = new Set(cells.map(cell => `${cell.x},${cell.y}`));
        for (const button of this.root.children) button.setAttribute("aria-label", `${button.dataset.baseLabel}${marked.has(`${button.dataset.x},${button.dataset.y}`) ? ` · ${this.text("annotated")}` : ""}`);
        root.replaceChildren(...cells.map(cell => {
            const node = document.createElement("div"); node.className = "grid-note";
            this.position(node, { ...cell, w: 1, h: 1 }); return node;
        }));
    }
}
