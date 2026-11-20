"use client";

import { useEffect, useRef, useState } from "react";
import { MIGSession } from "./index.mjs";

export function useMIG({ assetBase, profileMode = false, onAction, poseModel, poseModels } = {}) {
    const session = useRef(null);
    const video = useRef(null);
    const canvas = useRef(null);
    const actionHandler = useRef(onAction);
    const [state, setState] = useState({ status: "Ready. Start the camera.",
        running: false, busy: false, actions: [] });

    useEffect(() => { actionHandler.current = onAction; }, [onAction]);
    useEffect(() => {
        const current = new MIGSession({ assetBase, profileMode, poseModel, poseModels,
            onAction: event => actionHandler.current?.(event) });
        session.current = current;
        const unsubscribe = current.subscribe(setState);
        const close = () => current.dispose();
        window.addEventListener("pagehide", close);
        return () => {
            unsubscribe();
            window.removeEventListener("pagehide", close);
            close();
            session.current = null;
        };
    }, [assetBase, profileMode, poseModel, poseModels?.join()]);

    return { ...state, video, canvas,
        start: () => session.current?.start(video.current, canvas.current),
        stop: () => session.current?.stop(),
        recalibrate: () => session.current?.recalibrate(),
        importJSON: json => session.current?.importJSON(json),
        setPoseModel: name => session.current?.setPoseModel(name) };
}
