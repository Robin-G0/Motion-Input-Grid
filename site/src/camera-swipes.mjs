import { centredWrist, validWrist, reliableWrist, handsVisible } from "./hand-focus.mjs";

function plausibleTravel(previous, point, time) {
    const elapsed = Math.max(0, time - previous.lastTime) / 1000;
    const maximum = Math.min(.5, .08 + elapsed * 1.5);
    return Math.hypot(point.x - previous.lastX, point.y - previous.lastY) <= maximum;
}

// A gesture starts inside the frame, then follows the wrist across it.
export class CameraSwipes {
    constructor({ distance = .08, horizontalDuration = 100, centreDuration = 150, startRadius = .48,
        raiseDistance = .19, raiseDuration = 175, raiseDrift = .2, duration = 2500, gap = 450,
        requiredHands = null } = {}) {
        this.requiredHands = requiredHands;
        this.distance = distance;
        this.horizontalDuration = horizontalDuration;
        this.centreDuration = centreDuration;
        this.startRadius = startRadius;
        this.raiseDistance = raiseDistance;
        this.raiseDuration = raiseDuration;
        this.raiseDrift = raiseDrift;
        this.duration = duration;
        this.gap = gap;
        this.reset();
    }

    reset() {
        this.hands = new Map();
        this.verticalHands = new Map();
        this.centres = new Map();
        this.readyHands = new Map();
    }

    isArmed(time, session, sourceLandmark = null) {
        if (session && !this.canTrack(session)) return false;
        if (session && sourceLandmark === null) {
            const check = landmark => this.isArmed(time, session, landmark);
            return this.requiredHands === 1 ? [15, 16].some(check) : [15, 16].every(check);
        }
        for (const [landmark, hand] of this.readyHands) {
            if (sourceLandmark !== null && landmark !== sourceLandmark) continue;
            if (session) {
                const point = session.coordinate(landmark);
                if (!this.validPoint(point) || !plausibleTravel(hand, point, time)) continue;
            }
            if (time - hand.lastTime <= this.gap && time - hand.startTime <= this.duration) return true;
        }
        return false;
    }

    validPoint(point) { return this.requiredHands === null ? validWrist(point) : reliableWrist(point); }

    canTrack(session) {
        return this.requiredHands === null || handsVisible(session, this.requiredHands);
    }

    canStart(session) {
        return [15, 16].filter(index => {
            const point = session.coordinate(index);
            return this.validPoint(point) && centredWrist(point, this.startRadius);
        }).length >= (this.requiredHands ?? 1);
    }

    accept(landmark, point, time, allowStart = true) {
        const ready = this.readyHands.get(landmark);
        if (ready && centredWrist(point, this.startRadius)
            && Math.hypot(point.x - ready.lastX, point.y - ready.lastY) < .025) ready.startTime = time;
        if (ready && time - ready.lastTime <= this.gap && time - ready.startTime <= this.duration) {
            ready.lastTime = time;
            ready.lastX = point.x;
            ready.lastY = point.y;
            return true;
        }
        this.readyHands.delete(landmark);
        this.hands.delete(landmark);
        this.verticalHands.delete(landmark);
        if (!allowStart || !centredWrist(point, this.startRadius)) {
            this.centres.delete(landmark);
            return false;
        }
        const centre = this.centres.get(landmark);
        if (!centre || time - centre.lastTime > this.gap || !plausibleTravel(centre, point, time)) {
            this.centres.set(landmark, { lastX: point.x, lastY: point.y, startTime: time, lastTime: time });
            return false;
        }
        centre.lastTime = time;
        centre.lastX = point.x;
        centre.lastY = point.y;
        if (time - centre.startTime < this.centreDuration) return false;
        this.centres.delete(landmark);
        this.readyHands.set(landmark, { lastX: point.x, lastY: point.y, startTime: time, lastTime: time });
        this.hands.set(landmark, { start: point.x, startY: point.y, startTime: time, lastTime: time });
        this.verticalAction(landmark, point, time);
        return true;
    }

    verticalAction(landmark, point, time) {
        let sample = this.verticalHands.get(landmark);
        // Use cumulative motion: slow gestures and small frame-to-frame jitter
        // must not hide a reversal or repeatedly restart its timer.
        const reversed = sample && time - sample.lastTime <= this.gap
            && time - sample.startTime <= this.duration
            && Math.abs(point.x - sample.x) <= this.raiseDrift && sample.direction !== 0
            && (sample.extremeY - point.y) * sample.direction < -.06;
        if (!sample || time - sample.lastTime > this.gap
            || time - sample.startTime > this.duration || reversed
            || Math.abs(point.x - sample.x) > this.raiseDrift) {
            const startY = reversed ? sample.extremeY : point.y;
            const startTime = reversed ? sample.extremeTime : time;
            sample = { x: point.x, y: startY, direction: reversed ? -sample.direction : 0,
                extremeY: point.y, extremeTime: time, startTime, lastTime: time };
            this.verticalHands.set(landmark, sample);
        }
        if (sample.direction === 0 && Math.abs(sample.y - point.y) > .04) {
            sample.direction = Math.sign(sample.y - point.y);
        }
        if ((sample.extremeY - point.y) * sample.direction > 0) {
            sample.extremeY = point.y;
            sample.extremeTime = time;
        }
        sample.lastTime = time;
        sample.lastY = point.y;
        if (sample.direction === 0) sample.startTime = time;
        const distance = sample.y - point.y;
        // Both directions need a deliberate vertical sweep, not a small diagonal lift.
        if (Math.abs(distance) < this.raiseDistance || time - sample.startTime < this.raiseDuration) return null;
        this.verticalHands.delete(landmark);
        return distance > 0 ? "scroll_presentation" : "scroll_previous";
    }

    update(session, time, { horizontal = true } = {}) {
        if (!this.canTrack(session)) { this.reset(); return []; }
        const allowStart = this.canStart(session);
        const actions = [];
        for (const landmark of [15, 16]) {
            const point = session.coordinate(landmark);
            if (!this.validPoint(point)) {
                this.centres.delete(landmark);
                if (time - (this.readyHands.get(landmark)?.lastTime ?? -Infinity) > this.gap) {
                    this.readyHands.delete(landmark);
                }
                // Brief occlusion must not erase a slow sweep. A long gap still resets it.
                if (time - (this.hands.get(landmark)?.lastTime ?? -Infinity) > this.gap) this.hands.delete(landmark);
                if (time - (this.verticalHands.get(landmark)?.lastTime ?? -Infinity) > this.gap) this.verticalHands.delete(landmark);
                continue;
            }
            const previous = this.readyHands.get(landmark);
            if (previous && time - previous.lastTime <= this.gap && !plausibleTravel(previous, point, time)) {
                this.readyHands.delete(landmark);
                this.hands.delete(landmark);
                this.verticalHands.delete(landmark);
                this.centres.delete(landmark);
                this.onReject?.(landmark, "jump");
                continue;
            }
            if (!this.accept(landmark, point, time, allowStart)) continue;
            const vertical = this.verticalAction(landmark, point, time);
            if (vertical) actions.push(vertical);
            if (!horizontal) { this.hands.delete(landmark); continue; }
            let sample = this.hands.get(landmark);
            const position = point.x;
            if (!sample || time - sample.lastTime > this.gap
                || time - sample.startTime > this.duration) {
                sample = { start: position, startY: point.y, startTime: time, lastTime: time };
                this.hands.set(landmark, sample);
            }
            sample.lastTime = time;
            sample.lastX = point.x;
            sample.lastY = point.y;
            const distance = position - sample.start;
            if (Math.abs(distance) < .025 && Math.abs(point.y - sample.startY) < .025) sample.startTime = time;
            // A vertical sweep with some lateral drift must not change a slide first.
            if (Math.abs(distance) >= this.distance && time - sample.startTime >= this.horizontalDuration
                && Math.abs(distance) > Math.abs(point.y - sample.startY) * 1.5) {
                // The camera preview is mirrored: increasing image x sweeps left on screen.
                actions.push(distance > 0 ? "next_slide" : "previous_slide");
                this.hands.delete(landmark);
            }
        }
        if (actions.length) this.reset();
        return [...new Set(actions)];
    }
}
