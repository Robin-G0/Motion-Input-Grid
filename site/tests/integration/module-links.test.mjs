import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const output = new URL("../../dist/", import.meta.url);

function modules(directory) {
    return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
        const url = new URL(entry.name + (entry.isDirectory() ? "/" : ""), directory);
        return entry.isDirectory() ? modules(url) : entry.name.endsWith(".mjs") ? [url] : [];
    });
}

function verifyReference(reference, parent) {
    const target = new URL(reference, parent);
    assert.ok(existsSync(target), `${fileURLToPath(parent)} links to missing ${reference}`);
}

test("built site imports and module-relative asset URLs resolve after module moves", () => {
    for (const url of modules(new URL("src/", output))) {
        const source = readFileSync(url, "utf8");
        const imports = /(?:from\s+|import\s*\(\s*|import\s+)["'](\.{1,2}\/[^"']+)["']/g;
        const assets = /new URL\(["'](\.{1,2}\/[^"']+)["'],\s*import\.meta\.url\)/g;
        for (const match of [...source.matchAll(imports), ...source.matchAll(assets)]) {
            verifyReference(match[1], url);
        }
    }
});

test("built homepage local links and scripts point to existing files", () => {
    const index = new URL("index.html", output);
    const html = readFileSync(index, "utf8");
    for (const match of html.matchAll(/(?:href|src)=["'](\.\.?\/[^"']+)["']/g)) {
        verifyReference(match[1], index);
    }
});
