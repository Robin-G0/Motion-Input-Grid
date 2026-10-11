export const centreRadius = .2;

export function validWrist(point) {
    return point && Number.isFinite(point.x) && Number.isFinite(point.y)
        && point.x >= 0 && point.x <= 1 && point.y >= 0 && point.y <= 1;
}

export function centredWrist(point, radius = centreRadius) {
    return validWrist(point) && Math.abs(point.x - .5) <= radius && Math.abs(point.y - .5) <= radius;
}

export function focusedWrist(session, previous = null) {
    let closest = null;
    let distance = Infinity;
    for (const landmark of [15, 16]) {
        const point = session.coordinate(landmark);
        if (!validWrist(point)) continue;
        if (landmark === previous && centredWrist(point, .24)) return { landmark, point };
        const squaredDistance = (point.x - .5) ** 2 + (point.y - .5) ** 2;
        if (squaredDistance < distance) {
            closest = { landmark, point };
            distance = squaredDistance;
        }
    }
    return closest;
}
