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
        this.animation = this.slide.animate([
            { opacity: .55, transform: `translateX(${Math.sign(direction) * 10}px)` },
            { opacity: 1, transform: "translateX(0)" }
        ], { duration: 220, easing: "cubic-bezier(.2,.8,.2,1)" });
        this.animations.push(this.animation);
    }
}
