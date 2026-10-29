import {MIGSession} from "./mig/session.mjs";
import {MIGTracker} from "./mig/mig-tracker.mjs";
import {presetProfile} from "./presets.mjs";
import {profileBindings,eventKeys,keyLabel} from "./keys.mjs";
import {copy} from "./copy.mjs";
const api=globalThis.browser??chrome,$=id=>document.getElementById(id);
let language=navigator.language.startsWith("fr")?"fr":"en",kind="normal",overrides={},custom=null,profile,bindings=[],current=null,site=null,pending=null,busy=false,disposed=false,starting=false,connected=true;
let keymaps={};
let commandSignature="";
const port=api.runtime.connect({name:"controller"});
const t=key=>copy[language][key]??key;
function message(text,error=false){if($("message").textContent!==text)$("message").textContent=text;$("message").dataset.error=String(error);}
function send(message){if(!connected)return;try{port.postMessage(message);}catch{connected=false;session.stop();}}
class CameraSession extends MIGSession{
    tick(run){
        this.clock?.terminate();this.clock=new Worker(api.runtime.getURL("camera-clock.js"));
        this.clock.onmessage=()=>{
            if(!this.stream||run!==this.generation||this.disposed)return;
            try{if(this.video.readyState>=2&&this.video.currentTime!==this.lastVideoTime)this.processFrame();}
            catch(error){this.stop();this.publish({status:error.message});}
        };
        this.clock.onerror=()=>{this.stop();message(t("denied"),true);};
    }
    stop(){this.clock?.terminate();this.clock=null;super.stop();}
}
const session=new CameraSession({assetBase:api.runtime.getURL("mig/"),profileMode:true,
    onAction:event=>{const binding=bindings.find(item=>item.id===event.id);if(binding&&current?.shouldRun)send({type:"command",commands:binding.keys});},
    onFrame:()=>{if(session.state.running)message(t(session.coordinate(11)?.confidence>.6&&session.coordinate(12)?.confidence>.6?"active":"missing"));}});
session.subscribe(state=>{
    $("camera-dot").dataset.active=String(state.running);$("camera-empty").hidden=state.running;
    $("calibrate").disabled=!state.running;send({type:"camera",running:state.running});
});
const mapKey=()=>`${site?.id??"generic"}:${kind}`;
function save(){return api.storage.local.set({controller:{kind,keymaps,custom,language}});}
function render(){
    document.documentElement.lang=language;$("language").textContent=language==="fr"?"EN":"FR";
    for(const node of document.querySelectorAll("[data-copy]"))node.textContent=t(node.dataset.copy);
    $("mode-hint").textContent=t(current?.mode==="auto"?"autoHint":"manualHint");
    $("mode").value=current?.mode??"manual";$("start").textContent=t(current?.mode==="auto"?"arm":"start");
    $("start").disabled=busy||!current?.tab||current.armed;$("stop").disabled=!current?.armed&&!session.state.running;
    $("preset").value=kind;$("preset").querySelector('[value="custom"]').disabled=!custom;
    $("preset").disabled=busy;$("import").disabled=busy;
    $("target").textContent=current?.tab?`${site?.name??t("generic")} · ${new URL(current.tab.url??"https://invalid").hostname}`:t("noTarget");
    const signature=JSON.stringify([language,kind,bindings,busy]);
    if(signature!==commandSignature){commandSignature=signature;$("commands").replaceChildren(...bindings.map(binding=>{
        const article=document.createElement("article");article.className="command";
        const title=document.createElement("div"),strong=document.createElement("strong"),small=document.createElement("small");
        strong.textContent=kind==="custom"?binding.name:t(binding.id==="right_sweep"?"right":"left");
        small.textContent=binding.keys.map(keyLabel).join(" → ");title.append(strong,small);
        const button=document.createElement("button");button.type="button";button.textContent=`${t("change")} · ${small.textContent}`;
        button.setAttribute("aria-label",`${t("change")} : ${strong.textContent}`);button.disabled=busy;
        button.onclick=()=>{pending=binding.id;$("key-error").textContent="";$("key-dialog").showModal();$("key-dialog").focus();};
        article.append(title,button);
        if(kind!=="custom"){
            const picture=document.createElementNS("http://www.w3.org/2000/svg","svg");picture.setAttribute("viewBox","0 0 300 66");picture.setAttribute("role","img");picture.setAttribute("aria-label",strong.textContent);picture.classList.add("motion");
            if(binding.id==="left_sweep")picture.classList.add("reverse");
            picture.innerHTML='<rect x="28" y="12" width="60" height="42" rx="8" fill="#e2bb6977"/><rect x="212" y="12" width="60" height="42" rx="8" fill="#8dcdb777"/><path d="M70 33H240" stroke="currentColor" stroke-width="2" stroke-dasharray="5 5"/><circle cx="150" cy="17" r="10" fill="currentColor"/><path d="M150 28v28m-24-17h48" stroke="currentColor" stroke-width="5"/><g class="hand"><circle cx="230" cy="33" r="10" fill="#c65b48"/><path d="M240 33h-15l5-5m-5 5 5 5" stroke="white" fill="none" stroke-width="2"/></g>';
            article.append(picture);
        }
        return article;
    }));}
}
async function apply(){
    if(busy)return;busy=true;session.stop();render();
    try{
        const candidate=kind==="custom"?structuredClone(custom):presetProfile(kind==="reverse",site,overrides);
        const candidateBindings=profileBindings(candidate);
        await session.importJSON(JSON.stringify(candidate));profile=candidate;bindings=candidateBindings;await save();
    }finally{busy=false;render();}
}
async function reconcile(){
    if(disposed||busy||starting)return;
    if(current?.shouldRun&&!session.state.running){
        starting=true;message(t("loading"));
        try{await session.start($("video"),$("overlay"));
            if(!current?.shouldRun)session.stop();
            else if(!session.state.running){send({type:"configure",mode:current.mode,armed:false,manual:false});message(t("denied"),true);}
            else for(const track of session.stream?.getTracks()??[])track.addEventListener("ended",()=>{session.stop();send({type:"configure",mode:current.mode,armed:false,manual:false});},{once:true});
        }finally{starting=false;}
    }else if(!current?.shouldRun){
        if(session.state.running||session.state.busy)session.stop();
        if(current?.armed)message(t("waiting"));
    }
}
const loaded=api.storage.local.get("controller").then(async stored=>{
    const settings=stored.controller;
    if(settings){language=settings.language==="fr"?"fr":"en";kind=["normal","reverse","custom"].includes(settings.kind)?settings.kind:"normal";keymaps=settings.keymaps??{};overrides=keymaps[mapKey()]??{};custom=settings.custom??null;}
    try{await apply();message(t("ready"));}catch(error){kind="normal";keymaps={};overrides={};custom=null;await apply();message(error.message,true);}
});
async function tabs(){
    const items=(await api.tabs.query({})).filter(tab=>/^https?:/.test(tab.url??""));
    $("target-tab").replaceChildren(new Option(t("chooseTab"),""),...items.map(tab=>new Option(tab.title||new URL(tab.url).hostname,String(tab.id))));
    $("target-tab").value=String(current?.tab?.id??"");
}
$("target-tab").onfocus=tabs;
$("target-tab").onchange=()=>{session.stop();send({type:"target",tabId:$("target-tab").value?Number($("target-tab").value):null});};
port.onMessage.addListener(async event=>{
    await loaded;
    if(event.type==="error"){message(event.message,true);return;}
    if(event.type!=="state")return;
    const changed=site?.id!==event.state.site?.id;
    current=event.state;site=current.site;
    if(changed&&kind!=="custom"){overrides=keymaps[mapKey()]??{};await apply();}
    render();if(!$("target-tab").options.length||current.tab&&!Array.from($("target-tab").options).some(option=>option.value===String(current.tab.id)))await tabs();$("target-tab").value=String(current.tab?.id??"");await reconcile();
});
port.onDisconnect.addListener(()=>{connected=false;session.stop();message(t("noTarget"),true);});
$("start").onclick=()=>{message(t("loading"));send({type:"configure",mode:$("mode").value,armed:true,manual:$("mode").value==="manual"});};
$("stop").onclick=()=>{session.stop();send({type:"configure",mode:$("mode").value,armed:false,manual:false});message(t("stopped"));};
$("mode").onchange=()=>{session.stop();send({type:"configure",mode:$("mode").value,armed:false,manual:false});};
$("calibrate").onclick=()=>session.recalibrate();
$("language").onclick=async()=>{language=language==="fr"?"en":"fr";render();await tabs();save();if(!session.state.running&&$("message").dataset.error!=="true")message(t(current?.armed?"waiting":"ready"));};
$("preset").onchange=async()=>{kind=$("preset").value;overrides=keymaps[mapKey()]??{};try{await apply();}catch(error){message(error.message,true);}};
$("cancel-key").onclick=()=>$("key-dialog").close();
$("key-dialog").addEventListener("keydown",async event=>{
    if(event.key==="Escape"){pending=null;return;}
    if(event.target.closest("button"))return;
    event.preventDefault();if(event.repeat)return;
    try{const keys=eventKeys(event);if(!keys||!pending)return;
        if(kind==="custom")custom.inputs.find(item=>item.id===pending).keyboard=[{keys}];else{overrides={...overrides,[pending]:keys};keymaps[mapKey()]=overrides;}
        $("key-dialog").close();pending=null;await apply();message(t("bound"));
    }catch(error){$("key-error").textContent=error.message;}
});
$("key-dialog").addEventListener("close",()=>{pending=null;});
$("import").onchange=async event=>{
    const file=event.target.files[0];event.target.value="";if(!file)return;
    if(busy)return;busy=true;render();session.stop();
    try{
        if(file.size>1024*1024)throw new Error("Maximum profile size: 1 MiB");
        const candidate=JSON.parse(await file.text());profileBindings(candidate);
        const validator=await MIGTracker.create(JSON.stringify(candidate));validator.dispose();
        custom=candidate;kind="custom";busy=false;await apply();message(t("imported"));
    }catch(error){message(error.message,true);}finally{busy=false;render();}
};
const timer=setInterval(()=>send({type:"poll"}),1000);
addEventListener("pagehide",()=>{disposed=true;clearInterval(timer);session.dispose();port.disconnect();});
