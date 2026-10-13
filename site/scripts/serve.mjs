import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("../dist", import.meta.url)));
const basePath = "/Motion-Input-Grid/";
const port = Number(process.env.PORT ?? 4173);
const types = {
    ".html": "text/html; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml",
    ".js": "text/javascript; charset=utf-8", ".wasm": "application/wasm",
    ".json": "application/json", ".task": "application/octet-stream"
};
createServer(async (request, response) => {
    const pathname = new URL(request.url, "http://localhost").pathname;
    if (pathname === "/Motion-Input-Grid") {
        response.writeHead(301, { Location: basePath }); response.end(); return;
    }
    if (!pathname.startsWith(basePath)) {
        response.writeHead(404); response.end("Not found"); return;
    }
    const relative = decodeURIComponent(pathname.slice(basePath.length)) + (pathname.endsWith("/") ? "index.html" : "");
    const filename = resolve(root, relative);
    if (!filename.startsWith(root + sep)) {
        response.writeHead(403); response.end("Forbidden"); return;
    }
    try {
        const body = await readFile(filename);
        response.writeHead(200, { "Content-Type": types[extname(filename)] ?? "application/octet-stream" });
        response.end(body);
    } catch {
        response.writeHead(404); response.end("Not found");
    }
}).listen(port, "127.0.0.1", () => {
    console.log(`Preview: http://127.0.0.1:${port}${basePath}`);
});
