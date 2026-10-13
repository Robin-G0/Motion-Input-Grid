import { scheduledSession, boundedPose } from "../../src/camera/processing.mjs";
import { trackingLandmarks } from "./profile.mjs";

const assetBase = new URL("../../mig/", import.meta.url).href;
let validator;
let validatorPromise;
export async function validateProfile(text) {
    if (!validatorPromise) {
        validatorPromise = import(new URL("mig-tracker.mjs", assetBase).href)
            .then(({ MIGTracker }) => MIGTracker.create('{"schema_version":2,"tracking":{"hands":false},"inputs":[]}'))
            .then(value => (validator = value))
            .catch(error => { validatorPromise = null; throw error; });
    }
    const tracker = await validatorPromise;
    tracker.importJSON(text);
}
export function disposeValidator() { validator?.dispose(); validator = null; validatorPromise = null; }

export async function createStudioSession(onAction, onFrame, shouldProcess = () => true) {
    const [{ MIGSession }, { MIGTracker }, models] = await Promise.all([
        import(new URL("session.mjs", assetBase).href),
        import(new URL("mig-tracker.mjs", assetBase).href),
        import(new URL("models.mjs", assetBase).href)
    ]);
    const Scheduled = scheduledSession(MIGSession);
    class Session extends Scheduled {
        processFrame() {
            if (!shouldProcess()) { this.lastVideoTime = this.video.currentTime; return; }
            super.processFrame();
        }
    }
    return new Session({ assetBase, profileMode: true, onAction, onFrame,
        dependencies: {
            createTracker: json => MIGTracker.create(json),
            loadModels: async () => {
                const loaded = await models.loadModels(assetBase);
                // Preserve the entire frame and its aspect ratio on every device.
                loaded.pose = boundedPose(loaded.pose);
                loaded.hands = boundedPose(loaded.hands);
                return loaded;
            },
            drawOverlay: () => {} // Studio draws the selected profile, not a generic skeleton.
        }
    });
}

// Display geometry follows the public grid definition. Recognition and actions
// are exclusively provided by MIG; this never substitutes a gesture recogniser.
export class PreviewGrid {
    constructor() { this.reset(); }
    reset() { this.current = null; this.reference = null; this.anchor = null; this.since = null; this.widths = []; this.lastTime = null; }
    observe(left, right, aspect, time) {
        const usable = p => p && (p.confidence ?? 1) >= .6 && Number.isFinite(p.x) && Number.isFinite(p.y)
            && p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1;
        // Anatomical right (12) is image-left; axis points towards anatomical left.
        if (!usable(left) || !usable(right)) { this.current = null; this.since = null; this.widths = []; this.lastTime = time; return "missing"; }
        const a = { x: right.x * aspect, y: right.y }, b = { x: left.x * aspect, y: left.y };
        const width = Math.hypot(b.x - a.x, b.y - a.y);
        if (width < .08 || b.x <= a.x) { this.current = null; this.since = null; this.widths = []; this.lastTime = time; return "missing"; }
        const center = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        const axis = { x: (b.x - a.x) / width, y: (b.y - a.y) / width };
        if (!this.reference) {
            if (!this.anchor || Math.hypot(center.x - this.anchor.x, center.y - this.anchor.y) > width * .1
                || Math.abs(width - this.initialWidth) > this.initialWidth * .1) {
                this.anchor = center; this.since = time; this.widths = []; this.initialWidth = width;
            }
            this.widths.push(width);
            if (this.widths.length > 32) this.widths.shift();
            if (time - this.since < 1000 || this.widths.length < 10) return "calibrating";
            this.reference = { center, axis, scale: width * .2 };
        }
        const alpha = this.current && time - this.lastTime <= 180 ? 1 - Math.exp(-(time - this.lastTime) / 35) : 1;
        const previous = this.current ?? { center, axis, scale: width * .2 };
        const mixed = { x: previous.axis.x + (axis.x - previous.axis.x) * alpha, y: previous.axis.y + (axis.y - previous.axis.y) * alpha };
        const length = Math.hypot(mixed.x, mixed.y);
        this.current = {
            center: { x: previous.center.x + (center.x - previous.center.x) * alpha, y: previous.center.y + (center.y - previous.center.y) * alpha },
            axis: { x: mixed.x / length, y: mixed.y / length }, scale: previous.scale + (width * .2 - previous.scale) * alpha
        };
        this.reference.scale = this.current.scale;
        this.lastTime = time;
        return "tracking";
    }
    transform(space = "body") { return this.current ? (space === "calibrated" ? this.reference : this.current) : null; }
    project(x, y, aspect, space = "body") {
        const grid = this.transform(space);
        if (!grid) return null;
        const u = (x - 4.5) * grid.scale, v = (y - 3.5) * grid.scale;
        return { x: (grid.center.x + grid.axis.x * u - grid.axis.y * v) / aspect,
            y: grid.center.y + grid.axis.y * u + grid.axis.x * v };
    }
    local(x, y, aspect, space = "body") {
        const grid = this.transform(space);
        if (!grid) return null;
        const dx = x * aspect - grid.center.x, dy = y - grid.center.y;
        return { x: (dx * grid.axis.x + dy * grid.axis.y) / grid.scale + 4.5,
            y: (-dx * grid.axis.y + dy * grid.axis.x) / grid.scale + 3.5 };
    }
}

export function trackedPoint(session, landmark) {
    if (landmark === "head") {
        const left = session.coordinate(7), right = session.coordinate(8);
        return left && right && (left.confidence ?? 1) >= .6 && (right.confidence ?? 1) >= .6
            ? { x: (left.x + right.x) / 2, y: (left.y + right.y) / 2,
                confidence: Math.min(left.confidence ?? 1, right.confidence ?? 1) } : session.coordinate(0);
    }
    return trackingLandmarks[landmark] == null ? null : session.coordinate(trackingLandmarks[landmark]);
}
