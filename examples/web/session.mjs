const poseModelNames = ["lite", "full", "heavy"];
const gridSpaces = ["body", "calibrated"];

/**
 * Unmirrored normalized image position of a grid coordinate, projected exactly
 * as the engine does: cell (4.5, 3.5) is the shoulder midpoint, x follows the
 * shoulders. Use whole numbers for cell corners, e.g. [x, y] and [x + w, y + h].
 */
export function gridPoint(grid, column, row) {
    const u = (column - 4.5) * grid.scale, v = (row - 3.5) * grid.scale;
    return { x: (grid.centerX + grid.axisX * u - grid.axisY * v) / grid.aspect,
        y: grid.centerY + grid.axisY * u + grid.axisX * v };
}

export class MIGSession {
    constructor(options = {}) {
        this.options = options;
        if (options.delegate != null && !["CPU", "GPU"].includes(options.delegate)) {
            throw new RangeError("delegate must be CPU or GPU");
        }
        // Developers choose the default and the models a user may pick.
        this.poseModels = options.poseModels ?? poseModelNames;
        if (!this.poseModels.length || this.poseModels.some(name => !poseModelNames.includes(name))) {
            throw new RangeError("poseModels must list lite, full or heavy");
        }
        const poseModel = options.poseModel ?? this.poseModels[0];
        if (!this.poseModels.includes(poseModel)) {
            throw new RangeError(`poseModel must be one of ${this.poseModels.join(", ")}`);
        }
        this.assetBase = new URL(options.assetBase ?? "/mig/",
            globalThis.location?.href ?? "http://localhost/").href;
        this.state = { status: "Ready. Start the camera.", running: false,
            busy: false, actions: [], poseModel };
        this.listeners = new Set();
        this.generation = 0;
        this.profileRevision = 0;
        this.disposed = false;
        this.request = 0;
        this.setInferenceFps(options.maxInferenceFps ?? 0);
    }

    subscribe(listener) {
        this.listeners.add(listener);
        listener(this.state);
        return () => this.listeners.delete(listener);
    }

    publish(changes) {
        if (this.disposed) return;
        this.state = { ...this.state, ...changes };
        for (const listener of this.listeners) listener(this.state);
    }

    async initialize() {
        if (!this.initializing) {
            this.initializing = this.createTracker().catch(error => {
                this.initializing = null;
                throw error;
            });
        }
        await this.initializing;
        if (this.disposed) throw new Error("Session disposed");
    }

    async createTracker() {
        const dependencies = this.options.dependencies ?? await this.loadDependencies();
        this.dependencies = dependencies;
        const response = await fetch(new URL("default.json", this.assetBase));
        if (!response.ok) throw new Error(`Configuration HTTP ${response.status}`);
        const configuration = await response.json();
        if (this.options.profileMode) {
            configuration.inputs = [];
            configuration.tracking.hands = false;
        }
        const tracker = await dependencies.createTracker(JSON.stringify(configuration));
        if (this.disposed) {
            tracker.dispose();
            throw new Error("Session disposed");
        }
        this.tracker = tracker;
    }

    async loadDependencies() {
        const load = path => import(/* webpackIgnore: true */ /* @vite-ignore */
            new URL(path, this.assetBase).href);
        const [tracking, models, overlay] = await Promise.all([
            load("mig-tracker.mjs"), load("models.mjs"), load("overlay.mjs")
        ]);
        return {
            createTracker: json => tracking.MIGTracker.create(json),
            loadModels: settings => models.loadModels(this.assetBase, settings),
            drawOverlay: overlay.drawOverlay
        };
    }

    async start(video, canvas) {
        if (this.disposed || this.starting || this.stream) return;
        this.starting = true;
        const run = ++this.generation;
        this.publish({ busy: true, status: "Loading camera models..." });
        try {
            await this.initialize();
            if (run !== this.generation) return;
            if (!this.models) {
                const models = await this.dependencies.loadModels({ hands: this.tracker.trackHands(),
                    delegate: this.options.delegate ?? "CPU", poseModel: this.state.poseModel });
                if (this.disposed) {
                    models.pose.close();
                    models.hands?.close();
                    return;
                }
                this.models = models;
            }
            if (this.tracker.trackHands()) await this.ensureHands();
            if (run !== this.generation) return;
            const stream = await navigator.mediaDevices.getUserMedia({
                video: this.options.videoConstraints ?? { width: 1280, height: 720 }, audio: false
            });
            if (run !== this.generation || this.disposed) {
                stream.getTracks().forEach(track => track.stop());
                return;
            }
            this.stream = stream;
            this.video = video;
            this.canvas = canvas;
            video.srcObject = stream;
            await video.play();
            if (run !== this.generation || this.disposed) return;
            this.lastVideoTime = -1;
            this.lastInferenceAt = null;
            this.tracker.recalibrate();
            this.publish({ running: true, status: "Lower hands, keep shoulders visible, then raise a wrist." });
            this.tick(run);
        } catch (error) {
            if (run === this.generation && !this.disposed) {
                this.stop();
                this.publish({ status: error.message });
            }
        } finally {
            this.starting = false;
            this.publish({ busy: false });
        }
    }

    tick(run) {
        if (!this.stream || run !== this.generation || this.disposed) return;
        try {
            const video = this.video;
            const now = performance.now();
            const due = this.lastInferenceAt == null || !this.maxInferenceFps ||
                now - this.lastInferenceAt >= 1000 / this.maxInferenceFps;
            if (due && !this.loadingHands && !this.loadingPose && video.readyState >= 2
                && video.currentTime !== this.lastVideoTime) {
                this.processFrame();
            }
            if (run === this.generation && !this.disposed) {
                this.request = requestAnimationFrame(() => this.tick(run));
            }
        } catch (error) {
            this.stop();
            this.publish({ status: error.message });
        }
    }

    processFrame() {
        const video = this.video;
        this.lastVideoTime = video.currentTime;
        const time = Math.floor(performance.now());
        this.lastInferenceAt = performance.now();
        const body = this.models.pose.detectForVideo(video, time);
        const hands = this.tracker.trackHands()
            ? this.models.hands.detectForVideo(video, time) : null;
        const actions = [];
        this.tracker.update(body, hands, time, video.videoWidth / video.videoHeight,
            (action, id) => actions.push({ action, id }));
        if (this.options.drawOverlay !== false && this.canvas) {
            this.dependencies.drawOverlay(this.canvas, video, body, hands);
        }
        if (actions.length) {
            this.publish({ actions, status: "Motion detected." });
            for (const event of actions) this.options.onAction?.(event);
        }
        this.options.onFrame?.(this);
    }

    /**
     * The engine's own grid ("body" follows the shoulders, "calibrated" keeps the
     * calibration anchor), already smoothed; null before calibration or after
     * tracking loss. Draw guides with gridPoint() instead of recomputing it.
     */
    grid(space = "body") {
        if (!gridSpaces.includes(space)) throw new RangeError('space must be "body" or "calibrated"');
        if (this.disposed) return null;
        return this.tracker?.grid(space) ?? null;
    }

    coordinate(index, system = 0) {
        if (this.disposed) return null;
        return this.tracker?.coordinate(index, system) ?? null;
    }

    /** Zero preserves the original uncapped behavior. Skipped frames are never queued. */
    setInferenceFps(fps) {
        if (!Number.isFinite(fps) || fps < 0 || fps > 120 || (fps > 0 && fps < 1)) {
            throw new RangeError("maxInferenceFps must be 0 or between 1 and 120");
        }
        this.maxInferenceFps = fps;
        this.lastInferenceAt = null;
    }

    /** Switch the pose model, keeping the camera and recognition state. Rejected names change nothing. */
    async setPoseModel(name) {
        if (!this.poseModels.includes(name)) {
            throw new RangeError(`poseModel must be one of ${this.poseModels.join(", ")}`);
        }
        if (name === this.state.poseModel || this.disposed) return;
        const models = this.models;
        if (!models) { this.publish({ poseModel: name }); return; }
        if (!models.loadPose) throw new Error("The model loader cannot change the pose model");
        if (this.loadingPose) throw new Error("A pose model change is already in progress");
        this.loadingPose = models.loadPose(name).finally(() => { this.loadingPose = null; });
        this.publish({ busy: true, status: "Loading the pose model..." });
        try {
            await this.loadingPose;
            if (this.disposed || this.models !== models) return;
            this.publish({ poseModel: name, status: this.state.running
                ? "Pose model changed." : "Pose model loaded." });
        } catch (error) {
            this.publish({ status: error.message });
            throw error;
        } finally {
            if (!this.disposed) this.publish({ busy: false });
        }
    }

    async ensureHands() {
        if (!this.models || this.models.hands) return;
        if (!this.models.loadHands) throw new Error("The model loader cannot enable hand tracking");
        if (!this.loadingHands) {
            const models = this.models;
            this.loadingHands = models.loadHands().then(hands => {
                if (this.disposed || this.models !== models) hands.close();
                else models.hands = hands;
            }).finally(() => { this.loadingHands = null; });
        }
        await this.loadingHands;
    }

    async importJSON(json) {
        if (new TextEncoder().encode(json).length > 1024 * 1024) {
            throw new Error("Configuration exceeds 1 MiB");
        }
        const revision = ++this.profileRevision;
        await this.initialize();
        if (revision !== this.profileRevision) return;
        this.tracker.importJSON(json);
        if (this.models && this.tracker.trackHands()) {
            try { await this.ensureHands(); }
            catch (error) { this.stop(); this.publish({ status: error.message }); throw error; }
        }
        if (revision !== this.profileRevision || this.disposed) return;
        this.tracker.recalibrate();
        this.publish({ actions: [], status: "Profile imported. Recalibrating." });
    }

    recalibrate() {
        this.tracker?.recalibrate();
        this.publish({ actions: [], status: "Recalibrating." });
    }

    stop() {
        ++this.generation;
        cancelAnimationFrame(this.request);
        this.stream?.getTracks().forEach(track => track.stop());
        this.stream = null;
        if (this.video) this.video.srcObject = null;
        this.tracker?.restart();
        this.canvas?.getContext("2d").clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.publish({ running: false, actions: [], status: "Camera stopped." });
    }

    dispose() {
        if (this.disposed) return;
        this.stop();
        this.disposed = true;
        this.models?.pose.close();
        this.models?.hands?.close();
        this.tracker?.dispose();
        this.listeners.clear();
    }
}
