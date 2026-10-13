import assert from "node:assert/strict";
import { test } from "node:test";
import { cameraError } from "../../../src/camera/camera.mjs";

test("camera errors give usable recovery messages", () => {
    assert.equal(cameraError("Permission denied"), "denied");
    assert.equal(cameraError("NotFoundError: no device"), "unavailable");
    assert.equal(cameraError("Unexpected model failure"), "error");
    assert.equal(cameraError("NotReadableError: camera in use"), "busyCamera");
    assert.equal(cameraError("SecurityError: insecure context"), "insecureCamera");
    assert.equal(cameraError("Camera interrupted"), "interruptedCamera");
});
