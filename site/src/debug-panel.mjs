import { handPosition } from "./hand-focus.mjs";
import { drawDebugOverlay } from "./debug-overlay.mjs";

const copy = {
    fr: {
        title: "Diagnostic caméra · C pour fermer", close: "Fermer", waiting: "Caméra arrêtée",
        overlays: ["Points pose ≥ 0,6 (vert : gauche, bleu : droite)", "Moyenne des mains (grands points)",
            "Centre jaune : maintien 150 ms (600 ms dans la cible du guide)",
            "Limites rouges : bords 25 %, retour 32 %", "Seuils pointillés : déplacement depuis le départ",
            "Bras pose : épaule → coude → poignet (indices fixes)"],
        reasons: { missing: "Points absents ou peu fiables", centre: "Revenir au centre",
            dwell: "Maintenir au centre", ready: "Main armée ; atteindre un seuil",
            stopped: "Caméra arrêtée", away: "Page masquée par la présence", onboarding: "Centrage initial requis",
            cooldown: "Repos de navigation", unarmed: "Départ central non validé", guide: "Geste absorbé par le guide",
            outside: "Balayage horizontal hors du slideshow ou à sa limite",
            jump: "Saut de suivi rejeté ; recentrer la main (identité pose incertaine)",
            accepted: "Action acceptée", boundary: "Limite de navigation atteinte" },
        units: "Coordonnées 0–1 ; x augmente vers la gauche (miroir).", layers: "Repères",
        left: "Gauche", right: "Droite", shoulders: "Confiance épaules", horizontal: "Horizontal",
        vertical: "Vertical", duration: "Durée", drift: "Dérive latérale", guide: "Guide"
    },
    en: {
        title: "Camera diagnostics · C to close", close: "Close", waiting: "Camera stopped",
        overlays: ["Pose points ≥ 0.6 (green: left, blue: right)", "Hand averages (large dots)",
            "Yellow centre: hold 150 ms (600 ms in the guide target)",
            "Red limits: edges 25%, clear at 32%", "Dashed thresholds: travel from the starting point",
            "Pose arms: shoulder → elbow → wrist (fixed indices)"],
        reasons: { missing: "Missing or low-confidence points", centre: "Return to the centre",
            dwell: "Hold in the centre", ready: "Hand armed; reach a threshold",
            stopped: "Camera stopped", away: "Page hidden by presence", onboarding: "Initial centering required",
            cooldown: "Navigation recovery", unarmed: "Central start not validated", guide: "Gesture consumed by guide",
            outside: "Horizontal sweep outside the slideshow or at its boundary",
            jump: "Tracking jump rejected; recenter the hand (uncertain pose identity)",
            accepted: "Action accepted", boundary: "Navigation boundary reached" },
        units: "Coordinates 0–1; x increases towards the left (mirrored).", layers: "Overlays",
        left: "Left", right: "Right", shoulders: "Shoulder confidence", horizontal: "Horizontal",
        vertical: "Vertical", duration: "Duration", drift: "Lateral drift", guide: "Guide"
    }
};
const layers = ["points", "hands", "centre", "edges", "thresholds", "arms"];

export class DebugPanel {
    constructor(video, onClose) {
        this.video = video;
        this.logs = [];
        this.lastFrame = -Infinity;
        this.lastStates = new Map();
        this.root = document.createElement("aside");
        this.root.id = "camera-debug";
        this.root.hidden = true;
        this.root.innerHTML = `<header><strong></strong><button type="button"></button></header>
            <canvas aria-label="Camera diagnostics"></canvas><fieldset><legend></legend></fieldset>
            <pre data-debug-metrics></pre><ol data-debug-logs></ol>`;
        this.root.querySelector("button").addEventListener("click", onClose);
        for (const layer of layers) {
            const label = document.createElement("label");
            const checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            checkbox.checked = layer !== "arms";
            checkbox.value = layer;
            label.append(checkbox, document.createElement("span"));
            this.root.querySelector("fieldset").append(label);
        }
        document.body.append(this.root);
        this.canvas = this.root.querySelector("canvas");
        this.metrics = this.root.querySelector("[data-debug-metrics]");
        this.history = this.root.querySelector("ol");
    }

    get active() { return !this.root.hidden; }

    toggle(language) {
        this.root.hidden = !this.root.hidden;
        this.lastFrame = -Infinity;
        if (this.active) this.setLanguage(language);
        else {
            this.canvas.width = 0;
            this.logs = [];
            this.lastStates.clear();
            this.history.replaceChildren();
        }
    }

    setLanguage(language) {
        this.text = copy[language];
        this.canvas.setAttribute("aria-label", this.text.title);
        this.root.querySelector("strong").textContent = this.text.title;
        this.root.querySelector("legend").textContent = this.text.layers;
        this.root.querySelector("button").textContent = this.text.close;
        this.root.querySelectorAll("label span").forEach((span, index) => {
            span.textContent = this.text.overlays[index];
        });
    }

    event(action, reason) {
        if (!this.active) return;
        this.log(`${action}: ${this.text.reasons[reason] ?? reason}`);
    }

    log(message) {
        if (this.logs[0] === message) return;
        this.logs.unshift(message);
        this.logs.length = Math.min(3, this.logs.length);
        this.history.replaceChildren(...this.logs.map(text => {
            const item = document.createElement("li");
            item.textContent = text;
            return item;
        }));
    }

    update(session, time, state, swipes, minimumConfidence) {
        if (!this.active || time - this.lastFrame < 100) return;
        this.lastFrame = time;
        const points = new Map();
        const camera = { coordinate: index => {
            if (!points.has(index)) points.set(index, session.coordinate(index));
            return points.get(index);
        } };
        camera.hands = [15, 16].map(landmark => ({ landmark, point: handPosition(camera, landmark) }));
        const enabled = new Set([...this.root.querySelectorAll("input:checked")].map(input => input.value));
        drawDebugOverlay(this.canvas, this.video, camera, swipes, enabled);
        const lines = [
            this.text.units,
            `${this.text.shoulders}: ${[11, 12].map(index =>
                camera.coordinate(index)?.confidence?.toFixed(2) ?? "—").join(" / ")} ≥ ${minimumConfidence}`,
            `${this.text.horizontal}: ${swipes.distance}; ${this.text.vertical}: ${swipes.raiseDistance}`,
            `${this.text.vertical}: ≥ ${swipes.raiseDuration} ms; max ${swipes.duration} ms; gap ≤ ${swipes.gap} ms`,
            `${this.text.drift}: ${swipes.raiseDrift}`,
            `${this.text.guide}: ${state.guide ?? "—"}; horizontal: ${state.horizontal}`
        ];
        for (const [side, hand] of camera.hands.entries()) {
            const centre = swipes.centres.get(hand.landmark);
            const reason = state.gate ?? (!hand.point ? "missing" : swipes.readyHands.has(hand.landmark)
                ? "ready" : centre ? "dwell" : "centre");
            const name = side ? this.text.right : this.text.left;
            const sample = swipes.verticalHands.get(hand.landmark) ?? swipes.hands.get(hand.landmark);
            const elapsed = time - (sample?.startTime ?? centre?.startTime ?? time);
            const point = hand.point ? `${hand.point.x.toFixed(2)}, ${hand.point.y.toFixed(2)}` : "—";
            lines.push(`${name}: (${point}) · ${Math.round(elapsed)} ms · ${this.text.reasons[reason]}`);
            const horizontal = swipes.hands.get(hand.landmark);
            const vertical = swipes.verticalHands.get(hand.landmark);
            if (hand.point && (horizontal || vertical)) {
                const dx = horizontal ? hand.point.x - horizontal.start : hand.point.x - vertical.x;
                const dy = vertical ? vertical.y - hand.point.y : horizontal.startY - hand.point.y;
                lines.push(`  Δx=${dx.toFixed(3)} / ${swipes.distance}; Δy=${dy.toFixed(3)} / ${swipes.raiseDistance}`);
            }
            if (this.lastStates.get(hand.landmark) !== reason) {
                this.lastStates.set(hand.landmark, reason);
                this.log(`${name}: ${this.text.reasons[reason]}`);
            }
        }
        this.metrics.textContent = lines.join("\n");
    }

    stopped() {
        if (!this.active) return;
        this.canvas.getContext("2d").clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.metrics.textContent = this.text.waiting;
        this.lastStates.clear();
    }
}
