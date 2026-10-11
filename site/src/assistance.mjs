import { assistanceCopy } from "./assistance-copy.mjs";
import { AimMarker } from "./aim-marker.mjs";

const exercises = { right: "previous_slide", left: "next_slide", down: "scroll_previous", up: "scroll_presentation" };
const successors = { left: "down", down: "up", up: "scroll" };
const navigation = {
    scroll: ["scroll_presentation", "ribbonForward"],
    ribbonForward: ["next_slide", "ribbonBack"],
    ribbonBack: ["previous_slide", "grid"],
    presenceScroll: ["scroll_presentation", "presence"]
};
const presentationSteps = new Set(["ribbonForward", "ribbonBack", "grid", "presenceScroll"]);

// An optional tour consumes practice gestures without moving the real page.
export class Assistance {
    constructor(root, options) {
        this.root = root;
        this.options = options;
        this.step = null;
        this.centredSince = null;
        this.missingSince = null;
        this.returnStep = null;
        this.highlight = null;
        this.focusBefore = null;
        this.busy = false;
        this.marker = new AimMarker();
        this.pointer = root.querySelector("[data-assistance-pointer]");
        this.hint = root.querySelector("[data-assistance-hint]");
        this.next = root.querySelector("[data-assistance-next]");
        this.next.addEventListener("click", () => this.advance());
        root.querySelector("[data-assistance-close]").addEventListener("click", () => this.close());
        root.querySelector("[data-assistance-stop]").addEventListener("click", () => options.stopCamera());
        window.addEventListener("scroll", () => this.followViewport(), { passive: true });
    }

    get blocking() { return ["privacy", "aim", "recover", "cooldown", "cameraError", ...Object.keys(exercises)].includes(this.step); }
    get practice() { return Object.hasOwn(exercises, this.step); }
    get text() { return assistanceCopy[this.options.language()]; }

    open() {
        this.focusBefore = document.activeElement;
        window.scrollTo({ top: 0, behavior: "instant" });
        this.options.focusCamera();
        this.options.resetGestures();
        this.options.pauseHints();
        this.go("privacy");
        this.next.focus();
    }

    go(step) {
        this.step = step;
        if (step === "grid") this.options.showGrid();
        this.centredSince = null;
        this.marker.reset();
        this.pointer.hidden = true;
        this.stepStarted = performance.now();
        this.options.resetGestures();
        this.render();
    }

    render() {
        this.root.hidden = !this.step || this.step === "away";
        this.highlight?.classList.remove("assistance-highlight");
        this.highlight = null;
        if (this.root.hidden) return;
        const target = ["privacy", "aim", "recover", "cameraError", ...Object.keys(exercises)].includes(this.step) ? ".camera-card"
            : this.step === "cooldown" ? "#navigation-cooldown"
            : presentationSteps.has(this.step) ? "#presentation"
            : this.step === "finale" ? "#finale" : "#presence-demo";
        this.highlight = document.querySelector(target);
        this.highlight?.classList.add("assistance-highlight");
        this.root.dataset.step = this.step;
        const direction = { right: "right", left: "left", down: "down", up: "up", scroll: "up", presenceScroll: "up", ribbonForward: "left", ribbonBack: "right" }[this.step];
        const gesture = this.root.querySelector("[data-assistance-gesture]");
        gesture.hidden = !direction;
        gesture.dataset.direction = direction ?? "";
        this.root.querySelector("[data-assistance-source]").hidden = this.step !== "privacy";
        this.root.querySelector("[data-assistance-title]").textContent = this.text.title;
        this.setMessage(this.text[this.step] ?? "");
        this.renderHint(performance.now());
        this.root.querySelector("[data-assistance-close]").textContent = this.text.close;
        const gestureStep = this.practice || Object.hasOwn(navigation, this.step) || ["aim", "recover"].includes(this.step);
        this.next.textContent = this.step === "privacy" ? this.text.activate
            : this.step === "cameraError" ? this.text.retry
            : gestureStep ? this.text.skip : this.text.next;
        this.next.hidden = this.step === "presence";
        this.next.disabled = this.options.locked() || this.busy;
        this.root.querySelector("[data-assistance-target]").hidden = !["aim", "recover"].includes(this.step);
        this.root.querySelector("[data-assistance-secondary]").hidden = this.step !== "finale";
        this.root.querySelector("[data-assistance-stop]").textContent = this.text.stop;
        this.root.querySelector("[data-assistance-github]").textContent = this.text.github;
    }

    setMessage(text) {
        const message = this.root.querySelector("[data-assistance-message]");
        // Camera frames must not repeatedly announce an unchanged instruction.
        if (message.textContent !== text) message.textContent = text;
    }

    async advance() {
        if (this.options.locked() || this.busy) return;
        if (["privacy", "cameraError"].includes(this.step)) {
            await this.activateCamera();
        } else if (["aim", "recover"].includes(this.step)) this.finishAim();
        else if (this.step === "right") { this.options.cooldown(); this.go("cooldown"); }
        else if (this.step === "cooldown") this.go("left");
        else if (this.practice) this.go(successors[this.step]);
        else if (this.step === "grid") this.go("presenceScroll");
        else if (Object.hasOwn(navigation, this.step)) {
            const [action, next] = navigation[this.step];
            this.options.navigate(action);
            this.go(next);
        } else this.close();
    }

    async activateCamera() {
        const step = this.step;
        this.busy = true;
        this.render();
        try {
            await this.options.startCamera();
            if (this.step === step) this.go(this.options.running() ? "aim" : "cameraError");
        } finally {
            this.busy = false;
            this.render();
        }
    }

    followViewport() {
        if (!this.step || ["privacy", "cameraError", "away"].includes(this.step)
            || !this.options.running() || this.options.locked()) return;
        const section = ["finale", "presence-demo", "presentation", "welcome"].find(id => {
            const node = document.getElementById(id);
            if (node.hidden) return false;
            const bounds = node.getBoundingClientRect();
            return bounds.top < innerHeight / 2 && bounds.bottom > innerHeight / 2;
        });
        if (section === "presence-demo" && this.step !== "presence") this.go("presence");
        else if (section === "finale" && this.step !== "finale") this.go("finale");
        else if (section === "presentation" && !presentationSteps.has(this.step)) this.go("ribbonForward");
        else if (section === "welcome" && (presentationSteps.has(this.step)
            || ["presence", "finale"].includes(this.step))) this.go("scroll");
    }

    renderHint(time) {
        this.hint.hidden = this.step !== "presence" || time - this.stepStarted < 7000;
        if (!this.hint.hidden) this.hint.textContent = this.text.cover;
    }

    action(action) {
        if (!this.step) return false;
        if (this.practice) {
            if (action !== exercises[this.step]) return true;
            this.options.cooldown();
            this.go(this.step === "right" ? "cooldown" : successors[this.step]);
            return true;
        }
        if (this.blocking) return true;
        const expected = navigation[this.step];
        if (expected) {
            if (action !== expected[0]) return true;
            const step = this.step;
            queueMicrotask(() => { if (this.step === step) this.go(expected[1]); });
        }
        return false;
    }

    observe(session, time, recoveryAllowed) {
        if (!this.step) return;
        const hands = [15, 16].map(index => session.coordinate(index)).filter(point =>
            point && Number.isFinite(point.x) && Number.isFinite(point.y)
            && point.x >= 0 && point.x <= 1 && point.y >= 0 && point.y <= 1);
        this.renderHint(time);
        if (hands.length) this.missingSince = null;
        else this.missingSince ??= time;
        if (recoveryAllowed && !this.blocking && this.step !== "away" && time - this.missingSince >= 4000 && !hands.length) {
            this.returnStep = this.step;
            this.options.pauseHints();
            this.go("recover");
        }
        if (!["aim", "recover"].includes(this.step)) return;
        if (hands.length > 1) this.marker.reset();
        const position = this.marker.update(hands.length === 1 ? hands[0] : null, time);
        this.pointer.hidden = !position;
        if (position) {
            this.pointer.style.left = `${(1 - position.x) * 100}%`;
            this.pointer.style.top = `${position.y * 100}%`;
        }
        if (hands.length !== 1) {
            this.centredSince = null;
            this.setMessage(this.text[hands.length > 1 ? "twoHands" : this.step]);
            return;
        }
        const hand = hands[0];
        this.setMessage(this.text[this.step]);
        const centred = Math.abs(hand.x - .5) < .1 && Math.abs(hand.y - .5) < .1;
        this.centredSince = centred ? this.centredSince ?? time : null;
        if (this.centredSince !== null && time - this.centredSince >= 600) this.finishAim();
    }

    finishAim() {
        if (this.step === "recover") {
            const next = this.returnStep;
            this.returnStep = null;
            if (next) this.go(next);
            else this.close();
        } else this.go("right");
    }

    depart() { if (this.step) this.go("away"); }
    returned() { if (this.step === "away") this.go("finale"); }

    close() {
        this.step = null;
        this.returnStep = null;
        this.missingSince = null;
        this.options.resetGestures();
        this.render();
        this.options.resumeHints();
        if (this.focusBefore?.isConnected) this.focusBefore.focus({ preventScroll: true });
        this.focusBefore = null;
    }
}
