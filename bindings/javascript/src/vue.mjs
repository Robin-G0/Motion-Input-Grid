import { onMounted, onUnmounted, shallowRef, ref } from "vue";
import { MIGSession } from "./index.mjs";

export function useMIG(options = {}) {
    const video = ref(null);
    const canvas = ref(null);
    const state = shallowRef({ status: "Ready. Start the camera.",
        running: false, busy: false, actions: [] });
    let session;
    let unsubscribe;
    const close = () => session?.dispose();

    onMounted(() => {
        session = new MIGSession(options);
        unsubscribe = session.subscribe(value => { state.value = value; });
        window.addEventListener("pagehide", close);
    });
    onUnmounted(() => {
        unsubscribe?.();
        window.removeEventListener("pagehide", close);
        close();
    });

    return { state, video, canvas,
        start: () => session?.start(video.value, canvas.value),
        stop: () => session?.stop(),
        recalibrate: () => session?.recalibrate(),
        importJSON: json => session?.importJSON(json),
        setPoseModel: name => session?.setPoseModel(name) };
}
