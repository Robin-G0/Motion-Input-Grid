import { assistanceCopy } from "./assistance-copy.mjs";

const exercises = { right: "previous_slide", left: "next_slide", down: "scroll_previous", up: "scroll_presentation" };
const successors = { left: "down", down: "up", up: "scroll" };
const navigation = { scroll: ["scroll_presentation", "slides"], ribbonForward: ["next_slide", "ribbonBack"], ribbonBack: ["previous_slide", "grid"], presenceScroll: ["scroll_presentation", "presence"] };

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
        this.next = root.querySelector("[data-assistance-next]");
        this.next.addEventListener("click", () => this.advance());
        root.querySelector("[data-assistance-close]").addEventListener("click", () => this.close());
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
            : ["slides", "ribbonForward", "ribbonBack", "grid"].includes(this.step) ? "#presentation"
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
        this.root.querySelector("[data-assistance-close]").textContent = this.text.close;
        const gestureStep = this.practice || Object.hasOwn(navigation, this.step) || ["aim", "recover"].includes(this.step);
        this.next.textContent = gestureStep ? this.text.skip : this.text.next;
        this.next.hidden = ["presence", "cameraError"].includes(this.step);
        this.next.disabled = this.options.locked();
        this.root.querySelector("[data-assistance-target]").hidden = !["aim", "recover"].includes(this.step);
    }

    setMessage(text) {
        const message = this.root.querySelector("[data-assistance-message]");
        // Camera frames must not repeatedly announce an unchanged instruction.
        if (message.textContent !== text) message.textContent = text;
    }

    async advance() {
        if (this.options.locked()) return;
        if (this.step === "privacy") {
            await this.options.startCamera();
            if (this.step !== "privacy") return;
            this.go(this.options.running() ? "aim" : "cameraError");
        } else if (["aim", "recover"].includes(this.step)) this.finishAim();
        else if (this.step === "right") { this.options.cooldown(); this.go("cooldown"); }
        else if (this.step === "cooldown") this.go("left");
        else if (this.practice) this.go(successors[this.step]);
        else if (this.step === "slides") this.go("ribbonForward");
        else if (this.step === "grid") this.go("presenceScroll");
        else if (Object.hasOwn(navigation, this.step)) {
            const [action, next] = navigation[this.step];
            this.options.navigate(action);
            this.go(next);
        } else this.close();
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
            queueMicrotask(() => this.go(expected[1]));
        }
        return false;
    }

    observe(session, time, recoveryAllowed) {
        if (!this.step) return;
        const hands = [15, 16].map(index => session.coordinate(index)).filter(point =>
            point && Number.isFinite(point.x) && Number.isFinite(point.y)
            && point.x >= 0 && point.x <= 1 && point.y >= 0 && point.y <= 1);
        if (this.step === "presence" && time - this.stepStarted >= 7000) {
            this.setMessage(this.text.cover);
        }
        if (hands.length) this.missingSince = null;
        else this.missingSince ??= time;
        if (recoveryAllowed && !this.blocking && this.step !== "away" && time - this.missingSince >= 4000 && !hands.length) {
            this.returnStep = this.step;
            this.options.pauseHints();
            this.go("recover");
        }
        if (!["aim", "recover"].includes(this.step)) return;
        const pointer = this.root.querySelector("[data-assistance-pointer]");
        pointer.hidden = hands.length !== 1;
        if (hands.length !== 1) {
            this.centredSince = null;
            this.setMessage(this.text[hands.length > 1 ? "twoHands" : this.step]);
            return;
        }
        const hand = hands[0];
        pointer.style.left = `${(1 - hand.x) * 100}%`;
        pointer.style.top = `${hand.y * 100}%`;
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
