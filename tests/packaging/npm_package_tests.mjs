import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { copyFile, mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const archive = path.resolve(process.argv[2]);
const folder = await mkdtemp(path.resolve("build/npm-artifact-"));
try {
    await writeFile(path.join(folder, "package.json"), '{"private":true,"type":"module"}\n');
    // This literal filename must survive spaces, shell syntax and Windows env expansion.
    const installedArchive = path.join(folder, "package %MIG_NPM_TEST_SEGMENT% & literal.tgz");
    await copyFile(archive, installedArchive);
    const args = ["install", "--ignore-scripts", "--no-audit", "--no-fund", "--omit=optional",
        "--offline", "--legacy-peer-deps",
        "--cache", path.join(folder, "cache"), installedArchive];
    const nodeDirectory = path.dirname(process.execPath);
    const npmCLI = [path.join(nodeDirectory, "node_modules/npm/bin/npm-cli.js"),
        path.resolve(nodeDirectory, "../lib/node_modules/npm/bin/npm-cli.js"),
        path.resolve(nodeDirectory, "../share/nodejs/npm/bin/npm-cli.js")].find(existsSync);
    if (!npmCLI) throw new Error("Cannot locate npm-cli.js beside this Node installation");
    execFileSync(process.execPath, [npmCLI, ...args], { cwd: folder, stdio: "inherit",
        env: { ...process.env, MIG_NPM_TEST_SEGMENT: "unexpected-expansion" } });
    const installed = path.join(folder, "node_modules/motion-input-grid");
    await writeFile(path.join(folder, "consumer.mjs"),
        'import assert from "node:assert/strict";\n'
        + 'import { MIGSession } from "motion-input-grid";\n'
        + 'assert.equal(typeof MIGSession, "function");\n');
    execFileSync(process.execPath, [path.join(folder, "consumer.mjs")], { cwd: folder, stdio: "inherit" });
    execFileSync(process.execPath, [path.join(installed, "src/validate-runtime.mjs")], { stdio: "inherit" });
    execFileSync(process.execPath, [path.join(installed, "src/copy-assets.mjs"), path.join(folder, "public/mig")],
        { cwd: folder, stdio: "inherit" });
    const test = await readFile("tests/bindings/javascript/web_tests.mjs", "utf8");
    const copied = test.replace("'../../../examples/web/overlay.mjs'",
        JSON.stringify(pathToFileURL(path.join(installed, "runtime/overlay.mjs")).href))
        .replace("'./presentation_profile_tests.mjs'",
            JSON.stringify(pathToFileURL(path.resolve("tests/bindings/javascript/presentation_profile_tests.mjs")).href));
    await writeFile(path.join(folder, "recognition.mjs"), copied);
    execFileSync(process.execPath, [path.join(folder, "recognition.mjs"), path.join(installed, "runtime/mig.mjs")],
        { stdio: "inherit" });
    console.log("Installed npm package: import, assets and native WASM recognition passed");
} finally {
    await rm(folder, { recursive: true, force: true });
}
