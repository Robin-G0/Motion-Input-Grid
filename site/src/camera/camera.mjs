import { gestureProfile } from "./gestures.mjs";
import { settings } from "../settings.mjs";
import { scheduledSession, boundedPose } from "./processing.mjs";

export async function configurePose(models) {
    try {
        await models.pose.setOptions({
            minPoseDetectionConfidence: settings.presenceConfidence,
            minPosePresenceConfidence: settings.presenceConfidence,
            minTrackingConfidence: settings.presenceConfidence
        });
        return models;
    } catch (error) {
        models.pose.close();
        models.hands.close();
        throw error;
    }
}

async function cameraDependencies(assetBase) {
    const [tracking, models, overlay] = await Promise.all([
        import(new URL("mig-tracker.mjs", assetBase).href),
        import(new URL("models.mjs", assetBase).href),
        import(new URL("overlay.mjs", assetBase).href)
    ]);
    return {
        createTracker: json => tracking.MIGTracker.create(json),
        loadModels: async () => {
            const loaded = await configurePose(await models.loadModels(assetBase));
            loaded.pose = boundedPose(loaded.pose);
            return loaded;
        },
        // The deployed demo hides this overlay. Avoid resizing and drawing an
        // invisible full-resolution canvas on every observation.
        drawOverlay: (canvas, ...args) => { if (!canvas.hidden) overlay.drawOverlay(canvas, ...args); }
    };
}

// Only this file knows about MIG. The rest of the page handles ordinary UI state.
export async function createCameraSession(onAction, onFrame) {
    const { MIGSession } = await import("../../mig/session.mjs");
    const assetBase = new URL("../../mig/", import.meta.url).href;
    const ScheduledSession = scheduledSession(MIGSession);
    const session = new ScheduledSession({
        assetBase,
        dependencies: await cameraDependencies(assetBase),
        profileMode: true,
        onAction,
        onFrame
    });
    try {
        await session.importJSON(JSON.stringify(gestureProfile));
        return session;
    } catch (error) {
        session.dispose();
        throw error;
    }
}

export function cameraError(status) {
    if (/insecure|security|https/i.test(status)) return "insecureCamera";
    if (/denied|permission|not.?allowed/i.test(status)) return "denied";
    if (/notreadable|trackstart|camera.*use|busy/i.test(status)) return "busyCamera";
    if (/interrupted|ended|disconnected/i.test(status)) return "interruptedCamera";
    if (/notfound|device|overconstrained/i.test(status)) return "unavailable";
    return "error";
}
