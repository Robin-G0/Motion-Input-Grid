export async function loadModels(assetBase = new URL("./", import.meta.url).href,
    { hands = true, delegate = "CPU" } = {}) {
    const { FilesetResolver, PoseLandmarker, HandLandmarker } = await import(
        new URL("vision/vision_bundle.mjs", assetBase).href
    );
    const files = await FilesetResolver.forVisionTasks(
        new URL("vision/wasm", assetBase).href,
    );
    const pose = await PoseLandmarker.createFromOptions(files, {
        baseOptions: { modelAssetPath: new URL("models/pose_landmarker_lite.task", assetBase).href, delegate },
        runningMode: "VIDEO",
        numPoses: 1,
    });
    const loadHands = () => HandLandmarker.createFromOptions(files, {
            baseOptions: { modelAssetPath: new URL("models/hand_landmarker.task", assetBase).href, delegate },
            runningMode: "VIDEO",
            numHands: 2,
        });
    try {
        return { pose, hands: hands ? await loadHands() : null, loadHands };
    } catch (error) {
        pose.close();
        throw error;
    }
}
