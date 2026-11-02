export function presetProfile(reverse = false, site = null, overrides = {}) {
    const defaults = {next:site?.next ?? [39],previous:site?.previous ?? [37]};
    const inputs = [
        // Unmirrored camera X is opposite the performer's own left/right.
        // Cover the full vertical body grid; direction and horizontal separation
        // still require a deliberate crossing from the start to the trigger.
        // Include relaxed wrist positions in the start bands. The three-cell
        // central gap scales with shoulder width, including farther from camera.
        {id:"right_sweep",name:"Right hand: right → left",landmark:"right_wrist",cells:[[-9,-9,12,27],[6,-9,12,27]]},
        {id:"left_sweep",name:"Left hand: left → right",landmark:"left_wrist",cells:[[6,-9,12,27],[-9,-9,12,27]]}
    ].map((motion,index) => {
        const action = (index === 0) !== reverse ? "next" : "previous";
        return {id:motion.id,name:motion.name,action,space:"body",cooldown_ms:900,max_duration_ms:4000,
            keyboard:[{keys:overrides[motion.id] ?? defaults[action]}],action_mode:"single_press",
            steps:[{id:`${motion.id}_route`,mode:"ordered",constraints:motion.cells.map((cell,i)=>({id:`${motion.id}_${i}`,landmark:motion.landmark,
                cell,type:i ? "trigger" : "required",priority:"high",order:i+1}))}]};
    });
    return {schema_version:2,tracking:{hands:false},inputs};
}
