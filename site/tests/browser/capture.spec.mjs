import { test, expect } from "@playwright/test";
import { fakeStudioCamera } from "./support/studio-camera.mjs";
import { starter } from "../../studio/src/profile.mjs";
let errors;
test.beforeEach(async({page})=>{errors=[];page.on("pageerror",error=>errors.push(error.message));});
test.afterEach(async()=>{expect(errors).toEqual([]);});

async function openCapture(page,existing=null) {
    await fakeStudioCamera(page);
    await page.goto("./studio/");
    await page.getByRole("button",{name:"EN",exact:true}).click();
    if(existing) {
        await page.locator("#import-file").setInputFiles({name:"existing.json",mimeType:"application/json",buffer:Buffer.from(JSON.stringify(existing))});
        await expect(page.locator("#moves-panel")).toBeVisible();
        await page.locator("#capture-input").click();
    } else await page.locator("#capture-profile").click();
    await expect(page.locator("#capture-dialog")).toBeVisible();
}
async function camera(page) {
    await page.locator("#capture-camera-start").click();
    await expect(page.locator("#capture-record")).toBeEnabled({timeout:15000});
}
async function move(page, reverse=false) {
    await page.evaluate(reverse=>window.studioWristY=reverse?.3:.7,reverse);
    await page.waitForTimeout(250);
    for(let i=1;i<=14;i++) {
        await page.evaluate(({i,reverse})=>window.studioWristY=reverse?.3+i*.4/14:.7-i*.4/14,{i,reverse});
        await page.waitForTimeout(65);
    }
    await page.waitForTimeout(150);
}
async function record(page,{reverse=false,stop="s"}={}) {
    await page.evaluate(reverse=>window.studioWristY=reverse?.3:.7,reverse);
    await page.waitForTimeout(200);
    await expect(page.locator("#capture-record")).toBeEnabled();
    await page.locator("#capture-record").click();
    await expect(page.locator("#capture-countdown")).toHaveText("3");
    await expect(page.locator("#capture-stop")).toBeVisible({timeout:5000});
    await expect(page.locator("#capture-stop")).toBeFocused();
    await move(page,reverse);
    if(stop==="button") await page.locator("#capture-stop").click();
    else if(stop!=="auto") await page.keyboard.press(stop);
    await expect(page.locator("#capture-stop")).toBeHidden({timeout:6000});
}

for(const width of [1280,390]) test(`capture three takes, native-test and assign a key at ${width}px`,async({page},info)=>{
    test.setTimeout(90000);
    await page.setViewportSize({width,height:width===390?740:900});
    const existing=width===1280?starter():null;
    await openCapture(page,existing);
    expect(await page.evaluate(()=>!!window.studioStream)).toBe(false);
    await expect(page.locator("#capture-use")).toBeHidden();
    await camera(page);
    await record(page,{stop:"s"});
    await expect(page.locator("#capture-status")).toContainText("take 2 of 3");
    await record(page,{stop:"Space"});
    await expect(page.locator("#capture-status")).toContainText("take 3 of 3");
    await record(page,{stop:"auto"});
    await expect(page.locator("#capture-legend")).toBeVisible();
    await expect(page.locator("#capture-use")).toBeDisabled();
    await page.waitForTimeout(1300);
    await move(page);
    await expect(page.locator("#capture-status")).toContainText("Movement recognized");
    await expect(page.locator("#capture-use")).toBeEnabled();
    if(width===1280) {
        await page.locator("#capture-preset").selectOption("precise");
        await expect(page.locator("#capture-use")).toBeDisabled();
        await expect(page.locator("#capture-status")).toContainText("repeat the gesture");
        await page.waitForTimeout(1400);await move(page);
        await expect(page.locator("#capture-use")).toBeEnabled();
    }
    expect(await page.evaluate(()=>document.querySelector('#capture-dialog').scrollWidth<=document.querySelector('#capture-dialog').clientWidth)).toBe(true);
    await expect(page.locator("#capture-use")).toBeInViewport();
    await page.screenshot({path:info.outputPath(`capture-${width}.png`),fullPage:true});
    await page.locator("#capture-use").click();
    await expect(page.locator("#keyboard-dialog")).toBeVisible();
    expect(await page.evaluate(()=>window.studioStream.getTracks().every(t=>t.readyState==="ended"))).toBe(true);
    await page.locator("#add-chord").click();
    await page.locator("#keyboard-steps select").selectOption("39");
    await page.locator("#keyboard-save").click();
    await expect(page.locator("#moves-panel")).toBeVisible();
    const profile=await page.evaluate(()=>JSON.parse(localStorage.getItem("mig-studio-profile-v2")));
    expect(profile.inputs).toHaveLength(existing?2:1);
    if(existing) expect(profile.inputs[0]).toEqual(existing.inputs[0]);
    const movement=profile.inputs.at(-1);
    expect(movement.keyboard).toEqual([{keys:[39]}]);
    expect(movement.steps[0].constraints.at(-1).type).toBe("trigger");
    expect(movement.steps[0].constraints.every(c=>c.landmark==="left_wrist")).toBe(true);
    expect(movement.recordings).toBeUndefined();
});

test("a mismatching second take preserves the first and asks for a replacement",async({page})=>{
    test.setTimeout(45000);
    await openCapture(page);await camera(page);await record(page,{stop:"button"});
    await record(page,{reverse:true});
    await expect(page.locator("#capture-error")).toContainText("differs");
    await expect(page.locator("#capture-status")).toContainText("take 2 of 3");
    await record(page);
    await expect(page.locator("#capture-error")).toBeHidden();
    await expect(page.locator("#capture-status")).toContainText("take 3 of 3");
    await page.keyboard.press("Escape");
    await expect(page.locator("#capture-dialog")).toBeHidden();
    expect(await page.evaluate(()=>localStorage.getItem("mig-studio-profile-v2"))).toBeNull();
});

test("lost selected-point tracking fails the take instead of learning missing data",async({page})=>{
    test.setTimeout(20000);
    await openCapture(page);await camera(page);
    await page.locator("#capture-record").click();
    await expect(page.locator("#capture-stop")).toBeVisible({timeout:5000});
    await page.evaluate(()=>window.studioWristVisible=false);
    await page.waitForTimeout(450);
    await page.keyboard.press("Space");
    await expect(page.locator("#capture-error")).toContainText("Tracking was interrupted");
    await expect(page.locator("#capture-record")).toBeDisabled();
    await page.evaluate(()=>window.studioWristVisible=true);
    await expect(page.locator("#capture-record")).toBeEnabled();
    await page.locator("#capture-close").click();
});

test("cancel while camera permission is pending releases a late stream and creates no draft",async({page})=>{
    await openCapture(page);
    await page.evaluate(()=>{
        const original=navigator.mediaDevices.getUserMedia;
        navigator.mediaDevices.getUserMedia=async()=>{
            const stream=await original();
            return new Promise(resolve=>{window.finishCapturePermission=()=>resolve(stream);});
        };
    });
    await page.locator("#capture-camera-start").click();
    await page.waitForFunction(()=>typeof window.finishCapturePermission==="function");
    await page.keyboard.press("Escape");
    await page.evaluate(()=>window.finishCapturePermission());
    await expect.poll(()=>page.evaluate(()=>window.studioStream.getTracks().every(t=>t.readyState==="ended"))).toBe(true);
    await expect(page.locator("#capture-dialog")).toBeHidden();
    expect(await page.evaluate(()=>localStorage.getItem("mig-studio-profile-v2"))).toBeNull();
    await expect(page.locator("#capture-profile")).toBeFocused();
});

test("French instructions and camera denial retain an accessible retry without opening capture",async({page})=>{
    await fakeStudioCamera(page,"Permission denied");await page.goto("./studio/");
    await page.locator("[data-language='fr']").click();await page.locator("#capture-profile").click();
    await expect(page.locator("#capture-title")).toHaveText("Capturer un mouvement");
    await page.locator("#capture-camera-start").click();
    await expect(page.locator("#capture-error")).toContainText("Caméra indisponible");
    await expect(page.locator("#capture-camera-start")).toBeEnabled();
    await expect(page.locator("#capture-stop")).toBeHidden();
    await page.keyboard.press("Escape");
});

test("Escape during the countdown cancels timers, restores focus and keeps an existing draft unchanged",async({page})=>{
    test.setTimeout(15000);
    await openCapture(page,starter());
    const before=await page.evaluate(()=>localStorage.getItem("mig-studio-profile-v2"));
    await camera(page);await page.locator("#capture-record").click();
    await expect(page.locator("#capture-countdown")).toHaveText("3");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(3300);
    await expect(page.locator("#capture-dialog")).toBeHidden();
    await expect(page.locator("#capture-input")).toBeFocused();
    expect(await page.evaluate(()=>window.studioStream.getTracks().every(t=>t.readyState==="ended"))).toBe(true);
    expect(await page.evaluate(()=>localStorage.getItem("mig-studio-profile-v2"))).toBe(before);
});

test("out-of-grid positioning explains why recording is unavailable and recovers without restarting",async({page})=>{
    await openCapture(page);
    await page.evaluate(()=>{window.studioShoulderSpan=.12;window.studioWristX=.99;});
    await page.locator("#capture-camera-start").click();
    await expect(page.locator("#capture-status")).toContainText("outside the usable grid",{timeout:15000});
    await expect(page.locator("#capture-record")).toBeDisabled();
    await page.evaluate(()=>{window.studioWristX=.5;window.studioWristY=.45;});
    await expect(page.locator("#capture-record")).toBeEnabled();
    await page.keyboard.press("Escape");
});
