export function shouldRun({armed,mode,manual,tab,presenting,lastSeen}, now) {
    return !!(armed && tab && tab.active && !tab.discarded && /^https?:/.test(tab.url ?? "")
        && (mode === "manual" ? manual : presenting && now-lastSeen < 3500));
}
export function isEditable(element) {
    return !!element?.closest?.('input,textarea,select,[contenteditable="true"],[role="textbox"]');
}
