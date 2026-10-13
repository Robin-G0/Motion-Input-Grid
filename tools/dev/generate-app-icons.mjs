// Rebuild native icons from the website logos and the maintainer's original hand asset.
// Requires site/npm ci; uses an installed Edge or Playwright Chromium without a server.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from '../../site/node_modules/playwright/index.mjs';

const root = new URL('../../', import.meta.url);
const output = new URL('assets/apps/', root);
await mkdir(output, { recursive: true });
const dark = await readFile(new URL('site/favicon-dark.svg', root), 'utf8');
const light = await readFile(new URL('site/favicon.svg', root), 'utf8');
const hand = await readFile(new URL('Hand.png', output));
const inner = light.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
const controller = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
  <svg x="64" y="64" width="896" height="896" viewBox="0 0 64 64">${inner}</svg>
  <image href="Hand.png" x="0" y="0" width="1024" height="1024"/>
</svg>\n`;
await writeFile(new URL('motion-input-grid-studio.svg', output), dark);
await writeFile(new URL('motion-input-grid-controller.svg', output), controller);
const browser = await chromium.launch(process.platform === 'win32'
    ? { executablePath: process.env.MIG_ICON_BROWSER || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' }
    : {});
try {
    const page = await browser.newPage();
    for (const [name, svg] of [
        ['motion-input-grid-studio', dark],
        ['motion-input-grid-controller', controller.replace('href="Hand.png"', `href="data:image/png;base64,${hand.toString('base64')}"`)],
    ]) {
        const frames = [];
        for (const size of [16, 24, 32, 48, 64, 128, 256]) {
            await page.setViewportSize({ width: size, height: size });
            await page.setContent(`<style>html,body{margin:0;background:transparent}body>svg{width:${size}px;height:${size}px}</style>${svg}`);
            await page.evaluate(async () => { await Promise.all([...document.images].map(image => image.decode())); });
            // SVG images are not included in document.images; wait for their decoded pixels.
            await page.evaluate(async () => {
                for (const element of document.querySelectorAll('image')) {
                    const decoded = new Image(); decoded.src = element.getAttribute('href'); await decoded.decode();
                }
            });
            const png = await page.screenshot({ omitBackground: true });
            frames.push({ size, png });
            if (size === 256) await writeFile(new URL(`${name}.png`, output), png);
        }
        const header = Buffer.alloc(6 + frames.length * 16);
        header.writeUInt16LE(1, 2); header.writeUInt16LE(frames.length, 4);
        let offset = header.length;
        frames.forEach(({ size, png }, index) => {
            const row = 6 + index * 16;
            header[row] = header[row + 1] = size === 256 ? 0 : size;
            header.writeUInt16LE(1, row + 4); header.writeUInt16LE(32, row + 6);
            header.writeUInt32LE(png.length, row + 8); header.writeUInt32LE(offset, row + 12);
            offset += png.length;
        });
        await writeFile(new URL(`${name}.ico`, output), Buffer.concat([header, ...frames.map(frame => frame.png)]));
        console.log(`Generated ${name} icons in ${fileURLToPath(output)}`);
    }
} finally {
    await browser.close();
}
