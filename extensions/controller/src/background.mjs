import {detectSite} from "./sites.mjs";
import {shouldRun} from "./lifecycle.mjs";
const api=globalThis.browser??chrome;
let target=null,originTarget=null,presenting=false,lastSeen=0,port=null,armed=false,mode="manual",manual=false,running=false;
let frame=0;
const ready=api.storage.local.get("settings").then(({settings})=>{mode=settings?.mode==="auto"?"auto":"manual";});
async function icon(on){running=on;await api.action.setIcon({path:{16:`icons/${on?"on":"off"}-16.png`,32:`icons/${on?"on":"off"}-32.png`}});await api.action.setTitle({title:`MIG Controller · ${on?"Camera active":"Camera off"}`});}
async function state(){
    let tab=null;try{if(target!==null)tab=await api.tabs.get(target);}catch{}
    if(tab&&!/^https?:/.test(tab.url??""))tab=null;
    return {tab:tab?{id:tab.id,url:tab.url,title:tab.title,active:tab.active,discarded:tab.discarded}:null,
        site:detectSite(tab?.url),mode,armed,manual,presenting,lastSeen,running,frame,
        shouldRun:shouldRun({armed,mode,manual,tab,presenting,lastSeen},Date.now())};
}
async function notify(){try{port?.postMessage({type:"state",state:await state()});}catch{} }
api.action.onClicked.addListener(async tab=>{
    await ready;target=tab.id;originTarget=tab.id;presenting=false;manual=false;armed=false;lastSeen=0;
    await icon(false);
    try{await api.scripting.executeScript({target:{tabId:tab.id,allFrames:true},files:["content.js"]});}catch{}
    const url=api.runtime.getURL("controller.html");
    const windows=await api.windows.getAll({populate:true});
    const existing=windows.find(win=>win.tabs?.some(tab=>tab.url?.startsWith(url)));
    if(existing)await api.windows.update(existing.id,{focused:true});
    else await api.windows.create({url,type:"popup",width:520,height:780});
    await notify();
});
api.runtime.onConnect.addListener(connection=>{
    if(connection.name!=="controller"||connection.sender?.url!==api.runtime.getURL("controller.html"))return;
    if(port){port.disconnect();armed=false;manual=false;icon(false).catch(()=>{});}
    port=connection;
    connection.onDisconnect.addListener(()=>{if(port===connection){port=null;armed=false;manual=false;icon(false).catch(()=>{});}});
    connection.onMessage.addListener(async message=>{
        if(port!==connection)return;
        await ready;
        try{
            if(message.type==="configure"){
                mode=message.mode==="auto"?"auto":"manual";armed=message.armed===true;manual=message.manual===true;
                await api.storage.local.set({settings:{mode}});
                // Request a fresh page observation before automatic camera activation.
                if(target!==null)try{await api.tabs.sendMessage(target,{type:"observe"});}catch{}
            }else if(message.type==="target"){
                if(message.tabId===null){target=null;originTarget=null;presenting=false;armed=false;manual=false;await icon(false);await notify();return;}
                const tab=await api.tabs.get(message.tabId);
                if(!/^https?:/.test(tab.url??""))throw new Error("Choose an accessible web tab");
                target=tab.id;originTarget=tab.id;presenting=false;manual=false;armed=false;lastSeen=0;frame=0;await icon(false);
                await api.scripting.executeScript({target:{tabId:tab.id,allFrames:true},files:["content.js"]});
            }else if(message.type==="camera"){
                await icon(message.running===true&&(await state()).shouldRun);
            }else if(message.type==="command"){
                const current=await state();
                if(current.shouldRun&&running&&message.commands?.length<=16)
                    {const result=await api.tabs.sendMessage(target,{type:"keys",commands:message.commands},{frameId:frame});
                        if(!result?.ok)connection.postMessage({type:"error",message:result?.reason??"Command unavailable"});}
            }else if(message.type==="poll"){
                if(running&&!(await state()).shouldRun)await icon(false);
            }
        }catch(error){try{connection.postMessage({type:"error",message:error.message});}catch{}}
        await notify();
    });
    ready.then(notify);
});
api.runtime.onMessage.addListener((message,sender,respond)=>{
    if(message?.type!=="presence"||!sender.tab||sender.id!==api.runtime.id)return;
    if(sender.tab.id!==target)return;
    // A cross-origin frame may be PowerPoint's viewer; it must be a supported host.
    if(!detectSite(sender.url))return;
    if(mode==="manual"&&message.focused===true)frame=sender.frameId??0;
    if(message.presenting===true){presenting=true;frame=sender.frameId??0;lastSeen=Date.now();}
    else if((sender.frameId??0)===frame){presenting=false;lastSeen=Date.now();}
    notify();respond({ok:true});
});
api.tabs.onRemoved.addListener(tabId=>{if(tabId===target){
    const returnToEditor=mode==="auto"&&originTarget!==target;
    target=returnToEditor?originTarget:null;presenting=false;lastSeen=0;if(!returnToEditor)armed=false;
    icon(false).catch(()=>{});notify();
}});
api.tabs.onUpdated.addListener(async(tabId,change,tab)=>{
    await ready;
    // Slides and other editors can open the show in a child tab/window. Follow
    // only the selected editor's same-site children, never unrelated tabs.
    if(mode==="auto"&&armed&&tab.openerTabId===originTarget&&tab.active&&detectSite(tab.url)){
        let parent;try{parent=await api.tabs.get(originTarget);}catch{}
        if(detectSite(parent?.url)?.id===detectSite(tab.url)?.id&&target!==tabId){
            target=tabId;frame=0;presenting=false;lastSeen=0;
            try{await api.tabs.sendMessage(tabId,{type:"observe"});}catch{}
        }
    }
    if(tabId===target&&change.status==="loading"){presenting=false;lastSeen=0;icon(false).catch(()=>{});}
    if(tabId===target)notify();
});
api.tabs.onActivated.addListener(()=>notify());
api.runtime.onStartup.addListener(()=>icon(false));
api.runtime.onInstalled.addListener(()=>icon(false));
