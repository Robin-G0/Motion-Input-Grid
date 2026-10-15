// Controller schema v2 uses Windows virtual key values on both supported OSes.
const named = {8:"Backspace",9:"Tab",13:"Enter",16:"Shift",17:"Ctrl",18:"Alt",19:"Pause",20:"CapsLock",27:"Escape",32:"Space",33:"PageUp",34:"PageDown",35:"End",36:"Home",37:"Left",38:"Up",39:"Right",40:"Down",44:"PrintScreen",45:"Insert",46:"Delete",91:"Win",93:"Menu",144:"NumLock",145:"ScrollLock",186:"Semicolon",187:"Plus",188:"Comma",189:"Minus",190:"Period",191:"Slash",192:"Backtick",219:"LeftBracket",220:"Backslash",221:"RightBracket",222:"Quote"};
for (let n=48;n<=90;n++) if (n<=57 || n>=65) named[n]=String.fromCharCode(n);
for (let n=1;n<=24;n++) named[111+n]=`F${n}`;
for (let n=0;n<=9;n++) named[96+n]=`Numpad ${n}`;
export const keyName = key => named[key] ?? `VK:${key}`;
export const keyChoices = Array.from({length:255}, (_,i) => [i+1,keyName(i+1)]);
export function keyboardSummary(movement, t = key => key) {
    const sequence = (movement?.keyboard ?? []).map(item => "text" in item ? JSON.stringify(item.text) : item.keys.map(keyName).join(" + ")).join(" → ");
    if (!sequence) return t("noKeyboard");
    const mode = movement.action_mode ?? "single_press";
    return `${sequence} · ${t(mode)}${mode === "repeat" ? ` (${movement.repeat_interval_ms ?? 200} ms)` : ""}`;
}
export function validateKeyboard(movement) {
    const steps = movement.keyboard ?? [];
    if (!Array.isArray(steps) || steps.length > 256) throw new Error("keyboardLimit");
    let bytes=0, keys=0;
    for (const step of steps) {
        if (typeof step !== "object" || !step || Object.keys(step).length !== 1) throw new Error("keyboardInvalid");
        if ("text" in step) {
            if (typeof step.text !== "string" || step.text.includes("\0")) throw new Error("keyboardInvalid");
            bytes += new TextEncoder().encode(step.text).length;
        } else if (Array.isArray(step.keys) && step.keys.length && step.keys.every(key=>Number.isInteger(key)&&key>=1&&key<=255) && new Set(step.keys).size===step.keys.length) keys+=step.keys.length;
        else throw new Error("keyboardInvalid");
    }
    if (bytes>16384 || keys>1024) throw new Error("keyboardLimit");
    if (![undefined,"single_press","hold","repeat"].includes(movement.action_mode)) throw new Error("keyboardInvalid");
    if (movement.action_mode==="hold" && steps.length && !steps.at(-1).keys) throw new Error("holdNeedsKeys");
    const interval=movement.repeat_interval_ms ?? 200;
    if (movement.action_mode==="repeat" && (!Number.isInteger(interval) || interval<20 || interval>60000)) throw new Error("keyboardInterval");
    return movement;
}
export function eventChord(event) {
    if (event.isComposing || ["Control","Shift","Alt","Meta"].includes(event.key)) return null;
    const aliases={ArrowLeft:37,ArrowUp:38,ArrowRight:39,ArrowDown:40," ":32,Escape:27,Delete:46,Backspace:8,Enter:13,Tab:9,Home:36,End:35,PageUp:33,PageDown:34,Insert:45};
    const key=aliases[event.key] ?? (/^[a-z0-9]$/i.test(event.key) ? event.key.toUpperCase().charCodeAt(0) : /^F([1-9]|1\d|2[0-4])$/.test(event.key) ? 111+Number(event.key.slice(1)) : null);
    if (!key) return null;
    return [...(event.ctrlKey?[17]:[]),...(event.shiftKey?[16]:[]),...(event.altKey?[18]:[]),...(event.metaKey?[91]:[]),key];
}

export class KeyboardEditor {
    constructor(dialog, text, apply) {
        this.dialog=dialog; this.t=text; this.apply=apply;
        this.list=dialog.querySelector("#keyboard-steps");
        const $=id=>dialog.querySelector(`#${id}`);
        $("add-chord").onclick=()=>{this.pending=this.draft.keyboard.length;this.render();};
        $("add-text").onclick=()=>{this.draft.keyboard.push({text:""});this.render();};
        $("keyboard-mode").onchange=()=>{this.draft.action_mode=$("keyboard-mode").value;this.render();};
        $("keyboard-interval").onchange=()=>{this.draft.repeat_interval_ms=Number($("keyboard-interval").value);this.preview();};
        $("keyboard-save").onclick=async()=>{
            const draft=this.draft;
            $("keyboard-save").disabled=true;
            try { validateKeyboard(draft); await this.apply(draft); if(this.draft===draft)dialog.close(); }
            catch(error) {if(this.draft===draft){$("keyboard-error").textContent=this.t(error.message)===error.message?this.t("keyboardInvalid"):this.t(error.message);$("keyboard-error").hidden=false;}}
            finally {$("keyboard-save").disabled=false;}
        };
        $("keyboard-cancel").onclick=()=>dialog.close();
    }
    open(movement) {this.pending=null;this.draft=structuredClone(movement);this.draft.keyboard??=[];this.draft.action_mode??="single_press";this.draft.repeat_interval_ms??=200;this.render();this.dialog.showModal();document.dispatchEvent(new Event("keyboard-editor-change"));}
    button(label, run) {const b=document.createElement("button");b.type="button";b.className="text-button";b.textContent=label;b.onclick=run;return b;}
    preview() {this.dialog.querySelector("#keyboard-preview").textContent=keyboardSummary(this.draft,this.t);this.dialog.querySelector("#keyboard-error").hidden=true;}
    render() {
        const t=this.t;
        this.list.replaceChildren(...this.draft.keyboard.map((step,index)=>{
            const row=document.createElement("li");row.className="keyboard-step";
            const title=document.createElement("strong");title.textContent=`${index+1}. ${t(step.keys?"chord":"typeText")}`;row.append(title);
            if (step.keys) {
                const chips=document.createElement("div");chips.className="key-chips";
                for (const key of step.keys) chips.append(this.button(`${keyName(key)} ×`,()=>{step.keys=step.keys.filter(k=>k!==key);if(!step.keys.length)this.draft.keyboard.splice(index,1);this.pending=null;this.render();}));
                const plus=this.button("+",()=>{this.pending=index;this.render();});plus.setAttribute("aria-label",t("addKey"));row.append(chips,plus);
            } else {
                const text=document.createElement("textarea");text.rows=2;text.value=step.text;text.maxLength=16384;text.setAttribute("aria-label",t("typeText"));
                text.oninput=()=>{step.text=text.value;this.preview();};row.append(text);
            }
            const controls=document.createElement("div");controls.className="card-actions";
            for(const [delta,label] of [[-1,"moveUp"],[1,"moveDown"]]){const b=this.button(t(label),()=>{const other=index+delta;[this.draft.keyboard[index],this.draft.keyboard[other]]=[this.draft.keyboard[other],this.draft.keyboard[index]];this.render();});b.disabled=index+delta<0||index+delta>=this.draft.keyboard.length;controls.append(b);}
            controls.append(this.button(t("deleteCard"),()=>{this.draft.keyboard.splice(index,1);this.render();}));row.append(controls);return row;
        }));
        if(this.pending!==null){
            const picker=document.createElement("li");picker.id="key-picker";picker.className="keyboard-step";
            const select=document.createElement("select");select.setAttribute("aria-label",t("chooseKey"));select.add(new Option(t("chooseKey"),""));
            for(const [value,label] of keyChoices)select.add(new Option(label,String(value)));
            const accept=keys=>{const step=this.draft.keyboard[this.pending];if(step?.keys)step.keys=[...new Set([...step.keys,...keys])];else this.draft.keyboard.push({keys});this.pending=null;this.render();};
            select.onchange=()=>{if(select.value)accept([Number(select.value)]);};
            const record=this.button(t("recordChord"),()=>{record.textContent=t("pressChord");record.dataset.recording="true";record.focus();});
            record.addEventListener("keydown",event=>{if(record.dataset.recording!=="true")return;event.preventDefault();event.stopPropagation();if(event.key==="Escape"){this.pending=null;this.render();return;}const keys=eventChord(event);if(keys)accept(keys);});
            picker.append(select,record,this.button(t("cancel"),()=>{this.pending=null;this.render();}));this.list.append(picker);
        }
        this.dialog.querySelector("#keyboard-mode").value=this.draft.action_mode;
        this.dialog.querySelector("#keyboard-interval").value=this.draft.repeat_interval_ms;
        this.dialog.querySelector("#repeat-field").hidden=this.draft.action_mode!=="repeat";
        this.dialog.querySelector("#add-chord").disabled=this.dialog.querySelector("#add-text").disabled=this.draft.keyboard.length>=256;
        this.preview();
        document.dispatchEvent(new Event("keyboard-editor-change"));
    }
}
