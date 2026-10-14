import { gestureProfile } from "./gestures.mjs";
import { settings } from "../settings.mjs";
import { scheduledSession, boundedPose } from "./processing.mjs";

let dependencyAttempt = 0;
function dependencyURL(name, assetBase, attempt) {
    const url = new URL(name, assetBase);
    // Some browsers retain a failed module request for the lifetime of the page.
    // A new URL lets an explicit retry download the entry modules again.
    if (attempt > 0) url.searchParams.set("retry", String(attempt));
    return url.href;
}

async function importDependency(name, assetBase, attempt) {
    try {
        return await import(dependencyURL(name, assetBase, attempt));
    } catch (error) {
        dependencyAttempt = Math.max(dependencyAttempt, attempt + 1);
        throw error;
    }
}

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

async function cameraDependencies(assetBase, attempt) {
    const [tracking, models, overlay] = await Promise.all([
        importDependency("mig-tracker.mjs", assetBase, attempt),
        importDependency("models.mjs", assetBase, attempt),
        importDependency("overlay.mjs", assetBase, attempt)
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
    const assetBase = new URL("../../mig/", import.meta.url).href;
    const attempt = dependencyAttempt;
    const { MIGSession } = await importDependency("session.mjs", assetBase, attempt);
    const ScheduledSession = scheduledSession(MIGSession);
    const session = new ScheduledSession({
        assetBase,
        dependencies: await cameraDependencies(assetBase, attempt),
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
    // Resource URLs describe where loading failed, not camera permissions.
    const message = String(status).replace(/https?:\/\/\S+/gi, "");
    if (/insecure|security|requires? https|secure context/i.test(message)) return "insecureCamera";
    if (/fetch|network|download|failed to load|loading.*module|importing.*module/i.test(message)) return "networkCamera";
    if (/denied|permission|not.?allowed/i.test(status)) return "denied";
    if (/notreadable|trackstart|camera.*use|busy/i.test(status)) return "busyCamera";
    if (/interrupted|ended|disconnected/i.test(status)) return "interruptedCamera";
    if (/notfound|device|overconstrained/i.test(status)) return "unavailable";
    return "error";
}
