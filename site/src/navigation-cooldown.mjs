// Fill one continuous golden bar while the two-second gesture cooldown runs.
export class NavigationCooldown {
    constructor(border, onReady, onChange = () => {}, onSampling = () => {}) {
        this.border = border;
        this.progress = border.querySelector("[data-cooldown-progress]");
        this.onReady = onReady;
        this.onChange = onChange;
        this.onSampling = onSampling;
        this.sampling = false;
        this.samplingTimer = null;
        this.locked = false;
        this.animation = null;
        this.settling = false;
        this.timer = null;
        this.frame = null;
        window.addEventListener("scroll", () => {
            if (this.settling && !this.animation) this.waitForScroll(180);
        }, { passive: true });
        document.addEventListener("scrollend", () => {
            if (this.settling && !this.animation) this.recover();
        });
    }

    start(scrolling = false, animation = null) {
        this.reset();
        this.locked = true;
        this.onChange(true);
        this.border.removeAttribute("hidden");
        this.progress.style.transform = "scaleX(0)";
        this.border.setAttribute("aria-valuenow", "0");
        if (animation) {
            this.animation = animation;
            this.settling = true;
            const finished = () => {
                if (this.animation !== animation || !this.locked) return;
                this.animation = null;
                this.recover();
            };
            animation.finished.then(finished, finished);
        } else if (scrolling && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
            this.settling = true;
            this.waitForScroll(800);
        } else this.recover();
    }

    waitForScroll(delay) {
        clearTimeout(this.timer);
        this.timer = setTimeout(() => this.recover(), delay);
    }

    recover() {
        clearTimeout(this.timer);
        this.settling = false;
        const startedAt = performance.now();
        const draw = time => {
            const progress = Math.min(1, (time - startedAt) / 2000);
            this.progress.style.transform = `scaleX(${progress})`;
            this.border.setAttribute("aria-valuenow", String(Math.round(progress * 100)));
            if (progress < 1) this.frame = requestAnimationFrame(draw);
        };
        this.frame = requestAnimationFrame(draw);
        this.samplingTimer = setTimeout(() => {
            this.sampling = true;
            this.onSampling();
        }, 1600);
        this.timer = setTimeout(() => {
            this.reset();
            this.onReady();
        }, 2000);
    }

    reset() {
        clearTimeout(this.timer);
        clearTimeout(this.samplingTimer);
        cancelAnimationFrame(this.frame);
        this.samplingTimer = null;
        this.sampling = false;
        this.frame = null;
        this.locked = false;
        this.animation = null;
        this.settling = false;
        this.border.setAttribute("hidden", "");
        this.onChange(false);
    }
}
