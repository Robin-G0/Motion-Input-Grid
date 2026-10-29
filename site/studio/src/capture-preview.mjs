import { lineCells } from "./notes.mjs";

// This is display feedback only. Recognition still uses the generated profile.
export function captureTrace(points) {
    const visited = new Map();
    let previous = null, start = null, end = null;
    for (const point of points) {
        if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)
            || point.x < -9 || point.x >= 18 || point.y < -9 || point.y >= 18) { previous = null; continue; }
        const cell = {x:Math.floor(point.x),y:Math.floor(point.y)};
        start ??= cell; end = cell;
        const continuous = previous && !(Number.isFinite(point.time) && Number.isFinite(previous.time) && point.time - previous.time > 180);
        for (const crossed of continuous ? lineCells(previous.cell, cell) : [cell]) visited.set(`${crossed.x},${crossed.y}`, crossed);
        previous = {cell,time:point.time};
    }
    return {cells:[...visited.values()],start,end};
}

export function drawCaptureTrace(canvas, geometry, aspect, space, trace, {ghost = false, startLabel = "S", endLabel = "F"} = {}) {
    const ctx = canvas.getContext("2d");
    if (!ctx || !trace.start || !geometry.transform(space)) return;
    const bounds = canvas.getBoundingClientRect?.();
    const scale = bounds?.width && bounds?.height
        ? Math.min(bounds.width / canvas.width, bounds.height / canvas.height) : 1;
    ctx.save();
    ctx.globalAlpha = ghost ? .24 : 1;
    const cellPath = cell => {
        const corners = [[0,0],[1,0],[1,1],[0,1]].map(([dx,dy]) => geometry.project(cell.x+dx,cell.y+dy,aspect,space));
        if (corners.some(point => !point)) return false;
        ctx.beginPath();
        corners.forEach((p,index) => ctx[index ? "lineTo" : "moveTo"](p.x*canvas.width,p.y*canvas.height));
        ctx.closePath(); return true;
    };
    ctx.fillStyle = "#75bdec55"; ctx.strokeStyle = "#a1d5f3"; ctx.lineWidth = 1 / scale;
    ctx.setLineDash(ghost ? [3 / scale,3 / scale] : []);
    for (const cell of trace.cells) if (cellPath(cell)) { ctx.fill(); ctx.stroke(); }
    const endpoint = (cell, color, label) => {
        if (!cellPath(cell)) return;
        ctx.fillStyle = `${color}88`; ctx.strokeStyle = color; ctx.lineWidth = 2 / scale;
        ctx.fill(); ctx.stroke();
        const point = geometry.project(cell.x+.5,cell.y+.5,aspect,space);
        ctx.save(); ctx.translate(point.x*canvas.width,point.y*canvas.height);
        ctx.scale(1 / scale,1 / scale);
        if (canvas.closest("[data-mirror='true']")) ctx.scale(-1,1);
        ctx.setLineDash([]); ctx.fillStyle = "#111923"; ctx.fillRect(-14,-10,28,20);
        ctx.font = "bold 12px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillStyle = color; ctx.fillText(label,0,0); ctx.restore();
    };
    const same = trace.start.x === trace.end.x && trace.start.y === trace.end.y;
    if (!same) endpoint(trace.start,"#a7d7c3",startLabel);
    endpoint(trace.end,same ? "#a7d7c3" : "#e9c18a",same ? `${startLabel}/${endLabel}` : endLabel);
    ctx.restore();
}
