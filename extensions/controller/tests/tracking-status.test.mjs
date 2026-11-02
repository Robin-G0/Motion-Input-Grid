import { test } from "node:test";
import assert from "node:assert/strict";
import { trackingStatus } from "../src/tracking-status.mjs";

test("the camera does not advertise gesture readiness before the MIG grid is valid", () => {
    const session = { coordinate: () => ({ confidence: 1 }), tracker: { grid: () => null } };
    assert.equal(trackingStatus(session), "configurationCalibrating");
    session.tracker.grid = () => ({ scale: .06 });
    assert.equal(trackingStatus(session), "active");
    session.coordinate = index => index === 11 ? null : { confidence: 1 };
    assert.equal(trackingStatus(session), "missing");
});
