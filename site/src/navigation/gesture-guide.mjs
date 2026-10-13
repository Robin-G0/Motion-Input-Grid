// Written camera hints follow the viewport without moving the page.
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
        }
        if (focus === 1 && !this.hintsPaused) this.showSlides();
        this.scrollTip.hidden = this.hintsPaused || focus !== 0;
        this.slideTip.hidden = this.hintsPaused || focus !== 1 || this.swipeCompleted;
        const direction = "up";
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
    }

    setHandsVisible(visible) {
        this.handsVisible = visible;
    }

    sectionTop(section) {
        if (section === this.sections[0]) return 0;
        const title = section.querySelector("h2");
        return window.scrollY + title.getBoundingClientRect().top - 16;
    }

    navigate(direction) {
        if (!this.active) return false;
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
        this.entered = true;
        this.scrollTip.hidden = true;
        this.slideTip.hidden = true;
    }

    showSlides() {
        if (!this.active || this.entered) return;
        this.entered = true;
        this.scrollTip.hidden = true;
        this.slideTip.hidden = false;
    }

    completeSwipe() {
        this.swipeCompleted = true;
        this.slideTip.hidden = true;
    }

    stop() {
        this.handsVisible = false;
        this.active = false;
        this.scrollTip.hidden = true;
        this.slideTip.hidden = true;
    }
}
