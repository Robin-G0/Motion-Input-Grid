import {cp,mkdtemp,readFile,writeFile,rm} from "node:fs/promises";
import {createServer} from "node:http";
import {resolve,sep,join} from "node:path";
import {tmpdir} from "node:os";
import {firefox} from "playwright";
import webExt from "web-ext";
const directory=await mkdtemp(join(tmpdir(),"mig-firefox-test-"));
let runner,server,timer;
try{
    await cp(resolve("dist/firefox"),directory,{recursive:true});
    let complete;
    const result=new Promise((accept,reject)=>{complete=accept;timer=setTimeout(()=>reject(new Error("Firefox extension smoke test timed out")),45000);});
    server=createServer((request,response)=>{let body="";request.on("data",chunk=>body+=chunk);request.on("end",()=>{response.writeHead(200,{"Access-Control-Allow-Origin":"*"});response.end("ok");if(request.method==="POST")complete(JSON.parse(body));});});
    await new Promise(accept=>server.listen(0,"127.0.0.1",accept));
    const endpoint=`http://127.0.0.1:${server.address().port}`;
    const manifest=JSON.parse(await readFile(join(directory,"manifest.json"),"utf8"));manifest.host_permissions.push(endpoint+"/*");
    await writeFile(join(directory,"manifest.json"),JSON.stringify(manifest));
    await writeFile(join(directory,"background.mjs"),(await readFile(join(directory,"background.mjs"),"utf8"))+`\napi.runtime.onInstalled.addListener(()=>api.tabs.create({url:api.runtime.getURL('controller.html')}));`);
    await writeFile(join(directory,"controller.html"),(await readFile(join(directory,"controller.html"),"utf8")).replace("</body>",'<script type="module" src="smoke.mjs"></script></body>'));
    await writeFile(join(directory,"smoke.mjs"),`import {MIGSession} from './mig/session.mjs';
      try{
       for(let i=0;i<100&&!document.querySelector('.command');i++)await new Promise(r=>setTimeout(r,50));
       if(document.querySelectorAll('.command').length!==2)throw new Error('Missing preset controls');
       await new Promise((accept,reject)=>{const clock=new Worker(browser.runtime.getURL('camera-clock.js'));clock.onmessage=()=>{clock.terminate();accept();};clock.onerror=reject;});
       const session=new MIGSession({assetBase:browser.runtime.getURL('mig/'),profileMode:true});
       await session.start(document.querySelector('video'),document.querySelector('canvas'));
       if(!session.state.running)throw new Error(session.state.status);
       const tracks=session.stream.getTracks();session.dispose();
       if(tracks.some(t=>t.readyState!=='ended'))throw new Error('Camera not released');
       await fetch('${endpoint}',{method:'POST',body:JSON.stringify({ok:true})});
      }catch(error){await fetch('${endpoint}',{method:'POST',body:JSON.stringify({ok:false,error:error.message})});}`);
    runner=await webExt.cmd.run({sourceDir:directory,firefox:firefox.executablePath(),noReload:true,noInput:true,args:["-headless"],
        pref:{"media.navigator.streams.fake":true,"media.navigator.permission.disabled":true}}, {shouldExitProgram:false});
    const report=await result;if(!report.ok)throw new Error(report.error);
    console.log("Firefox extension: real CSP, WASM presets, camera/model startup and track cleanup passed.");
}finally{
    clearTimeout(timer);await runner?.exit();await new Promise(accept=>server?server.close(accept):accept());
    if(!resolve(directory).startsWith(resolve(tmpdir())+sep))throw new Error("Unexpected cleanup path");
    await rm(directory,{recursive:true,force:true});
}
