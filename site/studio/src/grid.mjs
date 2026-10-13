import { cellRect, regions } from "./profile.mjs";
import { trackedPoint } from "./camera.mjs";

export function transformRect(rect, handle, dx, dy) {
    let {x, y, w, h} = rect;
    if (handle === "move") return { x: Math.max(-9, Math.min(18 - w, x + dx)), y: Math.max(-9, Math.min(18 - h, y + dy)), w, h };
    const right = x + w, bottom = y + h;
    if (handle.includes("w")) { x = Math.max(-9, Math.min(right - 1, x + dx)); w = right - x; }
    if (handle.includes("e")) w = Math.max(1, Math.min(18 - x, w + dx));
    if (handle.includes("n")) { y = Math.max(-9, Math.min(bottom - 1, y + dy)); h = bottom - y; }
    if (handle.includes("s")) h = Math.max(1, Math.min(18 - y, h + dy));
    return { x, y, w, h };
}
export function selectionRect(selected) {
    const rects = selected.map(region => cellRect(region.cell));
    if (!rects.length) return null;
    const x = Math.min(...rects.map(rect => rect.x)), y = Math.min(...rects.map(rect => rect.y));
    return {x, y, w:Math.max(...rects.map(rect => rect.x + rect.w)) - x, h:Math.max(...rects.map(rect => rect.y + rect.h)) - y};
}
export function transformSelection(selected, original, next) {
    for (const region of selected) {
        const rect = cellRect(region.cell);
        const x = Math.max(next.x, Math.min(next.x + next.w - 1, next.x + Math.round((rect.x - original.x) / original.w * next.w)));
        const y = Math.max(next.y, Math.min(next.y + next.h - 1, next.y + Math.round((rect.y - original.y) / original.h * next.h)));
        const right = Math.max(x + 1, Math.min(next.x + next.w, next.x + Math.round((rect.x + rect.w - original.x) / original.w * next.w)));
        const bottom = Math.max(y + 1, Math.min(next.y + next.h, next.y + Math.round((rect.y + rect.h - original.y) / original.h * next.h)));
        region.cell = [x, y, right - x, bottom - y];
    }
}

export function drawPreview(canvas, session, profile, inputIndex, geometry, { grid = true, points = true, full = false, notes = [], shoulderLabels = {left:"L",right:"R"} } = {}) {
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
            if (name.endsWith("_shoulder")) {
                ctx.save(); ctx.translate(point.x * width, point.y * height);
                if (canvas.closest("[data-mirror='true']")) ctx.scale(-1, 1);
                ctx.fillStyle = "#111923"; ctx.fillRect(-10, -26, 20, 18);
                ctx.fillStyle = "#fff"; ctx.font = "bold 12px Consolas, monospace"; ctx.textAlign = "center";
                ctx.fillText(shoulderLabels[name.startsWith("left") ? "left" : "right"], 0, -12); ctx.restore();
            }
        }
    }
}

export class GridEditor {
    constructor(root, overlays, selection, onDraw, text, onTransform = () => {}) {
        this.root = root; this.overlays = overlays; this.selection = selection; this.onDraw = onDraw; this.text = text;
        this.min = -4; this.size = 18; this.focusCell = 0;
        this.handles = document.createElement("div"); this.handles.className = "region-handles"; this.handles.hidden = true; root.parentElement.append(this.handles);
        this.onTransform = onTransform;
        for (const name of ["n", "s", "e", "w", "nw", "ne", "sw", "se"]) {
            const button = document.createElement("button"); button.type = "button"; button.dataset.handle = name.length === 1 ? "move" : name;
            button.dataset.corner = name; button.className = name.length === 1 ? "handle-edge" : "handle-corner";
            button.dataset.edge = name;
            this.handles.append(button);
        }
        this.handles.addEventListener("pointerdown", event => {
            const button = event.target.closest("button");
            if (!button || !this.enabled || event.button !== 0 || this.drag) return;
            event.preventDefault();
            const viewport = this.root.parentElement.parentElement;
            this.drag = {id:this.selected.id, rect:cellRect(this.selected.cell), handle:button.dataset.handle, x:event.clientX, y:event.clientY, scrollX:viewport.scrollLeft, scrollY:viewport.scrollTop};
            this.handles.setPointerCapture(event.pointerId);
        });
        this.handles.addEventListener("pointermove", event => {
            if (!this.drag) return;
            const unit = this.root.getBoundingClientRect().width / this.size;
            const viewport = this.root.parentElement.parentElement;
            const dx = Math.round((event.clientX - this.drag.x + viewport.scrollLeft - this.drag.scrollX) / unit) * (this.mirror ? -1 : 1), dy = Math.round((event.clientY - this.drag.y + viewport.scrollTop - this.drag.scrollY) / unit);
            this.drag.next = transformRect(this.drag.rect, this.drag.handle, dx, dy);
            this.selection.hidden = false; this.position(this.selection, this.drag.next); this.positionHandles(this.drag.next);
        });
        this.handles.addEventListener("pointerup", () => {
            if (!this.drag) return;
            const {id, next, rect} = this.drag; this.cancel();
            if (next) this.onTransform(id, next); else this.positionHandles(rect);
        });
        this.handles.addEventListener("pointercancel", () => this.cancel());
        this.handles.addEventListener("lostpointercapture", () => { if (this.drag) this.cancel(); });
        this.handles.addEventListener("keydown", event => {
            if (event.key === "Escape") { this.cancel(); return; }
            const button = event.target.closest("button"), arrows = {ArrowLeft:[this.mirror?1:-1,0],ArrowRight:[this.mirror?-1:1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};
            if (!button || !arrows[event.key]) return;
            event.preventDefault(); const corner = button.dataset.handle;
            this.onTransform(this.selected.id, transformRect(cellRect(this.selected.cell), corner, ...arrows[event.key]));
            this.handles.querySelector(`[data-corner="${button.dataset.corner}"]`)?.focus();
        });
        root.addEventListener("pointerdown", event => {
            if (event.button !== 0 || !this.enabled || this.noteMode) return;
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
            const offset = { ArrowLeft: this.mirror ? 1 : -1, ArrowRight: this.mirror ? -1 : 1, ArrowUp: -this.size, ArrowDown: this.size }[event.key];
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
    cancel() { this.from = this.to = this.drag = null; this.selection.hidden = true; if (this.selected) this.positionHandles(cellRect(this.selected.cell)); }
    positionHandles(rect) {
        const x = Math.max(this.min, rect.x), y = Math.max(this.min, rect.y);
        const w = Math.min(this.min + this.size, rect.x + rect.w) - x, h = Math.min(this.min + this.size, rect.y + rect.h) - y;
        this.handles.hidden = w <= 0 || h <= 0 || !this.selectionEnabled || !this.enabled;
        if (!this.handles.hidden) this.position(this.handles, {x, y, w, h});
    }
    cellAt(event) {
        const bounds = this.root.getBoundingClientRect();
        const horizontal = (event.clientX - bounds.left) / bounds.width;
        return { x: this.min + Math.max(0, Math.min(this.size - 1, Math.floor((this.mirror ? 1 - horizontal : horizontal) * this.size))),
            y: this.min + Math.max(0, Math.min(this.size - 1, Math.floor((event.clientY - bounds.top) / bounds.height * this.size))) };
    }
    position(node, { x, y, w, h }) {
        node.style.left = `${(this.mirror ? this.min + this.size - x - w : x - this.min) / this.size * 100}%`;
        node.style.top = `${(y - this.min) / this.size * 100}%`;
        node.style.width = `${w / this.size * 100}%`; node.style.height = `${h / this.size * 100}%`;
    }
    showSelection() {
        this.selection.hidden = false;
        this.position(this.selection, { x: Math.min(this.from.x, this.to.x), y: Math.min(this.from.y, this.to.y), w: Math.abs(this.from.x - this.to.x) + 1, h: Math.abs(this.from.y - this.to.y) + 1 });
    }
    render(input, scope, selected, full, enabled = true, mirror = true) {
        this.enabled = enabled && !!input; this.min = full ? -9 : -4; this.size = full ? 27 : 18;
        this.mirror = mirror;
        this.root.style.direction = mirror ? "rtl" : "ltr";
        this.root.parentElement.dataset.mirror = String(mirror);
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
        const selectedIds = Array.isArray(selected) ? selected : selected ? [selected] : [];
        const selectedItems = all.filter(region => selectedIds.includes(region.id));
        const group = selectionRect(selectedItems);
        this.selected = selectedItems.length > 1 ? {id:"__selection__",cell:[group.x,group.y,group.w,group.h]} : selectedItems[0];
        this.handles.hidden = !this.selected || !this.selectionEnabled || !this.enabled;
        if (this.selected) this.positionHandles(cellRect(this.selected.cell));
        for (const button of this.handles.children) {
            const logical = button.dataset.handle === "move" ? button.dataset.edge : button.dataset.handle;
            const native = this.mirror ? logical.replace(/[ew]/g, side => side === "e" ? "w" : "e") : logical;
            button.dataset.corner = native;
            button.setAttribute("aria-label", this.text(button.dataset.handle === "move" ? "moveZone" : "resizeZone"));
        }
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
            node.className = `grid-region ${region.type}${current?.includes(region) ? "" : " other-scope"}${selectedIds.includes(region.id) ? " selected" : ""}${input.constraints?.includes(region) ? " global-region" : ""}${region.priority === "low" ? " low-region" : ""}`;
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
        const anchor = (4.5 - this.min) / this.size;
        area.style.setProperty("--anchor-x", `${(mirror ? 1 - anchor : anchor) * 100}%`);
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
    renderShoulders(points = {left:{x:7,y:3.5},right:{x:2,y:3.5}}) {
        for (const side of ["left", "right"]) {
            let marker = this.root.parentElement.querySelector(`[data-shoulder="${side}"]`);
            if (!marker) { marker = document.createElement("span"); marker.className = "shoulder-marker"; marker.dataset.shoulder = side; this.root.parentElement.append(marker); }
            const point = points?.[side]; marker.hidden = !point;
            if (!point) continue;
            const x = (point.x - this.min) / this.size;
            marker.style.left = `${(this.mirror ? 1 - x : x) * 100}%`; marker.style.top = `${(point.y - this.min) / this.size * 100}%`;
            marker.textContent = this.text(side === "left" ? "shoulderLeftShort" : "shoulderRightShort");
            marker.setAttribute("aria-label", `${this.text(`${side}_shoulder`)} [${point.x.toFixed(1)}, ${point.y.toFixed(1)}]`);
            marker.title = marker.getAttribute("aria-label");
        }
    }
}
