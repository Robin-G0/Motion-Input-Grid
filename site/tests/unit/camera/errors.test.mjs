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

test("failed downloads with HTTPS URLs do not report an insecure camera", () => {
    assert.equal(cameraError("TypeError Failed to fetch dynamically imported module: https://example.com/mig/session.mjs"), "networkCamera");
    assert.equal(cameraError("Error Failed to load https://example.com/models/pose.task"), "networkCamera");
    assert.equal(cameraError("TypeError NetworkError when attempting to fetch resource."), "networkCamera");
    assert.equal(cameraError("Permission denied at https://example.com"), "denied");
    assert.equal(cameraError("Unexpected error at https://example.com"), "error");
});
