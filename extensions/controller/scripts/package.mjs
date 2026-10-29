import {readFile} from "node:fs/promises";
import {spawnSync} from "node:child_process";
import {fileURLToPath} from "node:url";
import {join} from "node:path";
const root=fileURLToPath(new URL("../",import.meta.url));
const {version}=JSON.parse(await readFile(join(root,"package.json"),"utf8"));
for(const platform of ["chromium","firefox"]){
    const result=spawnSync(process.execPath,[join(root,"node_modules/web-ext/bin/web-ext.js"),"build","--source-dir",join(root,"dist",platform),"--artifacts-dir",join(root,"dist/packages"),"--filename",`mig-controller-${platform}-${version}.zip`,"--overwrite-dest"],{stdio:"inherit"});
    if(result.status!==0)process.exit(result.status??1);
}
