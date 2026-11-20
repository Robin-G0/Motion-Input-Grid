import { MIGSession, gridPoint, type MIGAction, type MIGGrid } from "motion-input-grid";
import { useMIG as useReactMIG } from "motion-input-grid/react";
import { useMIG as useVueMIG } from "motion-input-grid/vue";

const onAction = (event: MIGAction): void => { console.log(event.action, event.id); };
const session = new MIGSession({ assetBase: "/mig/", onAction });
session.subscribe(state => console.log(state.actions, state.running));
const react = useReactMIG({ onAction, poseModel: "lite", poseModels: ["lite", "heavy"] });
void react.setPoseModel("heavy");
const vue = useVueMIG({ onAction });
void react.video.current;
void vue.video.value;
void session.importJSON("{}");

const efficient = new MIGSession({maxInferenceFps:20, drawOverlay:false, videoConstraints:{width:640,height:480}, delegate:"CPU"});
efficient.setInferenceFps(10);
const precise = new MIGSession({ poseModel: "full", poseModels: ["lite", "full"] });
void precise.setPoseModel("lite").then(() => console.log(precise.state.poseModel, precise.poseModels));
const engineGrid: MIGGrid | null = session.grid("calibrated");
if (engineGrid) console.log(gridPoint(engineGrid, 4.5, 3.5).x);
