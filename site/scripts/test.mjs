import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../tests/", import.meta.url));
const files = readdirSync(root, { recursive: true })
    .filter(name => name.endsWith(".test.mjs"))
    .sort()
    .map(name => join(root, name));
if (!files.length) throw new Error("No site tests found");
const result = spawnSync(process.execPath, ["--test", ...files], { stdio: "inherit" });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
