// Bound inference work without cropping the camera or changing its coordinates.
export function frameSize(width, height, maxEdge = 960) {
    if (!(width > 0 && height > 0)) return null;
    const scale = Math.min(1, maxEdge / Math.max(width, height));
    return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

export function boundedPose(pose, createCanvas = () => document.createElement("canvas")) {
    let canvas;
    let context;
    return {
        setOptions: options => pose.setOptions(options),
        close() {
            pose.close();
            if (canvas) { canvas.width = 0; canvas.height = 0; }
            canvas = context = null;
        },
        detectForVideo(video, time) {
            const size = frameSize(video.videoWidth, video.videoHeight);
            if (!size || (size.width === video.videoWidth && size.height === video.videoHeight)) {
                return pose.detectForVideo(video, time);
            }
            canvas ??= createCanvas();
            context ??= canvas.getContext("2d", { alpha: false });
            if (!context) return pose.detectForVideo(video, time);
            if (canvas.width !== size.width || canvas.height !== size.height) {
                canvas.width = size.width;
                canvas.height = size.height;
            }
            context.drawImage(video, 0, 0, size.width, size.height);
            return pose.detectForVideo(canvas, time);
        }
    };
}

// Use fresh video frames, with a RAF fallback. Slow devices receive idle time
// between inferences rather than a backlog; hidden tabs do no inference work.
export function scheduledSession(BaseSession) {
    return class extends BaseSession {
        tick(run) {
            if (!this.stream || run !== this.generation || this.disposed) return;
            try {
                const now = performance.now();
                const interval = Math.max(1000 / 24, Math.min(100, (this.inferenceCost ?? 0) * 1.5));
                if (!document.hidden && this.video.readyState >= 2
                    && this.video.currentTime !== this.lastVideoTime
                    && (this.lastInferenceAt == null || now - this.lastInferenceAt >= interval)) {
                    this.lastInferenceAt = now;
                    this.processFrame();
                    const cost = performance.now() - now;
                    this.inferenceCost = this.inferenceCost == null ? cost : this.inferenceCost * .8 + cost * .2;
                }
                if (!this.stream || run !== this.generation || this.disposed) return;
                if (typeof this.video.requestVideoFrameCallback === "function") {
                    this.videoRequest = this.video.requestVideoFrameCallback(() => {
                        this.videoRequest = null;
                        this.tick(run);
                    });
                } else this.request = requestAnimationFrame(() => this.tick(run));
            } catch (error) {
                this.stop();
                this.publish({ status: error.message });
            }
        }

        stop() {
            if (this.videoRequest != null) this.video?.cancelVideoFrameCallback?.(this.videoRequest);
            this.videoRequest = null;
            this.lastInferenceAt = null;
            this.inferenceCost = null;
            super.stop();
        }
    };
}
