export class SlideInputs {
    constructor(slide, previous, next, options) {
        this.slide = slide;
        this.options = options;
        this.lastWheelMoveAt = -Infinity;
        this.reset();
        previous.addEventListener("click", () => options.move(-1));
        next.addEventListener("click", () => options.move(1));
        slide.addEventListener("keydown", event => this.key(event));
        slide.addEventListener("wheel", event => this.wheel(event), { passive: false });
        slide.addEventListener("pointerdown", event => this.pointerDown(event));
        slide.addEventListener("pointerup", event => this.pointerUp(event));
        slide.addEventListener("pointercancel", () => { this.swipeStart = null; });
    }

    reset() {
        this.swipeStart = null;
        this.wheelDistance = 0;
        this.lastWheelAt = -Infinity;
    }

    key(event) {
        if (event.target !== this.slide) return;
        if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
        event.preventDefault();
        this.options.move(event.key === "ArrowRight" ? 1 : -1);
    }

    wheel(event) {
        if (Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return;
        event.preventDefault();
        const time = performance.now();
        if (time - this.lastWheelAt > 250 || Math.sign(this.wheelDistance) !== Math.sign(event.deltaX)) {
            this.wheelDistance = 0;
        }
        this.lastWheelAt = time;
        const scale = event.deltaMode === 1 ? 20 : event.deltaMode === 2 ? innerWidth : 1;
        this.wheelDistance += event.deltaX * scale;
        if (Math.abs(this.wheelDistance) < 60) return;
        if (!this.options.locked() && time - this.lastWheelMoveAt >= this.options.delay) {
            this.lastWheelMoveAt = time;
            this.options.move(this.wheelDistance > 0 ? 1 : -1);
            this.options.wheelComplete();
        }
        this.wheelDistance = 0;
    }

    pointerDown(event) {
        if (this.options.locked() || event.pointerType !== "touch") return;
        if (event.target.closest(".history-illustration")) return;
        this.swipeStart = { id: event.pointerId, x: event.clientX };
    }

    pointerUp(event) {
        if (!this.swipeStart || event.pointerId !== this.swipeStart.id) return;
        if (this.options.locked()) { this.swipeStart = null; return; }
        const distance = event.clientX - this.swipeStart.x;
        if (Math.abs(distance) > 60) this.options.move(distance < 0 ? 1 : -1);
        this.swipeStart = null;
    }
}
