import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export async function verifyPresentationProfiles(createMIG) {
    const module = await createMIG();
    let scenarios = 0;
    for (const reversed of [false, true]) {
        const name = `presentation-tolerant${reversed ? "-reversed" : ""}.json`;
        const json = await readFile(new URL(`../../../configs/${name}`, import.meta.url), "utf8");
        for (const hand of [15, 16]) {
            for (const intervals of [[67], [100], [67, 100, 80, 145]]) {
                for (const width of [.09, .15, .3]) {
                    for (const duration of [400, 1000, 3000]) {
                        for (const motion of ["swipe", "jitter", "vertical", "incomplete"]) {
                            const tracker = new module.Tracker();
                            let time = 0, sequence = 0;
                            const actions = [];
                            const start = hand === 16 ? 2.5 : 6.5;
                            const finish = hand === 16 ? 6.5 : 2.5;
                            const aspect = 16 / 9, scale = width * .2;
                            const frame = (column, row = 3.5, confidence = 1) => {
                                time += intervals[sequence % intervals.length];
                                const buffer = tracker.bodyBuffer();
                                buffer.fill(0);
                                const put = (index, x, y, confidence = 1) => buffer.set([x, y, 0, confidence, 0, 0, 0, 0], index * 8);
                                put(11, .5 + width / (2 * aspect), .5);
                                put(12, .5 - width / (2 * aspect), .5);
                                put(hand, .5 + (column - 4.5) * scale / aspect,
                                    .5 + (row - 3.5) * scale, confidence);
                                const count = tracker.update(time, ++sequence, aspect, 0, 0);
                                assert.ok(count >= 0);
                                for (let i = 0; i < count; i++) actions.push(tracker.eventAction(i));
                            };
                            try {
                                assert.equal(tracker.load(json), "");
                                while (time < 2000) frame(start, 3.5, 0);
                                frame(start);
                                frame(start);
                                const began = time;
                                while (time - began < duration) {
                                    const next = time + intervals[sequence % intervals.length];
                                    const progress = Math.min(1, (next - began) / duration);
                                    const end = motion === "incomplete" ? finish - Math.sign(finish - start) : finish;
                                    const column = motion === "jitter" ? start + Math.sin(sequence) * .3
                                        : motion === "vertical" ? start : start + (end - start) * progress;
                                    frame(column, motion === "vertical" ? -3 + 13 * progress : 3.5);
                                }
                                const ended = time;
                                while (time - ended < 2000) frame(motion === "swipe" ? finish : 4.5);
                                const action = (hand === 16) !== reversed ? "next" : "previous";
                                assert.deepEqual(actions, motion === "swipe" ? [action] : [],
                                    `${name}/${hand}/${intervals}/${width}/${duration}/${motion}`);
                                scenarios++;
                            } finally {
                                tracker.delete();
                            }
                        }
                    }
                }
            }
        }
    }
    console.log(`Tolerant presentation profiles: ${scenarios} low-FPS, scale and unwanted-motion scenarios passed.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
    const { default: createMIG } = await import(pathToFileURL(resolve(process.argv[2] ?? "build/web/web/mig.mjs")));
    await verifyPresentationProfiles(createMIG);
}
