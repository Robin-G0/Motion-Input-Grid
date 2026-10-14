import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join, resolve } from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const destination = resolve(root, "dist");
if (destination !== join(root, "dist")) throw new Error("Unexpected output directory");
await rm(destination, { recursive: true, force: true });
await mkdir(destination, { recursive: true });
for (const name of ["index.html", "styles.css", "favicon.svg", "favicon-dark.svg", "favicon.png", "favicon.ico", "src", "studio"]) {
    await cp(join(root, name), join(destination, name), { recursive: true });
}
// Copy the pinned published package, never compile the repository's C++ sources.
await cp(join(root, "node_modules/motion-input-grid/runtime"), join(destination, "mig"), { recursive: true });
await cp(join(root, "node_modules/motion-input-grid/LICENSE"), join(destination, "mig/LICENSE"));
await writeFile(join(destination, ".nojekyll"), "");
console.log("Static site built in site/dist.");
