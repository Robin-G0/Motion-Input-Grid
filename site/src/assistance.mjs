import { assistanceCopy, phoneAssistanceCopy } from "./assistance-copy.mjs";
import { AimMarker } from "./aim-marker.mjs";
import { handsVisible, handsAtTargets, reliableWrist, primaryWrist } from "./hand-focus.mjs";

const exercises = { right: "previous_slide", left: "next_slide", down: "scroll_previous", up: "scroll_presentation" };
const successors = { left: "down", down: "up", up: "scroll" };
const navigation = {
    scroll: ["scroll_presentation", "ribbonForward"],
    ribbonForward: ["next_slide", "ribbonBack"],
    ribbonBack: ["previous_slide", "presenceScroll"],
    ribbonBrowse: ["next_slide", "ribbonBrowse"],
    presenceScroll: ["scroll_presentation", "presence"]
};
const presentationSteps = new Set(["ribbonForward", "ribbonBack", "ribbonBrowse", "gift", "presenceScroll"]);

// An optional tour consumes practice gestures without moving the real page.
export class Assistance {
    constructor(root, options) {
        this.root = root;
        this.options = options;
        this.step = null;
        this.presentationStep = null;
        this.centredSince = null;
        this.missingSince = null;
        this.returnStep = null;
        this.highlight = null;
        this.focusBefore = null;
        this.busy = false;
        this.cooldownTimer = null;
        this.marker = new AimMarker();
        this.pointer = root.querySelector("[data-assistance-pointer]");
        this.secondMarker = new AimMarker();
        this.secondPointer = root.querySelector("[data-assistance-pointer-right]");
        this.hint = root.querySelector("[data-assistance-hint]");
        this.next = root.querySelector("[data-assistance-next]");
        this.next.addEventListener("click", () => this.advance());
        root.querySelector("[data-assistance-close]").addEventListener("click", () => this.close());
        window.addEventListener("scroll", () => {
            this.positionTarget();
            if (!this.options.locked()) this.followViewport();
        }, { passive: true });
        window.addEventListener("resize", () => this.positionTarget(), { passive: true });
    }

    get blocking() { return ["privacy", "aim", "recover", "cooldown", "cameraError", ...Object.keys(exercises)].includes(this.step); }
    get practice() { return Object.hasOwn(exercises, this.step); }
    get requiredHands() { return this.options.requiredHands ?? 2; }
    get text() {
        const language = this.options.language();
        const text = assistanceCopy[language];
        return this.requiredHands === 1 ? { ...text, ...phoneAssistanceCopy[language] } : text;
    }

    open() {
        this.presentationStep = null;
        this.focusBefore = document.activeElement;
        window.scrollTo({ top: 0, behavior: "instant" });
        this.options.focusCamera();
        this.options.resetGestures();
        this.options.pauseHints();
        this.go("privacy");
        this.next.focus();
    }

    go(step) {
        if (step === "ribbonForward" && this.presentationStep) step = this.presentationStep;
        if (step === "gift" && !this.options.giftActive()) step = "presenceScroll";
        if (step === "presenceScroll" && !this.options.presentationComplete()) step = "ribbonBrowse";
        else if (step === "ribbonBrowse" && this.options.presentationComplete()) step = "presenceScroll";
        clearTimeout(this.cooldownTimer);
        this.step = step;
        if (presentationSteps.has(step)) this.presentationStep = step;
        this.centredSince = null;
        this.marker.reset();
        this.secondMarker?.reset();
        this.pointer.hidden = true;
        if (this.secondPointer) this.secondPointer.hidden = true;
        this.stepStarted = performance.now();
        if (this.blocking) this.options.resetGestures();
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
        const direction = { right: "right", left: "left", down: "down", up: "up", scroll: "up", presenceScroll: "up", ribbonForward: "left", ribbonBack: "right", ribbonBrowse: "left" }[this.step];
        const gesture = this.root.querySelector("[data-assistance-gesture]");
        gesture.hidden = !direction;
        gesture.dataset.direction = direction ?? "";
        this.root.querySelector("[data-assistance-source]").hidden = this.step !== "privacy";
        this.root.querySelector("[data-assistance-title]").textContent = this.text.title;
        this.setMessage(this.text[this.step] ?? "");
        this.renderHint(performance.now());
        const close = this.root.querySelector("[data-assistance-close]");
        close.textContent = this.text.close;
        close.hidden = this.step === "finale";
        const gestureStep = this.practice || Object.hasOwn(navigation, this.step) || ["aim", "recover"].includes(this.step);
        this.next.textContent = this.step === "privacy" ? this.text.activate
            : this.step === "finale" ? this.text.finish
            : this.step === "cameraError" ? this.text.retry
            : gestureStep ? this.text.skip : this.text.next;
        this.next.hidden = this.step === "presence";
        this.next.disabled = (this.step !== "finale" && this.options.locked()) || this.busy;
        this.root.querySelector("[data-assistance-target]").hidden = !["aim", "recover"].includes(this.step);
        this.positionTarget();
    }

    positionTarget() {
        const target = this.root.querySelector("[data-assistance-target]");
        if (target.hidden) return;
        const bounds = document.querySelector(".camera-preview").getBoundingClientRect();
        Object.assign(target.style, {
            left: `${bounds.left}px`, top: `${bounds.top}px`,
            width: `${bounds.width}px`, height: `${bounds.height}px`,
            right: "auto", bottom: "auto"
        });
    }

    setMessage(text) {
        const message = this.root.querySelector("[data-assistance-message]");
        // Camera frames must not repeatedly announce an unchanged instruction.
        if (message.textContent !== text) message.textContent = text;
    }

    async advance() {
        if (this.step === "finale") { this.close(); return; }
        if (this.options.locked() || this.busy) return;
        if (["privacy", "cameraError"].includes(this.step)) {
            await this.activateCamera();
        } else if (["aim", "recover"].includes(this.step)) this.finishAim();
        else if (this.step === "right") { this.options.cooldown(); this.go("cooldown"); }
        else if (this.step === "cooldown") this.go("left");
        else if (this.practice) this.go(successors[this.step]);
        else if (this.step === "gift") this.go("presenceScroll");
        else if (Object.hasOwn(navigation, this.step)) {
            const [action, next] = navigation[this.step];
            this.options.navigate(action);
            this.go(next === "presenceScroll" && this.options.giftActive() ? "gift" : next);
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
            || !this.options.running()) return;
        const section = ["finale", "presence-demo", "presentation", "welcome"].find(id => {
            const node = document.getElementById(id);
            if (node.hidden) return false;
            const bounds = node.getBoundingClientRect();
            return bounds.top < innerHeight / 2 && bounds.bottom > innerHeight / 2;
        });
        if (section === "presence-demo" && this.step !== "presence") this.go("presence");
        else if (section === "finale" && this.step !== "finale") this.go("finale");
        else if (section === "presentation" && !presentationSteps.has(this.step)) {
            this.go("ribbonForward");
        }
        else if (section === "welcome" && (presentationSteps.has(this.step)
            || ["presence", "finale"].includes(this.step))) this.go("scroll");
    }

    slideChanged() {
        if (this.step === "gift" && !this.options.giftActive()) this.go("presenceScroll");
        else if (["ribbonBrowse", "presenceScroll"].includes(this.step)) {
            const next = this.options.presentationComplete() ? "presenceScroll" : "ribbonBrowse";
            if (this.step !== next) this.go(next);
        }
    }

    renderHint(time) {
        this.hint.hidden = this.step !== "presence" || time - this.stepStarted < 7000;
        if (!this.hint.hidden) this.hint.textContent = this.text.cover;
    }

    cooldownComplete() {
        if (this.step !== "cooldown") return;
        clearTimeout(this.cooldownTimer);
        this.cooldownTimer = setTimeout(() => {
            if (this.step === "cooldown" && !this.options.locked()) this.go("left");
        }, 300);
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
            if (action !== expected[0]) return false;
            const step = this.step;
            queueMicrotask(() => {
                if (this.step === step) {
                    this.go(expected[1] === "presenceScroll" && this.options.giftActive() ? "gift" : expected[1]);
                }
            });
        }
        return false;
    }

    observe(session, time, recoveryAllowed) {
        if (!this.step) return;
        const visible = handsVisible(session, this.requiredHands);
        this.renderHint(time);
        if (visible) this.missingSince = null;
        else this.missingSince ??= time;
        if (recoveryAllowed && !this.blocking && this.step !== "away" && time - this.missingSince >= 4000 && !visible) {
            this.returnStep = this.step;
            this.options.pauseHints();
            this.go("recover");
        }
        if (!["aim", "recover"].includes(this.step)) return;
        const pointers = this.requiredHands === 1 ? [
            [primaryWrist(session) ?? 15, this.marker, this.pointer]
        ] : [
            [15, this.marker, this.pointer], [16, this.secondMarker, this.secondPointer]
        ];
        for (const [landmark, marker, pointer] of pointers) {
            const point = session.coordinate(landmark);
            const position = marker.update(reliableWrist(point) ? point : null, time);
            pointer.hidden = !position;
            if (position) {
                pointer.style.left = `${(1 - position.x) * 100}%`;
                pointer.style.top = `${position.y * 100}%`;
            }
        }
        if (!visible) {
            this.centredSince = null;
            this.setMessage(this.text[this.step]);
            return;
        }
        this.setMessage(this.text[this.step]);
        const centred = handsAtTargets(session, this.centredSince === null ? .16 : .19, this.requiredHands);
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
        clearTimeout(this.cooldownTimer);
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
