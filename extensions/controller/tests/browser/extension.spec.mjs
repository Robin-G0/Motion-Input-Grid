import {test,expect,chromium} from "@playwright/test";
import {resolve,sep} from "node:path";
import {mkdtemp,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
let context,root,id,worker;
test.beforeAll(async()=>{
    root=await mkdtemp(resolve(tmpdir(),"mig-extension-"));
    context=await chromium.launchPersistentContext(root,{channel:"chromium",headless:true,ignoreDefaultArgs:["--disable-extensions"],args:["--enable-unsafe-extension-debugging","--use-fake-ui-for-media-stream","--use-fake-device-for-media-stream"]});
    const cdp=await context.browser().newBrowserCDPSession();
    ({id}=await cdp.send("Extensions.loadUnpacked",{path:resolve("dist/chromium")}));
    worker=context.serviceWorkers()[0]??await context.waitForEvent("serviceworker");
});
test("real packaged models start and stop a camera under extension CSP",async()=>{
    await context.route("https://www.canva.com/**",route=>route.fulfill({contentType:"text/html",body:'<html><title>Deck fixture</title><body><h1>Presentation</h1><p id="count">0</p><script>let n=0;addEventListener("keydown",e=>{if(e.key==="ArrowRight")document.querySelector("#count").textContent=++n;});</script></body></html>'}));
    const deck=await context.newPage();await deck.goto("https://www.canva.com/design/fixture/edit");
    const opened=context.waitForEvent("page");
    await worker.evaluate(url=>chrome.windows.create({url,type:"popup",width:520,height:780}),`chrome-extension://${id}/controller.html`);
    const page=await opened;
    await expect(page.locator(".command")).toHaveCount(2);
    await page.locator("#target-tab").selectOption({label:"Deck fixture"});
    await expect(page.locator("#target")).toContainText("Canva");
    await page.locator("#start").click();
    await expect(page.locator("#camera-dot")).toHaveAttribute("data-active","true",{timeout:25000});
    await expect.poll(()=>worker.evaluate(()=>chrome.action.getTitle({}))).toContain("Camera active");
    await page.locator("#stop").click();
    await expect(page.locator("#camera-dot")).toHaveAttribute("data-active","false");
    await expect.poll(()=>worker.evaluate(()=>chrome.action.getTitle({}))).toContain("Camera off");
    await page.close();await deck.close();
});
test("key rebinding, safe import and blocked Windows shortcuts retain the previous profile",async()=>{
    const page=await context.newPage();await page.goto(`chrome-extension://${id}/controller.html`);
    await expect(page.locator(".command")).toHaveCount(2);
    await page.locator(".command button").first().click();await page.keyboard.press("Space");
    await expect(page.locator("#key-dialog")).not.toBeVisible();
    await expect(page.locator(".command small").first()).toHaveText("Space");
    await page.locator("#preset").selectOption("reverse");
    await expect(page.locator(".command small").first()).toHaveText("ArrowLeft");
    await page.locator("#preset").selectOption("normal");
    await expect(page.locator(".command small").first()).toHaveText("Space");
    const {presetProfile}=await import("../../src/presets.mjs");const profile=presetProfile();profile.inputs[0].name="Custom next";profile.inputs[0].keyboard=[{keys:[65]}];
    const file=value=>({name:"profile.json",mimeType:"application/json",buffer:Buffer.from(JSON.stringify(value))});
    await page.locator("#import").setInputFiles(file(profile));
    await expect(page.locator(".command strong").first()).toHaveText("Custom next");
    await expect(page.locator(".command small").first()).toHaveText("A");
    profile.inputs[0].keyboard=[{keys:[91,82]}];await page.locator("#import").setInputFiles(file(profile));
    await expect(page.locator("#message")).toHaveAttribute("data-error","true");
    await expect(page.locator(".command small").first()).toHaveText("A");
    await page.close();
});
test.afterAll(async()=>{await context?.close();if(root){expect(root.startsWith(resolve(tmpdir())+sep)).toBe(true);await rm(root,{recursive:true,force:true});}});
test.beforeEach(async()=>{await worker.evaluate(()=>chrome.storage.local.clear());});
async function openRemote(url="https://www.canva.com/design/fixture/edit"){
    await context.route(new URL(url).origin+"/**",route=>route.fulfill({contentType:"text/html",body:'<html><title>Remote fixture</title><body><h1>Presentation</h1><input aria-label="Notes"><p id="count">0</p><script>let n=0;addEventListener("keydown",e=>{if(e.key==="ArrowRight")document.querySelector("#count").textContent=++n;});</script></body></html>'}));
    const deck=await context.newPage();await deck.goto(url);
    const opened=context.waitForEvent("page");await worker.evaluate(url=>chrome.windows.create({url,type:"popup",width:520,height:780}),`chrome-extension://${id}/controller.html`);
    const page=await opened;await expect(page.locator(".command")).toHaveCount(2);
    await page.locator("#target-tab").selectOption({label:"Remote fixture"});
    await page.locator("#mode").selectOption("manual");
    await expect(page.locator("#start")).toHaveText(/^(Start|Démarrer)$/);
    // Replace inference only; retain the installed extension, media stream, native
    // WASM recognition, messaging, permissions and page event dispatch.
    await page.evaluate(async()=>{
        window.wrist=.2;
        const {MIGSession}=await import("./mig/session.mjs");const start=MIGSession.prototype.start;
        MIGSession.prototype.start=function(...args){
            this.dependencies.loadModels=async()=>({pose:{close(){},detectForVideo(){
                const points=Array.from({length:33},()=>({x:0,y:0,visibility:0}));
                points[11]={x:.65,y:.45,visibility:1};points[12]={x:.35,y:.45,visibility:1};points[16]={x:window.wrist,y:.6,visibility:1};
                return {landmarks:[points],worldLandmarks:[]};}},hands:{close(){},detectForVideo(){return {landmarks:[],handedness:[]};}}});
            return start.apply(this,args);
        };
    });
    return {page,deck};
}
async function sweep(page){for(let i=0;i<=18;i++){await page.evaluate(x=>window.wrist=x,.2+i*.6/18);await page.waitForTimeout(60);}}
test("a real WASM gesture emits one page key and typing in notes is protected",async()=>{
    const {page,deck}=await openRemote();await page.locator("#start").click();
    await expect(page.locator("#camera-dot")).toHaveAttribute("data-active","true");await page.waitForTimeout(1800);
    const windowId=await page.evaluate(async()=> (await chrome.windows.getCurrent()).id);
    await worker.evaluate(id=>chrome.windows.update(id,{state:"minimized"}),windowId);
    await sweep(page);await expect(deck.locator("#count")).toHaveText("1");await page.waitForTimeout(500);await expect(deck.locator("#count")).toHaveText("1");
    await worker.evaluate(id=>chrome.windows.update(id,{state:"normal"}),windowId);
    await deck.locator("input").focus();await page.evaluate(()=>window.wrist=.2);await page.waitForTimeout(400);await sweep(page);
    await expect(deck.locator("#count")).toHaveText("1");
    await page.close();await expect.poll(()=>worker.evaluate(()=>chrome.action.getTitle({}))).toContain("Camera off");await deck.close();
});
test("automatic camera follows presentation start, exit, return and tab closure",async()=>{
    const {page,deck}=await openRemote("https://gamma.app/docs/fixture");
    await page.locator("#mode").selectOption("auto");await page.locator("#start").click();
    await page.waitForTimeout(1200);await expect(page.locator("#camera-dot")).toHaveAttribute("data-active","false");
    await deck.evaluate(()=>history.replaceState({},"","?mode=present"));
    await expect(page.locator("#camera-dot")).toHaveAttribute("data-active","true",{timeout:5000});
    await deck.evaluate(()=>history.replaceState({},"","/docs/fixture"));
    await expect(page.locator("#camera-dot")).toHaveAttribute("data-active","false",{timeout:5000});
    expect(await page.locator("#video").evaluate(video=>video.srcObject)).toBeNull();
    await deck.evaluate(()=>history.replaceState({},"","?mode=present"));
    await expect(page.locator("#camera-dot")).toHaveAttribute("data-active","true",{timeout:5000});
    await deck.close();await expect(page.locator("#camera-dot")).toHaveAttribute("data-active","false");
    await page.close();
});
test("automatic mode follows the selected Slides editor's presentation window",async()=>{
    const {page,deck}=await openRemote("https://docs.google.com/presentation/d/fixture/edit");
    await page.locator("#mode").selectOption("auto");await page.locator("#start").click();
    const opened=context.waitForEvent("page");
    await deck.evaluate(()=>window.open("https://docs.google.com/presentation/d/fixture/present","_blank","width=800,height=600"));
    const show=await opened;await show.waitForLoadState();
    await expect(page.locator("#camera-dot")).toHaveAttribute("data-active","true",{timeout:5000});
    await show.close();await expect(page.locator("#camera-dot")).toHaveAttribute("data-active","false");
    await page.close();await deck.close();
});
test("denied camera access restores a retry and keeps the toolbar inactive",async()=>{
    const {page,deck}=await openRemote();
    await page.evaluate(()=>navigator.mediaDevices.getUserMedia=async()=>{throw new Error("Permission denied");});
    await page.locator("#start").click();
    await expect(page.locator("#message")).toHaveAttribute("data-error","true");
    await expect(page.locator("#start")).toBeEnabled();
    await expect(page.locator("#camera-dot")).toHaveAttribute("data-active","false");
    await page.close();await deck.close();
});
test("Stop during pending permission releases a late stream without reactivating",async()=>{
    const {page,deck}=await openRemote();
    await page.evaluate(()=>{const original=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);navigator.mediaDevices.getUserMedia=()=>new Promise(resolve=>{window.release=async()=>{window.lateStream=await original({video:true});resolve(window.lateStream);};});});
    await page.locator("#start").click();
    await expect.poll(()=>page.evaluate(()=>typeof window.release)).toBe("function");
    await page.locator("#stop").click();await page.evaluate(()=>window.release());
    await expect.poll(()=>page.evaluate(()=>window.lateStream.getTracks().every(track=>track.readyState==="ended"))).toBe(true);
    await expect(page.locator("#camera-dot")).toHaveAttribute("data-active","false");
    await page.close();await deck.close();
});
test("packaged runtime validates presets inside the actual extension CSP",async()=>{
    const page=await context.newPage();const errors=[];page.on("pageerror",e=>errors.push(e.message));
    await page.goto(`chrome-extension://${id}/controller.html`);
    await expect(page.locator(".command")).toHaveCount(2);
    expect(errors).toEqual([]);await page.close();
});
test("controller fits a narrow window, translates controls and retains keyboard focus during polling",async({},info)=>{
    const page=await context.newPage();await page.goto(`chrome-extension://${id}/controller.html`);
    await page.setViewportSize({width:360,height:740});await page.emulateMedia({reducedMotion:"reduce"});
    await expect(page.locator(".command")).toHaveCount(2);
    const change=page.locator(".command button").first();await change.focus();await page.waitForTimeout(1400);await expect(change).toBeFocused();
    await page.locator("#language").click();await expect(page.locator("html")).toHaveAttribute("lang","fr");
    await expect(page.locator("#camera-title")).toHaveText("Caméra et présentation");
    await expect(page.locator(".command strong").first()).toHaveText("Main droite : droite → gauche");
    await expect(page.locator("#target-tab option").first()).toHaveText("Choisir un onglet");
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.evaluate(()=>scrollTo(0,0));
    await page.screenshot({path:info.outputPath("controller-360.png"),fullPage:true});
    await page.close();
});
