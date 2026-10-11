export class AimMarker {
    constructor() { this.reset(); }

    reset() {
        this.position = null;
        this.lastSeen = -Infinity;
    }

    update(point, time) {
        if (!point) return time - this.lastSeen < 300 ? this.position : null;
        if (!this.position || time - this.lastSeen >= 300) {
            this.position = { x: point.x, y: point.y };
        } else {
            const weight = 1 - Math.exp(-Math.max(0, time - this.lastSeen) / 90);
            this.position.x += (point.x - this.position.x) * weight;
            this.position.y += (point.y - this.position.y) * weight;
        }
        this.lastSeen = time;
        return this.position;
    }
}
