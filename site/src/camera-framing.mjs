import { StableCameraFrame } from "./stable-camera-frame.mjs";
import { focusedWrist } from "./hand-focus.mjs";

// Wrist coordinates use the full video image, including its outer quarters.
export function cameraFrame(session, previousEdges = [], focused = focusedWrist(session)) {
    const hands = focused ? [focused.point] : [];
    // Enter at the outer quarter; clear only after moving comfortably inward.
    const previous = new Set(previousEdges);
    const edges = new Set();
    for (const hand of hands) {
        if (hand.y < (previous.has("top") ? .32 : .25)) edges.add("top");
        if (hand.y > (previous.has("bottom") ? .68 : .75)) edges.add("bottom");
        // The video preview is mirrored.
        if (hand.x < (previous.has("right") ? .32 : .25)) edges.add("right");
        if (hand.x > (previous.has("left") ? .68 : .75)) edges.add("left");
    }
    return { edges: [...edges], centred: hands.length > 0 && edges.size === 0 };
}

export class CameraFraming {
    constructor(preview) {
        this.preview = preview;
        this.stability = new StableCameraFrame();
        this.centred = false;
        this.edges = [];
        this.focusedHand = null;
    }

    update(session, time = performance.now()) {
        const focused = focusedWrist(session, this.focusedHand);
        this.focusedHand = focused?.landmark ?? null;
        const raw = cameraFrame(session, this.edges, focused);
        const visible = Boolean(focused);
        const frame = this.stability.update(raw, visible, time);
        this.preview.closest(".camera-card").classList.toggle("has-hands", frame.hasHands);
        this.edges = frame.edges;
        for (const edge of this.preview.querySelectorAll("[data-camera-edge]")) {
            edge.hidden = !frame.edges.includes(edge.dataset.cameraEdge);
        }
        this.preview.classList.toggle("framing-confirmed", frame.centred);
        this.centred = frame.centred;
    }

    reset() {
        this.stability.reset();
        this.focusedHand = null;
        this.centred = false;
        this.edges = [];
        this.preview.classList.remove("framing-confirmed");
        for (const edge of this.preview.querySelectorAll("[data-camera-edge]")) edge.hidden = true;
    }
}
