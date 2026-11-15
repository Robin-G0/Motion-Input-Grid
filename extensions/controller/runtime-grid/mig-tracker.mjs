import createMIG from "./mig.mjs";
import { writeBody, writeHands } from "./packets.mjs";

// One engine per consumer; no network inference or keyboard injection.
export class MIGTracker {
    static async create(json, options = {}) {
        const module = await createMIG(options);
        const tracker = new MIGTracker(module);
        try {
            tracker.importJSON(json);
            return tracker;
        } catch (error) {
            tracker.dispose();
            throw error;
        }
    }
    constructor(module) {
        this.module = module;
        this.native = new module.Tracker();
        this.sequence = 0;
    }
    importJSON(json) {
        const error = this.native.load(json);
        if (error) {
            throw new Error(error);
        }
        this.sequence = 0;
    }
    async importURL(url) {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Configuration HTTP ${response.status}`);
        }
        this.importJSON(await response.text());
    }
    exportJSON() {
        return this.native.exportConfig();
    }
    // MediaPipe result arrays are caller-owned. Copy directly into fixed WASM input
    // buffers; acquire fresh views each call because importing a profile can grow memory.
    update(poseResult, handResult, timestampMs, aspect, onAction = () => {}) {
        writeBody(this.native.bodyBuffer(), poseResult);
        const { count, mask } = writeHands(this.native.handBuffer(), handResult);
        const events = this.native.update(
            Math.floor(timestampMs),
            ++this.sequence,
            aspect,
            count,
            mask,
        );
        if (events < 0) {
            throw new Error("Invalid frame metadata");
        }
        const actions = [];
        for (let index = 0; index < events; ++index) {
            actions.push([this.native.eventAction(index), this.native.eventId(index)]);
        }
        for (const [action, id] of actions) {
            onAction(action, id);
        }
        return events;
    }
    // 0: normalized image XYZ, 1: world metres, 2: world metres with Y upward.
    coordinate(index, system = 0) {
        return this.native.coordinate(index, system);
    }
    handCoordinate(anatomicalSide, joint, system = 0) {
        return this.native.handCoordinate(anatomicalSide, joint, system);
    }
    active(inputIndex) {
        return this.native.active(inputIndex);
    }
    trackHands() {
        return this.native.trackHands();
    }
    grid(space = "body") {
        return this.native.grid(space === "calibrated");
    }
    gesture(anatomicalSide) {
        return this.native.gesture(anatomicalSide);
    }
    restart() {
        this.native.restart();
    }
    recalibrate() {
        this.native.recalibrate();
    }
    dispose() {
        this.native?.delete();
        this.native = null;
    }
}
