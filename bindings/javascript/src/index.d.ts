export interface MIGAction { action: string; id: string }
/** BlazePose GHUM variants: lite (fastest), full (balanced), heavy (most precise). */
export type MIGPoseModel = "lite" | "full" | "heavy";
export interface MIGState {
    status: string;
    running: boolean;
    busy: boolean;
    actions: MIGAction[];
    poseModel: MIGPoseModel;
}
export interface MIGOptions {
    assetBase?: string;
    profileMode?: boolean;
    onAction?: (event: MIGAction) => void;
    /** Default model; lite is bundled, full and heavy download once. */
    poseModel?: MIGPoseModel;
    /** Models the application allows; defaults to all three. */
    poseModels?: MIGPoseModel[];
}
export class MIGSession {
    constructor(options?: MIGSessionOptions);
    readonly state: MIGState;
    subscribe(listener: (state: MIGState) => void): () => void;
    start(video: HTMLVideoElement, canvas: HTMLCanvasElement): Promise<void>;
    stop(): void;
    recalibrate(): void;
    importJSON(json: string): Promise<void>;
    coordinate(index: number, system?: number): MIGCoordinate | null;
    setInferenceFps(fps: number): void;
    /** Models the user may choose, from `poseModels`. */
    readonly poseModels: MIGPoseModel[];
    /** Loads the model on demand (verified and cached) and keeps the camera running. */
    setPoseModel(name: MIGPoseModel): Promise<void>;
    dispose(): void;
}
export interface MIGCoordinate { x: number; y: number; z: number; confidence: number }
export interface MIGSessionOptions extends MIGOptions {
    onFrame?: (session: MIGSession) => void;
    /** 0 keeps uncapped inference; otherwise 1..120. Never queues skipped frames. */
    maxInferenceFps?: number;
    drawOverlay?: boolean;
    videoConstraints?: MediaTrackConstraints;
    /** GPU falls back to CPU when WebGL inference is unavailable. */
    delegate?: "CPU" | "GPU";
}
