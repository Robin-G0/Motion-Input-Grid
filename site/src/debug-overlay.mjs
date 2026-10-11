const handColors = ["#65f2b0", "#77c7ff"];

export function drawDebugOverlay(canvas, video, camera, swipes, enabled) {
    const width = 640;
    const height = Math.round(width * (video.videoHeight || 360) / (video.videoWidth || 640));
    if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
    }
    const context = canvas.getContext("2d");
    context.fillStyle = "#14202d";
    context.fillRect(0, 0, width, height);
    if (video.readyState >= 2) {
        context.save();
        context.translate(width, 0);
        context.scale(-1, 1);
        context.drawImage(video, 0, 0, width, height);
        context.restore();
    }
    const rectangle = (x, y, w, h, color, dashed = false) => {
        context.strokeStyle = color;
        context.lineWidth = 2;
        context.setLineDash(dashed ? [6, 5] : []);
        context.strokeRect((1 - x - w) * width, y * height, w * width, h * height);
    };
    if (enabled.has("centre")) rectangle(.3, .3, .4, .4, "#ffd65f");
    if (enabled.has("edges")) {
        rectangle(.25, .25, .5, .5, "#ff8585");
        rectangle(.32, .32, .36, .36, "#ff8585", true);
    }
    context.setLineDash([]);
    const dot = (point, radius, color) => {
        context.fillStyle = color;
        context.beginPath();
        context.arc((1 - point.x) * width, point.y * height, radius, 0, Math.PI * 2);
        context.fill();
    };
    if (enabled.has("points")) {
        for (let index = 0; index < 33; index++) {
            const point = camera.coordinate(index);
            if (!point) continue;
            dot(point, 3, index % 2 ? handColors[0] : handColors[1]);
            context.font = "12px monospace";
            context.fillText(`${index}: ${(point.confidence ?? 1).toFixed(2)}`,
                (1 - point.x) * width + 5, point.y * height - 5);
        }
    }
    for (const [side, hand] of camera.hands.entries()) {
        if (enabled.has("hands") && hand.point) dot(hand.point, 7, handColors[side]);
        if (!enabled.has("thresholds")) continue;
        const color = handColors[side];
        const horizontal = swipes.hands.get(hand.landmark);
        const vertical = swipes.verticalHands.get(hand.landmark);
        if (horizontal) rectangle(horizontal.start - swipes.distance, 0, swipes.distance * 2, 1, color, true);
        if (vertical) rectangle(vertical.x - swipes.raiseDrift, vertical.y - swipes.raiseDistance,
            swipes.raiseDrift * 2, swipes.raiseDistance * 2, color, true);
    }
    context.setLineDash([]);
}
