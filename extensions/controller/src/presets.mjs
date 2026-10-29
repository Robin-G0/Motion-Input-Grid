export function presetProfile(reverse = false, site = null, overrides = {}) {
    const defaults = {next:site?.next ?? [39],previous:site?.previous ?? [37]};
    const inputs = [
        // Unmirrored camera X is opposite the performer's own left/right.
        {id:"right_sweep",name:"Right hand: right → left",landmark:"right_wrist",cells:[[-9,-2,11,15],[7,-2,11,15]]},
        {id:"left_sweep",name:"Left hand: left → right",landmark:"left_wrist",cells:[[7,-2,11,15],[-9,-2,11,15]]}
    ].map((motion,index) => {
        const action = (index === 0) !== reverse ? "next" : "previous";
        return {id:motion.id,name:motion.name,action,space:"body",cooldown_ms:900,max_duration_ms:2200,
            keyboard:[{keys:overrides[motion.id] ?? defaults[action]}],action_mode:"single_press",
            steps:[{id:`${motion.id}_route`,mode:"ordered",constraints:motion.cells.map((cell,i)=>({id:`${motion.id}_${i}`,landmark:motion.landmark,
                cell,type:i ? "trigger" : "required",priority:"high",order:i+1}))}]};
    });
    return {schema_version:2,tracking:{hands:false},inputs};
}
