export const centreRadius = .2;
export const centralFrameRadius = .25;

export function validWrist(point) {
    return point && Number.isFinite(point.x) && Number.isFinite(point.y)
        && point.x >= 0 && point.x <= 1 && point.y >= 0 && point.y <= 1
        && Number.isFinite(point.confidence ?? 1) && (point.confidence ?? 1) >= .6;
}

export function bothHandsVisible(session) {
    return [15, 16].every(index => validWrist(session.coordinate(index)));
}

export function bothHandsCentred(session) {
    return handsCentred(session);
}

export function reliableWrist(point) {
    return validWrist(point) && (point.confidence ?? 1) >= .8;
}

export function handsVisible(session, requiredHands = 2) {
    return [15, 16].filter(index => reliableWrist(session.coordinate(index))).length >= requiredHands;
}

export function handsCentred(session, requiredHands = 2) {
    return [15, 16].filter(index => {
        const point = session.coordinate(index);
        return reliableWrist(point) && centredWrist(point, centralFrameRadius);
    }).length >= requiredHands;
}

export function primaryWrist(session) {
    let closest = null;
    let distance = Infinity;
    for (const index of [15, 16]) {
        const point = session.coordinate(index);
        if (!reliableWrist(point)) continue;
        const squaredDistance = (point.x - .5) ** 2 + (point.y - .5) ** 2;
        if (squaredDistance < distance) {
            closest = index;
            distance = squaredDistance;
        }
    }
    return closest;
}

export function handsAtTargets(session, tolerance = .16, requiredHands = 2) {
    if (requiredHands === 1) {
        return [15, 16].some(index => {
            const point = session.coordinate(index);
            return reliableWrist(point) && centredWrist(point, tolerance);
        });
    }
    if (!bothHandsCentred(session)) return false;
    const hands = [15, 16].map(index => session.coordinate(index));
    hands.sort((a, b) => a.x - b.x);
    return hands[1].x - hands[0].x >= .15 && hands.every((point, index) =>
        Math.abs(point.x - [.35, .65][index]) <= tolerance && Math.abs(point.y - .5) <= .2);
}

export function handPosition(session, wrist) {
    const anchor = session.coordinate(wrist);
    if (anchor != null && !validWrist(anchor)) return null;
    let x = 0;
    let y = 0;
    let count = 0;
    let reference = validWrist(anchor) ? anchor : null;
    for (const index of [wrist, wrist + 2, wrist + 4, wrist + 6]) {
        const point = index === wrist ? anchor : session.coordinate(index);
        if (!validWrist(point)) continue;
        if (reference && Math.hypot(point.x - reference.x, point.y - reference.y) > .18) continue;
        reference ??= point;
        x += point.x;
        y += point.y;
        count++;
    }
    if (!count || (!validWrist(anchor) && count < 2)) return null;
    return { x: x / count, y: y / count };
}

export function centredWrist(point, radius = centreRadius) {
    return validWrist(point) && Math.abs(point.x - .5) <= radius && Math.abs(point.y - .5) <= radius;
}

export function focusedWrist(session, previous = null) {
    let closest = null;
    let distance = Infinity;
    for (const landmark of [15, 16]) {
        const point = handPosition(session, landmark);
        if (!validWrist(point)) continue;
        if (landmark === previous && point.y < .8) return { landmark, point };
        const squaredDistance = (point.x - .5) ** 2 + (point.y - .5) ** 2;
        if (squaredDistance < distance) {
            closest = { landmark, point };
            distance = squaredDistance;
        }
    }
    return closest;
}
