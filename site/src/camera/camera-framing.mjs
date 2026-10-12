import { StableCameraFrame } from "./stable-camera-frame.mjs";
import { validWrist, handsVisible, handsCentred, primaryWrist } from "./hand-focus.mjs";

// Wrist coordinates use the full video image.
export function cameraFrame(session, previousEdges = [], requiredHands = 2) {
    const wrists = requiredHands === 1 ? [primaryWrist(session)] : [15, 16];
    const hands = wrists.filter(index => index !== null).map(index => session.coordinate(index)).filter(validWrist);
    // Warn within 15% of an edge; clear after returning 20% inward.
    const previous = new Set(previousEdges);
    const edges = new Set();
    for (const hand of hands) {
        if (hand.y < (previous.has("top") ? .20 : .15)) edges.add("top");
        if (hand.y > (previous.has("bottom") ? .80 : .85)) edges.add("bottom");
        // The video preview is mirrored.
        if (hand.x < (previous.has("right") ? .20 : .15)) edges.add("right");
        if (hand.x > (previous.has("left") ? .80 : .85)) edges.add("left");
    }
    return { edges: [...edges], centred: handsCentred(session, requiredHands) && edges.size === 0 };
}

export class CameraFraming {
    constructor(preview, requiredHands = 2) {
        this.requiredHands = requiredHands;
        this.preview = preview;
        this.stability = new StableCameraFrame();
        this.centred = false;
        this.edges = [];
    }

    update(session, time = performance.now()) {
        const raw = cameraFrame(session, this.edges, this.requiredHands);
        const visible = handsVisible(session, this.requiredHands);
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
        this.centred = false;
        this.edges = [];
        this.preview.classList.remove("framing-confirmed");
        for (const edge of this.preview.querySelectorAll("[data-camera-edge]")) edge.hidden = true;
    }
}
