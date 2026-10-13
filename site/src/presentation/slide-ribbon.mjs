// Keep the live controls intact while a short transition signals a new slide.
export class SlideRibbon {
    constructor(slide) {
        this.slide = slide;
        this.index = 0;
        this.animation = null;
        this.animations = [];
        this.ready = false;
        slide.dataset.position = "centre";
        this.window = document.createElement("div");
        this.window.className = "carousel-window";
        this.track = document.createElement("div");
        this.track.className = "carousel-track";
        slide.before(this.window);
        this.window.append(this.track);
        this.track.append(slide);
    }

    show(slides) {
        const { index, direction } = slides;
        this.animations.forEach(animation => animation.cancel());
        this.animations = [];
        this.animation = null;
        if (this.ready && index !== this.index && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
            this.rotate(direction || Math.sign(index - this.index));
        }
        this.index = index;
        this.ready = true;
    }

    rotate(direction) {
        // The frame stays still; copy and diagram arrive with a restrained stagger.
        for (const [index, panel] of [...this.slide.children].entries()) {
            const animation = panel.animate([
                { opacity: 0, transform: `translateX(${Math.sign(direction) * 14}px)` },
                { opacity: 1, transform: "translateX(0)" }
            ], { duration: 280, delay: index * 40, fill: "backwards", easing: "cubic-bezier(.22,1,.36,1)" });
            this.animations.push(animation);
            this.animation = animation;
        }
    }
}
