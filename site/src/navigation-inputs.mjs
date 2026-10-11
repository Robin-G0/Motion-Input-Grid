// A gesture begun during recovery must end before a new one can navigate.
export class NavigationInputGuard {
    constructor(isLocked, discard) {
        this.isLocked = isLocked;
        this.discard = discard;
        this.keys = new Set();
        this.navigationKeys = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "PageUp", "PageDown", "Home", "End", " "]);
        this.wheelBlocked = false;
        this.wheelTimer = null;
        this.touchBlocked = false;
        window.addEventListener("keydown", event => this.keyDown(event), { capture: true });
        window.addEventListener("keyup", event => {
            if (!this.keys.delete(event.key)) return;
            event.preventDefault();
            event.stopImmediatePropagation();
        }, { capture: true });
        window.addEventListener("blur", () => this.keys.clear());
        window.addEventListener("wheel", event => this.wheel(event), { capture: true, passive: false });
        window.addEventListener("touchstart", event => {
            this.touchBlocked = !this.allowsTouch(event) && isLocked();
        }, { capture: true, passive: true });
        window.addEventListener("touchmove", event => {
            if (this.allowsTouch(event)) return;
            if (!isLocked() && !this.touchBlocked) return;
            this.touchBlocked = true;
            discard();
            event.preventDefault();
        }, { capture: true, passive: false });
        for (const name of ["touchend", "touchcancel"]) {
            window.addEventListener(name, () => { this.touchBlocked = false; }, { passive: true });
        }
    }

    inGuide(event) {
        return event.target instanceof HTMLElement && Boolean(event.target.closest("#assistance"));
    }

    allowsTouch(event) {
        if (this.inGuide(event)) return true;
        const target = event.target instanceof HTMLElement ? event.target : null;
        if (target?.closest("#previous-slide, #next-slide, .history-illustration")) return false;
        return Boolean(target?.closest("button, a, input, textarea, select, [contenteditable]"));
    }

    keyDown(event) {
        const target = event.target instanceof HTMLElement ? event.target : null;
        if (target?.closest("#assistance")) return;
        const navigationEnter = event.key === "Enter" && target?.closest("#previous-slide, #next-slide");
        if (!this.navigationKeys.has(event.key) && !navigationEnter) return;
        // Editing a diagram or stopping the camera remains possible.
        if (target?.closest("input, textarea, select, [contenteditable]")) return;
        if (event.key === " " && target?.closest("button, a")) return;
        if (!this.isLocked() && !this.keys.has(event.key)) return;
        this.keys.add(event.key);
        this.discard();
        event.preventDefault();
        event.stopImmediatePropagation();
    }

    wheel(event) {
        if (this.inGuide(event)) return;
        if (!this.isLocked() && !this.wheelBlocked) return;
        this.wheelBlocked = true;
        clearTimeout(this.wheelTimer);
        // Momentum belongs to the blocked gesture until the stream goes quiet.
        this.wheelTimer = setTimeout(() => { this.wheelBlocked = false; }, 250);
        this.discard();
        event.preventDefault();
        event.stopImmediatePropagation();
    }
}
