import assert from "node:assert/strict";
import { test } from "node:test";
import { translations } from "../../../src/ui/translations.mjs";
import { settings } from "../../../src/settings.mjs";

test("both languages cover the same UI and slides; public links use HTTPS", () => {
    assert.deepEqual(Object.keys(translations.fr).sort(), Object.keys(translations.en).sort());
    for (const text of Object.values(translations)) {
        assert.equal(text.slides.length, 3);
        assert.ok(Object.values(text).every(value => value.length > 0));
    }
    for (const link of Object.values(settings.links)) {
        assert.equal(new URL(link).protocol, "https:");
    }
    assert.equal(settings.links.linkedin, "https://www.linkedin.com/in/robin-g0/");
});
