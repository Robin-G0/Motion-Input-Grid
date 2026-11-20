import type { Ref, ShallowRef } from "vue";
import type { MIGOptions, MIGPoseModel, MIGState } from "./index.js";
export interface MIGVue {
    state: ShallowRef<MIGState>;
    video: Ref<HTMLVideoElement | null>;
    canvas: Ref<HTMLCanvasElement | null>;
    start(): Promise<void> | undefined;
    stop(): void;
    recalibrate(): void;
    importJSON(json: string): Promise<void> | undefined;
    setPoseModel(name: MIGPoseModel): Promise<void> | undefined;
}
export function useMIG(options?: MIGOptions): MIGVue;
