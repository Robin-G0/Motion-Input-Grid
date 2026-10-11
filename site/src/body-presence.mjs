import { validWrist } from "./hand-focus.mjs";

export function bodyPresent(session, minimumConfidence) {
    return [11, 12].every(index => {
        const point = session.coordinate(index);
        return validWrist(point) && (point.confidence ?? 1) >= minimumConfidence;
    });
}
