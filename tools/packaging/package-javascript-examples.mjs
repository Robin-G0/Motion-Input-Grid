import { cp, mkdir, readdir, readFile, writeFile, copyFile, stat,
    lstat, realpath, rm } from "node:fs/promises";
import { resolve, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";

const root = fileURLToPath(new URL("../../", import.meta.url));
const python = process.env.MIG_PYTHON ?? (process.platform === "win32" ? "python" : "python3");
const version = (await readFile(join(root, "VERSION"), "utf8")).trim();
const name = `motion-input-grid-${version}-javascript-examples`;
const destination = join(root, "build/examples", name);
const releases = join(root, "build/releases");
try {
    const info = await lstat(destination);
    if (info.isSymbolicLink() || await realpath(destination) !== resolve(destination)) {
        throw new Error(`Refusing cleanup outside generated examples: ${destination}`);
    }
    console.log(`Rebuilding generated examples: ${destination}`);
    await rm(destination, { recursive: true });
} catch (error) {
    if (error.code !== "ENOENT") throw error;
}
await mkdir(destination, { recursive: true });
await mkdir(releases, { recursive: true });
const excluded = new Set(["node_modules", ".next", "public", "dist", "out"]);
for (const folder of ["react", "vue", "next", "web"]) {
    await cp(join(root, "examples", folder), join(destination, "examples", folder), {
        recursive: true,
        filter: source => !relative(join(root, "examples", folder), source)
            .split(/[\\/]/).some(part => excluded.has(part))
    });
}
for (const folder of ["react", "vue", "next"]) {
    const output = folder === "next" ? "out" : "dist";
    const source = join(root, "examples", folder, output);
    await cp(source, join(destination, "examples", folder, output), { recursive: true });
}
await cp(join(root, "build/node-runtime"), join(destination, "runtime/node"), { recursive: true });
for (const folder of ["react", "vue", "next", "web"]) {
    const directory = join(destination, "examples", folder);
    await writeFile(join(directory, "run.cmd"),
        '@echo off\r\n"%~dp0..\\..\\runtime\\node\\win-x64\\node.exe" "%~dp0run.mjs"\r\n');
    const launcher = join(directory, "run.sh");
    await writeFile(launcher, `#!/bin/sh
set -eu
folder=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
case "$(uname -m)" in
    x86_64) platform=linux-x64 ;;
    aarch64|arm64) platform=linux-arm64 ;;
    *) echo "Unsupported bundled Node architecture" >&2; exit 1 ;;
esac
exec "$folder/../../runtime/node/$platform/node" "$folder/run.mjs"
`);
    if (process.platform !== "win32") execFileSync("chmod", ["+x", launcher]);
}
await cp(join(root, "bindings/javascript/runtime"),
    join(destination, "examples/web"), { recursive: true });
await cp(join(root, "bindings/javascript"), join(destination, "bindings/javascript"), {
    recursive: true, filter: source => !relative(join(root, "bindings/javascript"), source)
        .split(/[\\/]/).includes("node_modules")
});
await mkdir(join(destination, "tools"), { recursive: true });
for (const tool of ["web/serve-javascript.mjs", "web/prepare-javascript.mjs", "bootstrap/bootstrap-browser.mjs",
    "bootstrap/bootstrap-node.mjs", "bootstrap/node-archive.mjs", "packaging/archive-examples.py", "lib/package_linux.py", "lib/release_metadata.py", "lib/distribution_policy.py",
    "packaging/package-javascript-examples.mjs", "packaging/package-browser-example.py"]) {
    await mkdir(resolve(destination, "tools", tool, ".."), { recursive: true });
    await copyFile(join(root, "tools", tool), join(destination, "tools", tool));
}
const javascriptTests = "tests/bindings/javascript";
await mkdir(join(destination, javascriptTests), { recursive: true });
for (const file of ["web_tests.mjs", "web_camera_tests.mjs", "web_session_tests.mjs",
    "framework_tests.mjs", "framework_browser_tests.mjs", "browser_assets_tests.mjs",
    "javascript_server_tests.mjs", "node_archive_tests.mjs", "javascript_types.ts",
        "javascript-types.json", "presentation_profile_tests.mjs"]) {
    await copyFile(join(root, javascriptTests, file), join(destination, javascriptTests, file));
}
await mkdir(join(destination, "configs"), { recursive: true });
for (const name of ["default.json", "presentation-tolerant.json", "presentation-tolerant-reversed.json"]) {
    await copyFile(join(root, "configs", name), join(destination, "configs", name));
}
await mkdir(join(destination, "examples/common"), { recursive: true });
await copyFile(join(root, "examples/common/raised-hands.json"),
    join(destination, "examples/common/raised-hands.json"));
for (const file of ["package.json", "package-lock.json", "LICENSE", "VERSION"]) {
    await copyFile(join(root, file), join(destination, file));
}
await writeFile(join(destination, "README.md"), `# Motion Input Grid (MIG) JavaScript examples

[English](README.md) | [Français](README.fr.md)

[English guide](docs/integrations/javascript.md) | [Guide français](docs/integrations/javascript.fr.md)

Run run.cmd (Windows x64) or sh run.sh (Linux x64/ARM64) inside an example folder.
The archive includes Node. Alternatively, use an installed Node.js:

    node examples/react/run.mjs
    node examples/vue/run.mjs
    node examples/next/run.mjs

Open http://localhost:8820. Stop the server before launching another example.
Each viewer has raised-hands and profile-import pages. Source and documentation
are included beside built output. No npm install is needed to run compiled pages.
A modern browser and its camera permission are required. Models, WASM and the
MediaPipe browser runtime are local; no CDN download or npm install is needed.
`);
await writeFile(join(destination, "README.fr.md"), `# Exemples JavaScript Motion Input Grid (MIG)

[English](README.md) | [Français](README.fr.md)

Dans examples/web, react, vue ou next, lancez run.cmd sous Windows x64,
ou sh run.sh sous Linux x64/ARM64. Node est fourni. Ouvrez localhost:8820.
Un navigateur moderne reste nécessaire ; MediaPipe, WASM et modèles sont locaux.
Sources, pages compilées, documentation et licences sont incluses.
[Guide complet](docs/integrations/javascript.fr.md).
`);
const privateNames = new Set(execFileSync(python,
    [join(root, "tools/lib/distribution_policy.py"), "--excluded-names"], { encoding: "utf8" })
    .trim().split(/\r?\n/));
await cp(join(root, "docs"), join(destination, "docs"), {
    recursive: true, filter: source => !privateNames.has(source.split(/[\\/]/).at(-1))
});
const licenses = join(destination, "licenses/javascript");
await mkdir(licenses, { recursive: true });
for (const name of ["react", "react-dom", "vue", "scheduler"]) {
    await copyFile(join(root, "node_modules", name, "LICENSE"), join(licenses, `${name}-LICENSE`));
}
await copyFile(join(root, "node_modules/next/license.md"), join(licenses, "Next-LICENSE.md"));
async function copyNotices(folder) {
    for (const name of await readdir(folder)) {
        const source = join(folder, name);
        if ((await stat(source)).isDirectory()) await copyNotices(source);
        else if (/^(license|notice|copying)/i.test(name)) {
            const target = join(licenses, "next-compiled", relative(
                join(root, "node_modules/next/dist/compiled"), source));
            await mkdir(resolve(target, ".."), { recursive: true });
            await copyFile(source, target);
        }
    }
}
await copyNotices(join(root, "node_modules/next/dist/compiled"));
const hashes = {};
async function inventory(folder) {
    for (const name of (await readdir(folder)).sort()) {
        const file = join(folder, name);
        if ((await stat(file)).isDirectory()) await inventory(file);
        else if (relative(destination, file) !== "manifest.json") {
            hashes[relative(destination, file).replaceAll("\\", "/")] =
                createHash("sha256").update(await readFile(file)).digest("hex");
        }
    }
}
await inventory(destination);
await writeFile(join(destination, "manifest.json"), JSON.stringify({
    project: "Motion Input Grid", package: "motion-input-grid",
    repository: "https://github.com/Robin-G0/Motion-Input-Grid", version, sha256: hashes
}, null, 2) + "\n");
const archive = join(releases, `${name}.tar.gz`);
execFileSync(python, [join(root, "tools/packaging/archive-examples.py"), destination, archive]);
for (const example of ["web", "react", "vue", "next"]) {
    execFileSync(python, [join(root, "tools/packaging/package-browser-example.py"),
        "--source", destination, "--example", example], { stdio: "inherit" });
}
const digest = createHash("sha256").update(await readFile(archive)).digest("hex");
await writeFile(`${archive}.sha256`, `${digest}  ${name}.tar.gz\n`);
const sums = [];
for (const file of (await readdir(releases)).sort()) {
    if (!/\.(zip|tar\.gz|tgz|whl|deb)$/.test(file)) continue;
    const hash = createHash("sha256").update(await readFile(join(releases, file))).digest("hex");
    sums.push(`${hash}  ${file}`);
    if (file.endsWith(".tgz")) await writeFile(join(releases, `${file}.sha256`), `${hash}  ${file}\n`);
}
await writeFile(join(releases, "SHA256SUMS"), sums.join("\n") + "\n");
console.log(archive);
