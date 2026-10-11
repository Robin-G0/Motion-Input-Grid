// A short elastic return explains a boundary without moving the page permanently.
export class BoundaryFeedback {
    constructor(overlay) {
        this.overlay = overlay;
        this.lastTime = -Infinity;
    }

    show(target, direction) {
        if (performance.now() - this.lastTime < 600) return;
        this.lastTime = performance.now();
        this.overlay.dataset.direction = direction;
        this.overlay.hidden = false;
        const fade = this.overlay.animate([{ opacity: 0 }, { opacity: .75, offset: .35 }, { opacity: 0 }], { duration: 600 });
        fade.onfinish = () => { this.overlay.hidden = true; };
        if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
        const horizontal = direction === "left" || direction === "right";
        const distance = direction === "left" || direction === "top" ? 24 : -24;
        const transform = horizontal ? `translateX(${distance}px)` : `translateY(${distance}px)`;
        target.animate([
            { transform: "translate(0, 0)" },
            { transform, offset: .4 },
            { transform: horizontal ? `translateX(${-distance / 4}px)` : `translateY(${-distance / 4}px)`, offset: .75 },
            { transform: "translate(0, 0)" }
        ], { duration: 600, easing: "ease-out" });
    }
}
