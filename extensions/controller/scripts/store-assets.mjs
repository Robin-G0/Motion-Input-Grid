import {readFile,mkdir,cp} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import {join} from "node:path";
import {chromium} from "playwright";

// Render the repository-native SVG, not a screenshot of an application or service.
const root=fileURLToPath(new URL("../",import.meta.url));
const out=join(root,"dist/store-assets");
await mkdir(out,{recursive:true});
for(const size of [64,96,128])await cp(join(root,`dist/chromium/icons/off-${size}.png`),join(out,`icon-${size}.png`));
const svg=await readFile(join(root,"store/assets/promo-440x280.svg"),"utf8");
await cp(join(root,"store/assets/promo-440x280.svg"),join(out,"promo-440x280.svg"));
let browser;
try{
    try{browser=await chromium.launch({headless:true});}
    catch{browser=await chromium.launch({channel:"msedge",headless:true});}
    const page=await browser.newPage({viewport:{width:440,height:280},deviceScaleFactor:1});
    await page.setContent(`<html><body style="margin:0">${svg}</body></html>`);
    await page.locator("svg").screenshot({path:join(out,"promo-440x280.png"),omitBackground:false});
}finally{await browser?.close();}
console.log("Store icons and vector promotional artwork prepared; no product screenshots generated.");
