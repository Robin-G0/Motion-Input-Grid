export async function fakeStudioCamera(page, failure = "") {
    await page.addInitScript(failure => {
        window.cameraFailure = failure;
        window.studioWristY = .61; window.studioWristX = .5;
        const canvas = document.createElement("canvas"); canvas.width = 960; canvas.height = 720;
        const context = canvas.getContext("2d");
        window.studioVideoTimer = setInterval(() => { context.fillStyle = "#17232a"; context.fillRect(0, 0, 960, 720); }, 40);
        navigator.mediaDevices.getUserMedia = async () => {
            if (window.cameraFailure) throw new Error(window.cameraFailure);
            window.studioStream = canvas.captureStream(25); return window.studioStream;
        };
    }, failure);
    // Keep the real published MIGSession and WASM engine, replace only inference.
    await page.route("**/mig/models.mjs", route => route.fulfill({ contentType: "text/javascript", body: `
        export async function loadModels() {
            return { pose: { close() {}, setOptions() {}, detectForVideo() {
                window.studioInferenceCount = (window.studioInferenceCount || 0) + 1;
                const points = Array.from({length:33}, () => ({x:.5,y:.45,z:0,visibility:0}));
                const span = window.studioShoulderSpan ?? .3;
                points[11] = {x:.5+span/2,y:.45,z:0,visibility:window.studioShouldersVisible === false ? 0 : 1};
                points[12] = {x:.5-span/2,y:.45,z:0,visibility:window.studioShouldersVisible === false ? 0 : 1};
                points[15] = {x:window.studioWristX,y:window.studioWristY,z:0,visibility:window.studioWristVisible === false ? 0 : 1};
                return {landmarks:[points], worldLandmarks:[]};
            } }, hands: { close() {}, detectForVideo() { return {landmarks:[],handedness:[],worldLandmarks:[]}; } } };
        }
    ` }));
}
