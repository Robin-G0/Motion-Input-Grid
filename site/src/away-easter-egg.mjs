import { awayScene } from "./away-clock.mjs";
import { AwaySky } from "./away-sky.mjs";

// Well, you found it! Please try the regular way, too.
// This animation took a while to implement. Two minutes away is all it asks :)
export class AwayEasterEgg {
    constructor(root) {
        this.root = root;
        this.reward = root.querySelector("[data-away-reward]");
        this.sky = new AwaySky(root.querySelector("canvas"));
        this.motionPreference = matchMedia("(prefers-reduced-motion: reduce)");
        this.startedAt = null;
        this.frame = null;
        this.lastFrame = -Infinity;
        this.lastScene = null;
        window.addEventListener("resize", () => {
            if (!this.root.hidden) {
                this.sky.resize();
                this.lastFrame = -Infinity;
                this.lastScene = null;
                this.paint(performance.now());
            }
        }, { passive: true });
        this.motionPreference.addEventListener("change", () => {
            cancelAnimationFrame(this.frame);
            this.frame = null;
            this.lastScene = null;
            if (!this.root.hidden) this.paint(performance.now());
        });
    }

    update(time, absent) {
        if (!absent) {
            if (this.startedAt !== null) this.reset();
            return;
        }
        this.startedAt ??= time;
        const scene = awayScene(time - this.startedAt);
        if (!scene) return;
        if (this.root.hidden) {
            this.sky.resize();
            this.root.hidden = false;
        }
        this.root.dataset.season = scene.season;
        this.reward.hidden = !scene.complete;
        if (this.frame === null) this.paint(time);
    }

    paint(time) {
        const scene = this.startedAt === null ? null : awayScene(time - this.startedAt);
        if (!scene || document.hidden) return;
        const reduced = this.motionPreference.matches;
        const confetti = scene.celebration !== null && scene.celebration <= 4500;
        const animated = !reduced && (!scene.complete || confetti);
        const key = `${scene.season}/${scene.weather}/${scene.night}/${scene.complete}/${confetti}`;
        if ((animated && time - this.lastFrame >= 1000 / 30) || key !== this.lastScene) {
            this.sky.draw(scene, reduced);
            this.lastFrame = time;
            this.lastScene = key;
        }
        if (animated && this.frame === null) {
            this.frame = requestAnimationFrame(next => {
                this.frame = null;
                this.paint(next);
            });
        }
    }

    reset() {
        cancelAnimationFrame(this.frame);
        this.frame = null;
        this.startedAt = null;
        this.lastFrame = -Infinity;
        this.lastScene = null;
        this.root.hidden = true;
        this.reward.hidden = true;
        delete this.root.dataset.season;
    }
}
