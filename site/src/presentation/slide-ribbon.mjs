import { HistoryIllustration } from "./history.mjs";

const positions = {
    left: "var(--carousel-left)",
    centre: "var(--carousel-centre)",
    right: "var(--carousel-right)",
    back: "var(--carousel-back)"
};

// Keep the active panel and its controls intact; adjacent panels are inert previews.
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
        this.neighbours = [-1, 1].map(direction => {
            const panel = slide.cloneNode(true);
            panel.removeAttribute("id");
            panel.removeAttribute("tabindex");
            panel.removeAttribute("aria-labelledby");
            panel.removeAttribute("role");
            panel.inert = true;
            panel.setAttribute("aria-hidden", "true");
            panel.classList.add("slide-neighbour");
            panel.dataset.position = direction < 0 ? "left" : "right";
            for (const node of panel.querySelectorAll("[id]")) node.removeAttribute("id");
            const copy = panel.querySelector(".slide-copy").cloneNode(true);
            const illustration = new HistoryIllustration(panel.querySelector(".history-illustration"), { animated: false });
            return { panel, illustration, direction, copy };
        });
        this.track.append(this.neighbours[0].panel, slide, this.neighbours[1].panel);
    }

    show(slides, text) {
        const { index, direction } = slides;
        this.animations.forEach(animation => animation.cancel());
        this.animations = [];
        this.animation = null;
        for (const neighbour of this.neighbours) {
            const neighbourIndex = slides.entries[slides.position + neighbour.direction];
            neighbour.panel.hidden = neighbourIndex === undefined;
            if (neighbour.panel.hidden) continue;
            const gift = neighbourIndex === "gift";
            neighbour.panel.dataset.wrapped = String(gift);
            if (gift) {
                neighbour.panel.querySelector(".slide-copy").textContent = "";
                neighbour.illustration.show(0, text);
                continue;
            }
            // A gift preview has no content; restore the normal copy on reuse.
            neighbour.panel.querySelector(".slide-copy").replaceWith(neighbour.copy.cloneNode(true));
            const original = text.slides[neighbourIndex];
            const content = original;
            neighbour.panel.dataset.returned = "false";
            neighbour.panel.dataset.color = content.color;
            neighbour.panel.querySelector(".slide-tag").textContent = content.tag;
            neighbour.panel.querySelector("h3").textContent = content.title;
            neighbour.panel.querySelector(".slide-copy > p:last-child").textContent = content.description;
            neighbour.panel.querySelector(".slide-number").textContent = content.number;
            neighbour.illustration.show(neighbourIndex, text);
        }
        if (this.ready && index !== this.index && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
            this.rotate(direction || Math.sign(index - this.index));
        }
        this.index = index;
        this.ready = true;
    }

    rotate(direction) {
        const order = ["left", "centre", "right"];
        const panels = [this.neighbours[0].panel, this.slide, this.neighbours[1].panel];
        for (const [index, panel] of panels.entries()) {
            const previous = (index + Math.sign(direction) + order.length) % order.length;
            const frames = [{ transform: positions[order[previous]] }];
            if (Math.abs(previous - index) === 2) frames.push({ transform: positions.back, offset: .5 });
            frames.push({ transform: positions[order[index]] });
            const animation = panel.animate(frames, { duration: 650, easing: "cubic-bezier(.2,.8,.2,1)" });
            this.animations.push(animation);
            if (panel === this.slide) this.animation = animation;
        }
    }
}
