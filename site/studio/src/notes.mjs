export function lineCells(from, to) {
    const cells = [];
    let x = from.x, y = from.y;
    const dx = Math.abs(to.x - x), dy = Math.abs(to.y - y), sx = x < to.x ? 1 : -1, sy = y < to.y ? 1 : -1;
    let error = dx - dy;
    for (;;) {
        if (x >= -9 && x < 18 && y >= -9 && y < 18) cells.push({ x, y });
        if (x === to.x && y === to.y) return cells;
        const twice = error * 2;
        if (twice > -dy) { error -= dy; x += sx; }
        if (twice < dx) { error += dx; y += sy; }
    }
}
export class NoteLayer {
    constructor() { this.layers = new Map(); }
    cells(inputId) { return [...(this.layers.get(inputId) ?? [])].map(key => { const [x, y] = key.split(",").map(Number); return { x, y }; }); }
    paint(inputId, cells, erase = false) {
        if (!inputId) return;
        if (!this.layers.has(inputId)) {
            if (this.layers.size >= 64) this.layers.delete(this.layers.keys().next().value);
            this.layers.set(inputId, new Set());
        }
        const layer = this.layers.get(inputId);
        for (const { x, y } of cells) {
            if (!Number.isInteger(x) || !Number.isInteger(y) || x < -9 || x >= 18 || y < -9 || y >= 18) continue;
            const key = `${x},${y}`;
            if (erase) layer.delete(key); else layer.add(key);
        }
    }
    clear(inputId) { this.layers.delete(inputId); }
    restore(inputId, cells) { this.clear(inputId); this.paint(inputId, cells); }
    serialize() { return JSON.stringify([...this.layers].map(([id, cells]) => [id, [...cells]])); }
    load(text) {
        if (!text || text.length > 512 * 1024) return;
        const layers = JSON.parse(text);
        if (!Array.isArray(layers) || layers.length > 64) return;
        for (const layer of layers) {
            if (!Array.isArray(layer) || typeof layer[0] !== "string" || !Array.isArray(layer[1]) || layer[1].length > 729) continue;
            this.paint(layer[0], layer[1].filter(key => typeof key === "string").map(key => { const [x, y] = key.split(",").map(Number); return { x, y }; }));
        }
    }
}

export function previewCell(event, canvas, geometry, aspect, space, mirror = false) {
    const bounds = canvas.getBoundingClientRect();
    let x = (event.clientX - bounds.left) / bounds.width;
    const y = (event.clientY - bounds.top) / bounds.height;
    if (mirror) x = 1 - x;
    const point = geometry.local(x, y, aspect, space);
    if (!point) return null;
    const cell = { x: Math.floor(point.x), y: Math.floor(point.y) };
    return cell.x >= -9 && cell.x < 18 && cell.y >= -9 && cell.y < 18 ? cell : null;
}

export class LiveNoteBrush {
    constructor(canvas, { enabled, cellAt, begin, paint, finish, cancel, unavailable }) {
        this.stroke = null;
        canvas.addEventListener("pointerdown", event => {
            if (event.button !== 0 || !enabled()) return;
            const cell = cellAt(event);
            if (!cell) { unavailable(); return; }
            event.preventDefault();
            this.stroke = cell; this.gap = false; begin(); canvas.setPointerCapture(event.pointerId); paint([cell]);
        });
        canvas.addEventListener("pointermove", event => {
            if (!this.stroke) return;
            const cell = cellAt(event);
            if (!cell) { this.gap = true; return; }
            paint(this.gap ? [cell] : lineCells(this.stroke, cell)); this.gap = false; this.stroke = cell;
        });
        canvas.addEventListener("pointerup", () => { if (!this.stroke) return; this.stroke = this.previous = null; finish(); });
        this.cancel = () => { if (!this.stroke) return; this.stroke = this.previous = null; cancel(); };
        canvas.addEventListener("pointercancel", this.cancel);
        canvas.addEventListener("lostpointercapture", this.cancel);
    }
}
