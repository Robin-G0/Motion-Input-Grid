// Only selected-point grid coordinates are retained, never video or full poses.
export const TAKE_MS = 5000;
export const TAKE_COUNT = 3;
const GAP_MS = 180, SAMPLE_MS = 30, MAX_SAMPLES = 170;
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const median = values => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
const fail = key => { throw new Error(key); };
const usable = p => p && Number.isFinite(p.x) && Number.isFinite(p.y)
    && Number.isFinite(p.confidence ?? 1) && (p.confidence ?? 1) >= .6 && (p.confidence ?? 1) <= 1
    && p.x >= -9 && p.x < 18 && p.y >= -9 && p.y < 18;

export class MotionTake {
    constructor(start) { this.start = start; this.samples = []; this.lastTime = -Infinity; this.error = null; }
    observe(point, time) {
        if (!Number.isFinite(time) || time < this.start || time <= this.lastTime || time > this.start + TAKE_MS) return;
        this.lastTime = time;
        if (!usable(point)) return;
        const previous = this.samples.at(-1);
        if (previous && time - previous.time < SAMPLE_MS) return;
        if (time - (previous?.time ?? this.start) > GAP_MS) this.error ??= "captureTrackingLost";
        if (previous && distance(point, previous) > 4 && time - previous.time < 120) this.error ??= "captureJump";
        if (this.samples.length < MAX_SAMPLES) this.samples.push({ x: point.x, y: point.y, time });
    }
    finish(time) {
        if (this.error) fail(this.error);
        if (time - (this.samples.at(-1)?.time ?? this.start) > GAP_MS) fail("captureTrackingLost");
        if (this.samples.length < 8) fail("captureTooShort");
        // A three-point median removes isolated estimation noise without making
        // the learnt path depend on rendering or the speed of a repetition.
        const points = this.samples.map((point, index, samples) => {
            const neighbors = samples.slice(Math.max(0, index - 1), Math.min(samples.length, index + 2));
            return { x: median(neighbors.map(p => p.x)), y: median(neighbors.map(p => p.y)), time: point.time };
        });
        let begin = 0, end = points.length - 1;
        const departure = points.findIndex(p => distance(p, points[0]) > .4);
        if (departure < 0) fail("captureNoMotion");
        begin = Math.max(0, departure - 1);
        while (end > begin && distance(points[end - 1], points.at(-1)) < .4) end--;
        end = Math.min(points.length - 1, end + 1);
        const trimmed = points.slice(begin, end + 1);
        // Remove idle time, not the resting poses themselves: the final pose
        // must remain inside the Trigger, including for Hold/Repeat output.
        trimmed[0] = { ...points[0], time: trimmed[0].time };
        trimmed[trimmed.length - 1] = { ...points.at(-1), time: trimmed.at(-1).time };
        if (trimmed.at(-1).time - trimmed[0].time < 200) fail("captureTooShort");
        if (distance(trimmed[0], trimmed.at(-1)) < 1) fail("captureNoMotion");
        const length = trimmed.slice(1).reduce((sum, p, i) => sum + distance(p, trimmed[i]), 0);
        if (length > 45) fail("captureComplex");
        return resample(trimmed);
    }
}

function resample(points, count = 25) {
    const lengths = [0];
    for (let i = 1; i < points.length; i++) lengths.push(lengths.at(-1) + distance(points[i - 1], points[i]));
    let segment = 1;
    return Array.from({ length: count }, (_, index) => {
        const target = lengths.at(-1) * index / (count - 1);
        while (segment < points.length - 1 && lengths[segment] < target) segment++;
        const a = points[segment - 1], b = points[segment];
        const ratio = (target - lengths[segment - 1]) / (lengths[segment] - lengths[segment - 1] || 1);
        return { x: a.x + (b.x - a.x) * ratio, y: a.y + (b.y - a.y) * ratio };
    });
}

export function compareTake(takes, next) {
    if (!takes.length) return;
    const reference = next.map((_, i) => ({ x: median(takes.map(t => t[i].x)), y: median(takes.map(t => t[i].y)) }));
    const a = reference[0], b = reference.at(-1), c = next[0], d = next.at(-1);
    const dot = ((b.x - a.x) * (d.x - c.x) + (b.y - a.y) * (d.y - c.y)) / (distance(a, b) * distance(c, d));
    const rms = Math.sqrt(next.reduce((sum, p, i) => sum + distance(p, reference[i]) ** 2, 0) / next.length);
    if (dot < .6 || rms > Math.min(2, Math.max(1, distance(a, b) * .25))) fail("captureMismatch");
}

// State transitions use a monotonic clock, including when video frames stop.
export class CaptureSequence {
    constructor() { this.takes = []; this.phase = "ready"; this.deadline = null; this.take = null; this.error = null; }
    start(time) {
        if (this.phase !== "ready" || this.takes.length >= TAKE_COUNT) return;
        this.error = null; this.phase = "countdown"; this.deadline = time + 3000;
    }
    tick(time) {
        if (this.phase === "countdown" && time >= this.deadline) {
            this.take = new MotionTake(time); this.phase = "recording"; this.deadline = time + TAKE_MS;
        } else if (this.phase === "recording" && time >= this.deadline) this.finish(this.deadline);
    }
    observe(point, time) { if (this.phase === "recording") this.take.observe(point, time); }
    finish(time) {
        if (this.phase !== "recording") return;
        try {
            const points = this.take.finish(Math.min(time, this.deadline));
            compareTake(this.takes, points);
            this.takes.push(points); this.error = null;
        } catch (error) { this.error = error.message; }
        this.take = null; this.deadline = null;
        this.phase = this.takes.length === TAKE_COUNT ? "complete" : "ready";
    }
    cancel() { this.take = null; this.takes = []; this.phase = "cancelled"; this.deadline = null; }
}

const PRESETS = { precise: .05, normal: .5, tolerant: 1.25 };
function checkpoints(points) {
    const anchors = new Set([0, points.length - 1]);
    const split = (start, end) => {
        const a = points[start], b = points[end], dx = b.x - a.x, dy = b.y - a.y;
        let farthest = -1, deviation = .35;
        for (let i = start + 1; i < end; i++) {
            const p = points[i];
            const fraction = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
            const error = distance(p, {x:a.x + fraction * dx,y:a.y + fraction * dy});
            if (error > deviation) { deviation = error; farthest = i; }
        }
        if (farthest >= 0) { anchors.add(farthest); split(start, farthest); split(farthest, end); }
    };
    split(0, points.length - 1);
    const corners = [...anchors].sort((a, b) => a - b), indices = [0];
    for (let segment = 1; segment < corners.length; segment++) {
        for (let i = corners[segment - 1] + 1; i < corners[segment]; i++) {
            if (distance(points[indices.at(-1)], points[i]) >= 1.5 - 1e-6) indices.push(i);
        }
        indices.push(corners[segment]);
    }
    return indices;
}
export function mergeTakes(takes, { landmark, preset = "normal", space = "body", name = "Captured movement", id }) {
    if (takes.length !== TAKE_COUNT || !Object.hasOwn(PRESETS, preset)) fail("captureIncomplete");
    const centers = takes[0].map((_, index) => ({ x: median(takes.map(t => t[index].x)), y: median(takes.map(t => t[index].y)) }));
    // Arc-length checkpoints retain curves and direction, but avoid hundreds of
    // tiny rules. Regions are bounded by the native 27 x 27 grid.
    const indices = checkpoints(centers);
    if (indices.length > 24) fail("captureComplex");
    const cells = indices.map(index => {
        const center = centers[index], margin = PRESETS[preset];
        const dx = Math.max(...takes.map(t => Math.abs(t[index].x - center.x))) + margin;
        const dy = Math.max(...takes.map(t => Math.abs(t[index].y - center.y))) + margin;
        const x = Math.max(-9, Math.floor(center.x - dx)), y = Math.max(-9, Math.floor(center.y - dy));
        const right = Math.min(18, Math.max(x + 1, Math.ceil(center.x + dx)));
        const bottom = Math.min(18, Math.max(y + 1, Math.ceil(center.y + dy)));
        return [x, y, right - x, bottom - y];
    }).filter((cell, i, all) => !i || JSON.stringify(cell) !== JSON.stringify(all[i - 1]));
    const a = cells[0], b = cells.at(-1);
    if (a[0] < b[0] + b[2] && b[0] < a[0] + a[2] && a[1] < b[1] + b[3] && b[1] < a[1] + a[3]) fail("captureOverlap");
    return { id, name, action: id, space, cooldown_ms: 700, steps: [{ id: `${id}_route`, mode: "ordered",
        constraints: cells.map((cell, index) => ({ id: `${id}_${index}`, landmark, cell,
            type: index === cells.length - 1 ? "trigger" : "required", priority: "high", order: index + 1 })) }] };
}
