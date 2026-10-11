// Smooth visual feedback only. Raw observations still drive gesture recognition.
export class StableCameraFrame {
    constructor() { this.reset(); }

    reset() {
        this.hasHands = false;
        this.lastSeen = -Infinity;
        this.edges = [];
        this.pending = new Map();
    }

    update(frame, visible, time) {
        if (visible) { this.lastSeen = time; this.hasHands = true; }
        else if (time - this.lastSeen >= 650) this.hasHands = false;
        for (const edge of ["top", "bottom", "left", "right"]) {
            const shown = this.edges.includes(edge);
            // Brief missing observations must not clear a warning either.
            const wanted = visible ? frame.edges.includes(edge) : this.hasHands && shown;
            if (shown === wanted) { this.pending.delete(edge); continue; }
            const pending = this.pending.get(edge);
            if (!pending || pending.wanted !== wanted) {
                this.pending.set(edge, { wanted, since: time });
                continue;
            }
            if (time - pending.since < (wanted ? 180 : 500)) continue;
            this.edges = wanted ? [...this.edges, edge] : this.edges.filter(value => value !== edge);
            this.pending.delete(edge);
        }
        return { hasHands: this.hasHands, edges: this.edges, centred: visible && frame.centred && this.edges.length === 0 };
    }
}
