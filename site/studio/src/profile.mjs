export const MAX_BYTES = 1024 * 1024;
export const landmarks = { head: 33, left_shoulder: 11, right_shoulder: 12,
    left_elbow: 13, right_elbow: 14, left_wrist: 15, right_wrist: 16,
    left_hip: 23, right_hip: 24, left_knee: 25, right_knee: 26,
    left_ankle: 27, right_ankle: 28 };
export const trackingLandmarks = { ...landmarks, nose: 0, left_hand: 15, right_hand: 16,
    left_eye_inner: 1, left_eye: 2, left_eye_outer: 3, right_eye_inner: 4, right_eye: 5, right_eye_outer: 6,
    left_ear: 7, right_ear: 8, left_mouth: 9, right_mouth: 10, left_pinky: 17, right_pinky: 18,
    left_index: 19, right_index: 20, left_thumb: 21, right_thumb: 22,
    left_heel: 29, right_heel: 30, left_foot: 31, right_foot: 32 };
export const clone = value => structuredClone(value);
export function id(prefix) { return `${prefix}_${crypto.randomUUID().slice(0, 8)}`; }
export function newInput(index = 1) {
    return { id: id("movement"), name: `Mouvement ${index}`, action: `action_${index}`,
        space: "body", cooldown_ms: 700, steps: [{ id: id("step"), mode: "ordered", constraints: [] }] };
}
export function starter() {
    const input = newInput();
    input.name = "Lever la main gauche";
    input.action = "hand_raised";
    input.steps[0].constraints = [[-9, 4, 27, 4], [-9, -3, 27, 6]].map((cell, index) => ({
        id: id("region"), landmark: "left_wrist", cell,
        type: index === 1 ? "trigger" : "required", priority: "high", order: index + 1
    }));
    return { schema_version: 2, tracking: { hands: false }, inputs: [input] };
}
export function parseProfile(text) {
    if (new TextEncoder().encode(text).length > MAX_BYTES) throw new Error("size");
    let value;
    try { value = JSON.parse(text); } catch { throw new Error("json"); }
    if (!value || value.schema_version !== 2 || !Array.isArray(value.inputs)) throw new Error("schema");
    // The WASM parser validates the complete schema before accepting an import.
    return value;
}
export function regions(input) {
    return [...(input?.constraints ?? []), ...(input?.steps ?? []).flatMap(step => step.constraints ?? [])];
}
export function scopedRegions(input, scope) {
    if (scope === "global") return input?.constraints ?? [];
    return input?.steps?.[Number(scope)]?.constraints ?? [];
}
export function cellRect(cell) { return { x: cell[0], y: cell[1], w: cell[2] ?? 1, h: cell[3] ?? 1 }; }
export function rectangle(from, to) {
    return [Math.min(from.x, to.x), Math.min(from.y, to.y), Math.abs(from.x - to.x) + 1, Math.abs(from.y - to.y) + 1];
}
export function nextOrder(constraints, landmark) {
    return 1 + Math.max(0, ...constraints.filter(c => c.landmark === landmark && c.priority !== "low").map(c => c.order ?? 0));
}
export function addRegion(input, scope, cell, { type, landmark }) {
    const constraints = scope === "global" ? (input.constraints ??= []) : input.steps[Number(scope)].constraints;
    // Global guards cannot fire actions or carry an ordered sequence.
    if (scope === "global" && ["trigger", "interaction"].includes(type)) throw new Error("globalTrigger");
    if (["trigger", "interaction"].includes(type)
        && regions(input).some(c => ["trigger", "interaction"].includes(c.type))) throw new Error("oneTrigger");
    const mode = scope === "global" ? "simultaneous" : input.steps[Number(scope)].mode;
    const region = { id: id("region"), landmark, cell, type, priority: "high",
        order: mode === "ordered" && type !== "forbidden" ? nextOrder(constraints, landmark) : 0 };
    if (type === "interaction") region.interaction = {
        hand: landmark.startsWith("right_") ? "right" : "left", gesture: "thumb", hold_ms: 400
    };
    constraints.push(region);
    return region.id;
}
export function pasteRegion(input, scope, source, horizontalOffset = 1) {
    if (source.tolerance_for && !regions(input).some(region => region.id === source.tolerance_for)) throw new Error("copyReference");
    const rect = cellRect(source.cell);
    const cell = [Math.max(-9, Math.min(18 - rect.w, rect.x + horizontalOffset)), Math.max(-9, Math.min(18 - rect.h, rect.y + 1)), rect.w, rect.h];
    const regionId = addRegion(input, scope, cell, source);
    const target = scopedRegions(input, scope).find(region => region.id === regionId);
    let order = source.priority === "low" ? 0 : target.order;
    const trigger = scopedRegions(input, scope).find(region => ["trigger", "interaction"].includes(region.type) && region.landmark === source.landmark && region.order > 0);
    if (source.type === "required" && source.priority !== "low" && trigger && order > trigger.order) {
        order = trigger.order; trigger.order++;
    }
    Object.assign(target, clone(source), {id:regionId, cell, order});
    return regionId;
}
export function pasteRegions(input, scope, sources, horizontalOffset = 1) {
    const rects = sources.map(source => cellRect(source.cell));
    const left = Math.min(...rects.map(rect => rect.x)), top = Math.min(...rects.map(rect => rect.y));
    const right = Math.max(...rects.map(rect => rect.x + rect.w)), bottom = Math.max(...rects.map(rect => rect.y + rect.h));
    const dx = Math.max(-9 - left, Math.min(18 - right, horizontalOffset)), dy = Math.max(-9 - top, Math.min(18 - bottom, 1));
    const mapping = new Map();
    for (const source of [...sources].sort((a,b) => Number(a.priority === "low") - Number(b.priority === "low"))) {
        const duplicate = clone(source);
        if (mapping.has(duplicate.tolerance_for)) duplicate.tolerance_for = mapping.get(duplicate.tolerance_for);
        const pasted = pasteRegion(input, scope, duplicate, 0);
        const rect = cellRect(source.cell);
        scopedRegions(input, scope).find(region => region.id === pasted).cell = [rect.x + dx, rect.y + dy, rect.w, rect.h];
        mapping.set(source.id, pasted);
    }
    return sources.map(source => mapping.get(source.id));
}
export class ProfileHistory {
    constructor(profile) { this.value = clone(profile); this.past = []; this.future = []; }
    commit(profile) {
        if (JSON.stringify(profile) === JSON.stringify(this.value)) return false;
        this.past.push(clone(this.value));
        if (this.past.length > 30) this.past.shift();
        this.value = clone(profile); this.future = [];
        return true;
    }
    undo() {
        if (!this.past.length) return false;
        this.future.push(this.value); this.value = this.past.pop(); return true;
    }
    redo() {
        if (!this.future.length) return false;
        this.past.push(this.value); this.value = this.future.pop(); return true;
    }
}
