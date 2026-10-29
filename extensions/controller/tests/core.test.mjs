import {test} from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {keySpec,eventKeys,profileBindings} from "../src/keys.mjs";
import {detectSite} from "../src/sites.mjs";
import {presetProfile} from "../src/presets.mjs";
import {shouldRun} from "../src/lifecycle.mjs";
import {MIGTracker} from "../dist/chromium/mig/mig-tracker.mjs";

test("browser key allowlist rejects OS shortcuts, navigation and text macros before import",()=>{
    for(const keys of [[91,82],[18,115],[17,82],[116],[122],[123],[17,16,73],[58],[17,9],[],[37,39],["39"]])assert.throws(()=>keySpec(keys),String(keys));
    for(const keys of [[39],[16,37],[17,67],[65],[32]])assert.ok(keySpec(keys));
    assert.deepEqual(eventKeys({key:"ArrowRight",shiftKey:true}),[16,39]);
    assert.throws(()=>eventKeys({key:"r",metaKey:true}));
    const profile=presetProfile();profile.inputs[0].keyboard=[{text:"run this"}];assert.throws(()=>profileBindings(profile));
    const nul=presetProfile();nul.inputs[0].id="next\0tail";assert.throws(()=>profileBindings(nul));
});
test("custom profiles retain names and sequential browser keys and reject repeat/hold",()=>{
    const profile=presetProfile();profile.inputs[0].name="Next <img src=x>";profile.inputs[0].keyboard=[{keys:[39]},{keys:[65]}];
    assert.deepEqual(profileBindings(profile)[0].keys,[[39],[65]]);
    profile.inputs[0].action_mode="repeat";assert.throws(()=>profileBindings(profile));
});
test("known domains are matched on host boundaries, and generic defaults remain arrows",()=>{
    for(const [url,id] of [["https://www.canva.com/design/1/edit","canva"],["https://gamma.app/docs/x?mode=present","gamma"],["https://docs.google.com/presentation/d/1/present","slides"],["https://powerpoint.officeapps.live.com/p/PowerPointFrame.aspx","powerpoint"]])assert.equal(detectSite(url)?.id,id);
    for(const url of ["https://canva.com.evil.example/design/a","https://docs.google.com/document/d/x","file:///test","javascript:alert(1)","https://word-edit.officeapps.live.com/we/wordeditorframe.aspx","https://tenant.sharepoint.com/sites/finance/lists/allitems.aspx"])assert.equal(detectSite(url),null);
    assert.equal(detectSite("https://tenant.sharepoint.com/_layouts/15/Doc.aspx?file=deck.pptx")?.id,"powerpoint");
    assert.deepEqual(presetProfile().inputs.map(i=>i.keyboard),[[{keys:[39]}],[{keys:[37]}]]);
    assert.deepEqual(presetProfile(true).inputs.map(i=>i.keyboard),[[{keys:[37]}],[{keys:[39]}]]);
});
test("automatic mode requires arming, a fresh presentation observation and the targeted active tab",()=>{
    const state={armed:true,mode:"auto",manual:false,tab:{id:1,url:"https://gamma.app/docs/x",active:true},presenting:true,lastSeen:100};
    assert.equal(shouldRun(state,1000),true);
    for(const patch of [{armed:false},{presenting:false},{lastSeen:-5000},{tab:null},{tab:{...state.tab,active:false}},{tab:{...state.tab,url:"chrome://settings"}}])assert.equal(shouldRun({...state,...patch},1000),false);
    assert.equal(shouldRun({...state,mode:"manual",manual:true,presenting:false},1000),true);
});
test("packaged runtime has no eval factories; WASM bytes match the pinned SDK",async()=>{
    const glue=await readFile(new URL("../dist/chromium/mig/mig.mjs",import.meta.url),"utf8");
    assert.doesNotMatch(glue,/new Function\b|\beval\s*\(/);
    assert.deepEqual(await readFile(new URL("../dist/chromium/mig/mig.wasm",import.meta.url)),await readFile(new URL("../node_modules/motion-input-grid/runtime/mig.wasm",import.meta.url)));
    const tracker=await MIGTracker.create(JSON.stringify(presetProfile()));
    try{assert.equal(JSON.parse(tracker.exportJSON()).inputs.length,2);assert.equal(tracker.coordinate(11),null);assert.throws(()=>tracker.importJSON('{"schema_version":0}'));}finally{tracker.dispose();}
});
test("store packages restrict permissions and use platform-specific MV3 backgrounds",async()=>{
    for(const platform of ["chromium","firefox"]){
        const manifest=JSON.parse(await readFile(new URL(`../dist/${platform}/manifest.json`,import.meta.url),"utf8"));
        assert.equal(manifest.manifest_version,3);assert.deepEqual(manifest.permissions,["storage","activeTab","scripting"]);
        assert.equal(manifest.optional_host_permissions,undefined);assert.ok(manifest.host_permissions.every(host=>host.startsWith("https://")));
        assert.doesNotMatch(manifest.content_security_policy.extension_pages,/'unsafe-eval'|https?:|blob:/);
        assert.equal(!!manifest.background.service_worker,platform==="chromium");assert.equal(!!manifest.background.scripts,platform==="firefox");
    }
});
test("real WASM recognizes physical right-to-left swipes once, rejects reversed and conversational motions",async()=>{
    for(const motion of ["sweep","reverse","talk","other"]){
        const tracker=await MIGTracker.create(JSON.stringify(presetProfile()));let time=0,seq=0;const actions=[];
        const frame=x=>{
            const buffer=tracker.native.bodyBuffer();buffer.fill(0);
            const point=(i,x,y)=>buffer.set([x,y,0,1,0,0,0,0],i*8);
            point(11,.65,.45);point(12,.35,.45);point(motion==="other"?15:16,x,.6);
            const count=tracker.native.update(time+=40,++seq,1,0,0);
            for(let i=0;i<count;i++)actions.push(tracker.native.eventAction(i));
        };
        try{
            for(let i=0;i<40;i++)frame(motion==="reverse"?.8:.2);
            for(let i=0;i<=25;i++)frame(motion==="talk"?.48+Math.sin(i)*.04:motion==="reverse"?.8-i*.6/25:.2+i*.6/25);
            for(let i=0;i<30;i++)frame(motion==="reverse"?.2:motion==="talk"?.5:.8);
            assert.deepEqual(actions,motion==="sweep"?["next"]:[],motion);
        }finally{tracker.dispose();}
    }
});
