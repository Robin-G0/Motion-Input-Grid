import {cp,mkdir,readFile,writeFile,rm} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import {resolve,join} from "node:path";
import {deflateSync} from "node:zlib";
import {cspRuntime} from "./csp-runtime.mjs";
const root=fileURLToPath(new URL("../",import.meta.url)),dist=join(root,"dist");
if (resolve(dist)!==resolve(root,"dist")) throw new Error("Unexpected output path");
await rm(dist,{recursive:true,force:true});
const {version}=JSON.parse(await readFile(join(root,"package.json"),"utf8"));
const matches=["https://*.canva.com/*","https://gamma.app/*","https://*.gamma.app/*","https://docs.google.com/presentation/*","https://*.officeapps.live.com/*","https://*.sharepoint.com/*","https://powerpoint.office.com/*","https://powerpoint.cloud.microsoft/*","https://onedrive.live.com/*"];
for (const platform of ["chromium","firefox"]) {
    const out=join(dist,platform);await mkdir(out,{recursive:true});
    await cp(join(root,"src"),out,{recursive:true});
    await cp(join(root,"node_modules/motion-input-grid/runtime"),join(out,"mig"),{recursive:true});
    await cp(join(root,"node_modules/motion-input-grid/LICENSE"),join(out,"mig/LICENSE"));
    await writeFile(join(out,"mig/mig.mjs"),cspRuntime(await readFile(join(out,"mig/mig.mjs"),"utf8")));
    const manifest={manifest_version:3,name:"MIG Controller",version,description:"Control presentations with deliberate hand movements. Camera processing stays on your device.",
        permissions:["storage","activeTab","scripting"],host_permissions:matches,
        action:{default_title:"MIG Controller · Camera off",default_icon:{16:"icons/off-16.png",32:"icons/off-32.png"}},
        icons:{48:"icons/off-48.png",128:"icons/off-128.png"},
        background:platform==="chromium"?{service_worker:"background.mjs",type:"module"}:{scripts:["background.mjs"],type:"module"},
        content_scripts:[{matches,js:["content.js"],all_frames:true}],
        content_security_policy:{extension_pages:"script-src 'self' 'wasm-unsafe-eval'; object-src 'self'; worker-src 'self';"}};
    if(platform==="firefox")manifest.browser_specific_settings={gecko:{id:"mig-controller@motion-input-grid.org",strict_min_version:"142.0",data_collection_permissions:{required:["none"]}}};
    else manifest.minimum_chrome_version="121";
    await writeFile(join(out,"manifest.json"),JSON.stringify(manifest,null,2)+"\n");
    await mkdir(join(out,"icons"),{recursive:true});
    for(const size of [16,32,48,128])for(const on of [false,true])await writeFile(join(out,`icons/${on?"on":"off"}-${size}.png`),icon(size,on));
}
function crc(data){let c=0xffffffff;for(const value of data){c^=value;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0);}return (c^0xffffffff)>>>0;}
function chunk(type,data){const name=Buffer.from(type),head=Buffer.alloc(4),tail=Buffer.alloc(4);head.writeUInt32BE(data.length);tail.writeUInt32BE(crc(Buffer.concat([name,data])));return Buffer.concat([head,name,data,tail]);}
function icon(size,on){const rgba=Buffer.alloc((size*4+1)*size);for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const inside=on?Math.hypot(x-size/2+.5,y-size/2+.5)<size*.39:x>size*.16&&x<size*.84&&y>size*.16&&y<size*.84;
    const offset=y*(size*4+1)+1+x*4;rgba.set(on?[211,39,54,inside?255:0]:[115,122,132,inside?255:0],offset);
}const header=Buffer.alloc(13);header.writeUInt32BE(size);header.writeUInt32BE(size,4);header[8]=8;header[9]=6;
return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk("IHDR",header),chunk("IDAT",deflateSync(rgba)),chunk("IEND",Buffer.alloc(0))]);}
console.log("Built self-contained Chromium and Firefox extensions in dist/");
