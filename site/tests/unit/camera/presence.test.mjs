import assert from "node:assert/strict";
import { test } from "node:test";
import { PresenceMonitor } from "../../../src/camera/presence.mjs";
import { settings } from "../../../src/settings.mjs";

test("presence waits for a person and ignores a brief dropout", () => {
    const presence = new PresenceMonitor(settings);
    assert.equal(presence.update(false, 0), "waiting");
    assert.equal(presence.update(false, 500), "waiting");
    assert.equal(presence.update(true, 600), "present");
    assert.equal(presence.update(false, 700), "present");
    assert.equal(presence.update(true, 900), "present");
});

test("sustained departure hides the page; stable return opens it", () => {
    const presence = new PresenceMonitor(settings);
    presence.update(true, 0);
    for (let time = 100; time <= 600; time += 100) {
        assert.equal(presence.update(false, time), "present");
    }
    assert.equal(presence.update(false, 700), "away");
    assert.equal(presence.update(true, 800), "away");
    assert.equal(presence.update(false, 900), "away");
    assert.equal(presence.update(true, 1000), "away");
    assert.equal(presence.update(true, 1299), "away");
    assert.equal(presence.update(true, 1300), "present");
    presence.reset();
    assert.equal(presence.state, "waiting");
});

test("absence completes without another camera frame and return cancels pending absence", () => {
    const presence = new PresenceMonitor(settings);
    presence.update(true, 0);
    presence.update(false, 100);
    assert.equal(presence.tick(700), "away");
    presence.update(true, 800);
    assert.equal(presence.tick(1100), "present");
    presence.update(false, 1200);
    assert.equal(presence.update(true, 1500), "present");
    assert.equal(presence.tick(3000), "present");
    presence.reset();
    assert.equal(presence.tick(10000), "waiting");
});

test("isolated confident false positives cannot continually cancel departure", () => {
    const presence = new PresenceMonitor(settings);
    presence.update(true, 0);
    presence.update(false, 100);
    for (const time of [200, 400, 600]) {
        assert.equal(presence.update(true, time), "present");
        presence.update(false, time + 50);
    }
    assert.equal(presence.update(false, 700), "away");
    presence.update(true, 800);
    assert.equal(presence.update(false, 850), "away");
    presence.update(true, 900);
    assert.equal(presence.update(true, 1200), "present");
});

test("sustained confident recovery cancels departure before hiding the page", () => {
    const presence = new PresenceMonitor(settings);
    presence.update(true, 0);
    presence.update(false, 100);
    presence.update(true, 200);
    assert.equal(presence.update(true, 500), "present");
    assert.equal(presence.update(false, 600), "present");
    assert.equal(presence.tick(1199), "present");
    assert.equal(presence.tick(1200), "away");
});

test("tab suspension discards stale observations until a fresh frame arrives", () => {
    const presence = new PresenceMonitor(settings);
    presence.update(true, 0);
    presence.update(false, 100);
    presence.pause();
    assert.equal(presence.tick(10000), "present");
    assert.equal(presence.update(true, 10100), "present");
    presence.update(false, 10200);
    assert.equal(presence.tick(10800), "away");
    presence.pause();
    assert.equal(presence.tick(20000), "away");
    assert.equal(presence.update(true, 20100), "away");
    assert.equal(presence.tick(20400), "present");
});
