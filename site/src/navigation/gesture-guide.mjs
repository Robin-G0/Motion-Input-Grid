// Camera onboarding uses small, cancellable hints. It never starts the camera.
export class GestureGuide {
    constructor(scrollTip, slideTip, slide, sections, onDirection = () => {}) {
        this.scrollTip = scrollTip;
        this.slideTip = slideTip;
        this.slide = slide;
        this.sections = sections;
        this.onDirection = onDirection;
        this.hintsPaused = false;
        this.focus = null;
        this.swipeCompleted = false;
        this.motionPreference = matchMedia("(prefers-reduced-motion: reduce)");
        this.handsVisible = false;
        this.active = false;
        this.entered = false;
        this.frame = null;
        this.timer = null;
        this.animation = null;
        this.motionPreference.addEventListener("change", () => {
            this.cancelNudge(true);
            this.animation?.cancel();
        });
        for (const event of ["wheel", "touchstart", "pointerdown", "keydown"]) {
            window.addEventListener(event, () => this.cancelNudge(), { passive: true });
        }
        window.addEventListener("scroll", () => this.updateFocus(), { passive: true });
        window.addEventListener("resize", () => this.updateFocus(), { passive: true });
    }

    focusedSection() {
        return this.sections.findIndex(section => {
            if (section.hidden) return false;
            const bounds = section.getBoundingClientRect();
            return bounds.top <= innerHeight / 2 && bounds.bottom > innerHeight / 2;
        });
    }

    updateFocus() {
        if (!this.active) return;
        const focus = this.focusedSection();
        if (focus !== this.focus) {
            this.focus = focus;
            if (focus !== 0) this.cancelNudge();
            if (focus !== 1) this.animation?.cancel();
        }
        if (focus === 1 && !this.hintsPaused) this.showSlides();
        this.scrollTip.hidden = this.hintsPaused || (focus !== 0 && focus !== 3);
        this.slideTip.hidden = this.hintsPaused || focus !== 1 || this.swipeCompleted;
        const direction = focus === 3 ? "down" : "up";
        this.scrollTip.dataset.direction = direction;
        this.onDirection(direction);
    }

    start() {
        this.stop();
        this.active = true;
        this.entered = false;
        this.hintsPaused = false;
        this.focus = null;
        this.updateFocus();
        if (this.focus === 0) {
            this.timer = setTimeout(() => this.nudgeScroll(), 350);
        }
    }

    setHandsVisible(visible) {
        this.handsVisible = visible;
        if (!visible) this.cancelNudge(true);
        else if (this.active && !this.hintsPaused && this.focus === 0
            && !this.entered && this.timer === null && this.frame === null) {
            this.timer = setTimeout(() => this.nudgeScroll(), 5000);
        }
    }

    cancelNudge(restore = false) {
        clearTimeout(this.timer);
        this.timer = null;
        if (this.frame !== null) {
            cancelAnimationFrame(this.frame);
            this.frame = null;
            if (restore) window.scrollTo({ top: this.origin, behavior: "instant" });
        }
    }

    nudgeScroll() {
        this.timer = null;
        if (!this.active || this.hintsPaused || this.focusedSection() !== 0
            || this.entered || !this.handsVisible || this.motionPreference.matches || document.hidden) return;
        this.timer = setTimeout(() => this.nudgeScroll(), 5000);
        this.origin = window.scrollY;
        const start = performance.now();
        const draw = time => {
            const progress = Math.min((time - start) / 650, 1);
            window.scrollTo({ top: this.origin + Math.sin(progress * Math.PI) * 24, behavior: "instant" });
            if (progress < 1) this.frame = requestAnimationFrame(draw);
            else this.frame = null;
        };
        this.frame = requestAnimationFrame(draw);
    }

    sectionTop(section) {
        if (section === this.sections[0]) return 0;
        const title = section.querySelector("h2");
        return window.scrollY + title.getBoundingClientRect().top - 16;
    }

    navigate(direction) {
        if (!this.active) return false;
        this.cancelNudge(true);
        // Find the closest section so manual scrolling and hand navigation agree.
        const sections = this.sections.filter(section => !section.hidden);
        // The last section cannot always reach the top of the viewport.
        const maximumScroll = Math.max(0, document.documentElement.scrollHeight - innerHeight);
        const positions = sections.map(section => Math.min(maximumScroll, this.sectionTop(section)));
        const current = positions.reduce((nearest, position, index) =>
            Math.abs(position - scrollY) < Math.abs(positions[nearest] - scrollY) ? index : nearest, 0);
        const next = Math.max(0, Math.min(sections.length - 1, current + direction));
        if (next === current) return false;
        window.scrollTo({
            top: positions[next],
            behavior: this.motionPreference.matches ? "instant" : "smooth"
        });
        this.updateFocus();
        return true;
    }

    resume() {
        this.active = true;
        this.updateFocus();
    }

    pauseHints() {
        this.hintsPaused = true;
        this.cancelNudge(true);
        this.animation?.cancel();
        this.entered = true;
        this.scrollTip.hidden = true;
        this.slideTip.hidden = true;
    }

    showSlides() {
        if (!this.active || this.entered) return;
        this.entered = true;
        this.cancelNudge(true);
        this.scrollTip.hidden = true;
        this.slideTip.hidden = false;
        if (!this.motionPreference.matches) {
            this.animation = this.slide.animate([
                { transform: "translateX(0)" },
                { transform: "translateX(-12px)", offset: .5 },
                { transform: "translateX(0)" }
            ], { duration: 650, easing: "ease-in-out" });
        }
    }

    completeSwipe() {
        this.swipeCompleted = true;
        this.slideTip.hidden = true;
        this.animation?.cancel();
    }

    stop() {
        this.handsVisible = false;
        this.active = false;
        this.cancelNudge(true);
        this.animation?.cancel();
        this.scrollTip.hidden = true;
        this.slideTip.hidden = true;
    }
}
