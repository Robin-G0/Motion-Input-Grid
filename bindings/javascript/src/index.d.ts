export interface MIGAction { action: string; id: string }
export interface MIGState {
    status: string;
    running: boolean;
    busy: boolean;
    actions: MIGAction[];
}
export interface MIGOptions {
    assetBase?: string;
    profileMode?: boolean;
    onAction?: (event: MIGAction) => void;
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
    dispose(): void;
}
export interface MIGCoordinate { x: number; y: number; z: number; confidence: number }
export interface MIGSessionOptions extends MIGOptions {
    onFrame?: (session: MIGSession) => void;
}
