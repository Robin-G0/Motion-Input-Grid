// Upper-body points MIG relies on: shoulders, elbows and wrists (anatomical indices).
export const upperBody = [11, 12, 13, 14, 15, 16];
const jitterGroups = { shoulders: [11, 12], wrists: [15, 16] };
const visible = point => point && (point.visibility ?? 1) >= .6;

export function quantile(values, q) {
    if (!values.length) return null;
    const sorted = [...values].sort((a, b) => a - b);
    return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
}

// Bounded per-model statistics over the latest `capacity` frames.
export class ModelStats {
    constructor(capacity = 300) {
        this.capacity = capacity;
        this.reset();
    }

    reset() {
        this.durations = [];
        this.coverage = [];
        this.jitter = { shoulders: [], wrists: [] };
        this.history = [];
    }

    push(list, value) {
        list.push(value);
        if (list.length > this.capacity) list.shift();
    }

    // `points` are one pose's normalized landmarks; `aspect` is width / height.
    record(durationMs, points, aspect) {
        this.push(this.durations, durationMs);
        const found = upperBody.filter(index => visible(points?.[index])).length;
        this.push(this.coverage, found / upperBody.length);
        this.recordJitter(points, aspect);
    }

    // The second difference cancels steady motion and keeps frame-to-frame noise.
    // Shoulder width makes it independent of the distance to the camera.
    recordJitter(points, aspect) {
        const left = points?.[11], right = points?.[12];
        const width = visible(left) && visible(right)
            ? Math.hypot((left.x - right.x) * aspect, left.y - right.y) : 0;
        this.history.push(width > .05 ? { points, width } : null);
        if (this.history.length > 3) this.history.shift();
        const [a, b, c] = this.history;
        if (this.history.length < 3 || !a || !b || !c) return;
        for (const [group, indices] of Object.entries(jitterGroups)) {
            for (const index of indices) {
                const [p, q, r] = [a.points[index], b.points[index], c.points[index]];
                if (!visible(p) || !visible(q) || !visible(r)) continue;
                const dx = (r.x - 2 * q.x + p.x) * aspect, dy = r.y - 2 * q.y + p.y;
                this.push(this.jitter[group], Math.hypot(dx, dy) / c.width);
            }
        }
    }

    summary() {
        const median = quantile(this.durations, .5);
        return {
            frames: this.durations.length,
            median,
            p95: quantile(this.durations, .95),
            fps: median ? 1000 / median : null,
            coverage: this.coverage.length
                ? this.coverage.reduce((sum, value) => sum + value, 0) / this.coverage.length : null,
            wristJitter: quantile(this.jitter.wrists, .5),
            shoulderJitter: quantile(this.jitter.shoulders, .5)
        };
    }
}
