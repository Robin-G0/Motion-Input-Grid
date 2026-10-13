// A quiet edge cue explains the boundary without displacing the page.
export class BoundaryFeedback {
    constructor(overlay) {
        this.overlay = overlay;
        this.lastTime = -Infinity;
    }

    show(target, direction) {
        if (performance.now() - this.lastTime < 350) return;
        this.lastTime = performance.now();
        this.overlay.dataset.direction = direction;
        this.overlay.hidden = false;
        const fade = this.overlay.animate([{ opacity: 0 }, { opacity: .65, offset: .35 }, { opacity: 0 }], { duration: 350 });
        fade.onfinish = () => { this.overlay.hidden = true; };
    }
}
