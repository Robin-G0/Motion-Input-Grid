const names = {8:"Backspace",9:"Tab",13:"Enter",27:"Escape",32:" ",33:"PageUp",34:"PageDown",35:"End",36:"Home",37:"ArrowLeft",38:"ArrowUp",39:"ArrowRight",40:"ArrowDown",45:"Insert",46:"Delete"};
export function keySpec(keys) {
    if (!Array.isArray(keys) || keys.length < 1 || keys.length > 3 || !keys.every(Number.isInteger) || new Set(keys).size !== keys.length) throw new Error("Invalid key combination");
    const modifiers = keys.filter(key => [16,17].includes(key));
    const values = keys.filter(key => ![16,17].includes(key));
    if (values.length !== 1) throw new Error("Use one key, optionally with Shift or Ctrl. System shortcuts are blocked.");
    const value = values[0];
    const key = names[value] ?? (Number.isInteger(value) && (value >= 48 && value <= 57 || value >= 65 && value <= 90) ? String.fromCharCode(value) : null);
    if (!key || modifiers.includes(17) && (![65,67,86,88,89,90].includes(value) || modifiers.includes(16))) throw new Error("This system or browser shortcut is blocked");
    return {key,code:value >= 65 && value <= 90 ? `Key${key}` : value >= 48 && value <= 57 ? `Digit${key}` : key === " " ? "Space" : key,
        keyCode:value,shiftKey:modifiers.includes(16),ctrlKey:modifiers.includes(17),altKey:false,metaKey:false};
}
export function keyLabel(keys) {
    const spec = keySpec(keys);
    return [spec.ctrlKey && "Ctrl",spec.shiftKey && "Shift",spec.key === " " ? "Space" : spec.key].filter(Boolean).join(" + ");
}
export function eventKeys(event) {
    if (event.isComposing || ["Control","Shift","Alt","Meta"].includes(event.key)) return null;
    if (event.altKey || event.metaKey) throw new Error("Alt and Windows/Command shortcuts are blocked");
    const value = Object.entries(names).find(([,key]) => key === event.key)?.[0]
        ?? (/^[a-z0-9]$/i.test(event.key) ? event.key.toUpperCase().charCodeAt(0) : null);
    const keys = [...(event.ctrlKey ? [17] : []),...(event.shiftKey ? [16] : []),Number(value)];
    keySpec(keys); return keys;
}
export function profileBindings(profile) {
    if (!profile || profile.schema_version !== 2 || !Array.isArray(profile.inputs) || !profile.inputs.length || profile.inputs.length > 64) throw new Error("Import a schema-v2 profile with 1–64 movements");
    const ids = new Set();
    return profile.inputs.map(input => {
        if (![input.id,input.name,input.action].every(value=>typeof value==="string"&&!value.includes("\0")) || !input.id || ids.has(input.id) || input.name.length > 256) throw new Error("Invalid movement names or identifiers");
        ids.add(input.id);
        if (![undefined,"single_press"].includes(input.action_mode)) throw new Error(`${input.name}: use Once mode in Studio for browser remote controls`);
        if (!Array.isArray(input.keyboard) || !input.keyboard.length || input.keyboard.length > 16) throw new Error(`${input.name}: assign a key in Studio before importing`);
        return {id:input.id,name:input.name,keys:input.keyboard.map(step => {
            if (!step || Object.keys(step).length !== 1 || !Array.isArray(step.keys)) throw new Error(`${input.name}: text macros are not browser key commands`);
            keySpec(step.keys); return [...step.keys];
        })};
    });
}
