// Camera frames can arrive before MIG has finished calibrating its body grid.
export function trackingStatus(session) {
    if (!session.coordinate(11) || !session.coordinate(12)) return "missing";
    return session.tracker.grid() ? "active" : "configurationCalibrating";
}
