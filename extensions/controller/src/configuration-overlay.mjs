// Geometry comes from the active MIG profile and its engine-owned grid.
// This module only renders it; it does not infer poses or recognize gestures.
export function projectCell(grid, cell) {
    const [x, y, width = 1, height = 1] = cell;
    return [[x, y], [x + width, y], [x + width, y + height], [x, y + height]].map(([column, row]) => {
        const u = (column - 4.5) * grid.scale;
        const v = (row - 3.5) * grid.scale;
        return {
            // Mirror once here so canvas labels remain readable.
            x: 1 - (grid.centerX + grid.axisX * u - grid.axisY * v) / grid.aspect,
            y: grid.centerY + grid.axisY * u + grid.axisX * v
        };
    });
}

export function clearConfiguration(canvas) {
    canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
}

export function drawConfiguration(canvas, video, tracker, profile, movementId, labels) {
    if (!video.videoWidth || !video.videoHeight) { clearConfiguration(canvas); return false; }
    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
    }
    clearConfiguration(canvas);
    const movement = profile?.inputs.find(input => input.id === movementId);
    const grid = movement && tracker?.grid(movement.space ?? "calibrated");
    const context = canvas.getContext("2d");
    if (!grid || !context) return false;
    const width = canvas.width, height = canvas.height;
    const regions = movement.steps.flatMap(step => step.constraints);
    const centres = [];
    const fontSize = Math.max(16, width / 35);
    context.save();
    context.lineWidth = Math.max(2, width / 320);
    context.font = `600 ${fontSize}px system-ui, sans-serif`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    for (const region of regions) {
        const points = projectCell(grid, region.cell);
        const trigger = region.type === "trigger";
        context.beginPath();
        points.forEach((point, index) => context[index ? "lineTo" : "moveTo"](point.x * width, point.y * height));
        context.closePath();
        context.fillStyle = trigger ? "#ffd34d30" : "#40dc9530";
        context.strokeStyle = trigger ? "#ffd34d" : "#40dc95";
        context.fill();
        context.stroke();
        const x = points.reduce((sum, p) => sum + p.x, 0) / points.length * width;
        const y = points.reduce((sum, p) => sum + p.y, 0) / points.length * height;
        centres.push({ x: Math.max(fontSize * 2, Math.min(width - fontSize * 2, x)),
            y: Math.max(fontSize, Math.min(height - fontSize, y)) });
    }
    if (centres.length === 2) {
        const [start, finish] = centres;
        const angle = Math.atan2(finish.y - start.y, finish.x - start.x);
        const head = fontSize * .6;
        context.strokeStyle = "#fff";
        context.beginPath();
        context.moveTo(start.x, start.y);
        context.lineTo(finish.x, finish.y);
        context.moveTo(finish.x - head * Math.cos(angle - .5), finish.y - head * Math.sin(angle - .5));
        context.lineTo(finish.x, finish.y);
        context.lineTo(finish.x - head * Math.cos(angle + .5), finish.y - head * Math.sin(angle + .5));
        context.stroke();
        for (const [index, label] of [labels.start, labels.finish].entries()) {
            const point = centres[index];
            context.lineWidth = fontSize * .3;
            context.strokeStyle = "#101a24";
            context.fillStyle = index ? "#ffd34d" : "#40dc95";
            context.strokeText(label, point.x, Math.max(fontSize, point.y - fontSize));
            context.fillText(label, point.x, Math.max(fontSize, point.y - fontSize));
        }
    }
    const landmark = regions[0]?.landmark === "right_wrist" ? 16 : 15;
    const point = tracker.coordinate(landmark);
    if (point) {
        context.beginPath();
        context.arc((1 - point.x) * width, point.y * height, fontSize * .3, 0, Math.PI * 2);
        context.fillStyle = "#fff";
        context.strokeStyle = "#101a24";
        context.lineWidth = fontSize * .15;
        context.fill();
        context.stroke();
    }
    context.restore();
    return true;
}
