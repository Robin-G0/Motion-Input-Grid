export const fingerNames = ["thumb", "index", "middle", "ring", "pinky"];
export function setFingerRule(region, hand, finger, pose, timing = {}) {
    const rules = region.fingers ?? [];
    const previous = rules.find(rule => rule.hand === hand && rule.finger === finger);
    const retained = rules.filter(rule => rule.hand !== hand || rule.finger !== finger);
    if (pose) retained.push({ ...previous, hand, finger, pose,
        stable_ms: previous?.stable_ms ?? 100, grace_ms: previous?.grace_ms ?? 150, ...timing });
    if (retained.length) region.fingers = retained; else delete region.fingers;
}

export class FingerEditor {
    constructor(root, hand, text, onChange) {
        this.root = root; this.hand = hand; this.text = text; this.rows = [];
        for (const finger of fingerNames) {
            const row = document.createElement("div"); row.className = "finger-row";
            const label = document.createElement("label"); label.className = "field";
            const name = document.createElement("span"), select = document.createElement("select"); select.dataset.finger = finger;
            label.append(name, select); row.append(label);
            const details = document.createElement("details"), summary = document.createElement("summary"); details.append(summary);
            const timing = document.createElement("div"); timing.className = "field-row";
            const controls = {};
            for (const [property, min, max] of [["stable_ms", 50, 500], ["grace_ms", 0, 300]]) {
                const field = document.createElement("label"); field.className = "field";
                const caption = document.createElement("span"), value = document.createElement("input");
                value.type = "number"; value.min = min; value.max = max; value.step = 1; value.dataset.timing = property; value.dataset.finger = finger;
                value.addEventListener("change", () => {
                    if (!value.checkValidity() || value.value === "") { this.render(this.region); return; }
                    onChange(this.hand.value, finger, select.value, { [property]: Number(value.value) });
                });
                field.append(caption, value); timing.append(field); controls[property] = { caption, value };
            }
            details.append(timing); row.append(details); root.append(row);
            select.addEventListener("change", () => onChange(this.hand.value, finger, select.value));
            this.rows.push({ finger, row, name, select, details, summary, controls });
        }
        hand.addEventListener("change", () => this.render(this.region));
    }
    render(region) {
        this.region = region;
        for (const { finger, name, select, details, summary, controls } of this.rows) {
            name.textContent = this.text(`finger_${finger}`);
            const rule = region?.fingers?.find(rule => rule.hand === this.hand.value && rule.finger === finger);
            const value = rule?.pose ?? "";
            select.replaceChildren(...["", "extended", "closed"].map(pose => {
                const option = document.createElement("option"); option.value = pose; option.textContent = this.text(pose || "freeFinger"); return option;
            }));
            select.value = value; details.hidden = !rule;
            summary.textContent = this.text("fingerTiming");
            for (const property of ["stable_ms", "grace_ms"]) {
                controls[property].caption.textContent = this.text(property);
                controls[property].value.value = rule?.[property] ?? (property === "stable_ms" ? 100 : 150);
            }
        }
    }
}
