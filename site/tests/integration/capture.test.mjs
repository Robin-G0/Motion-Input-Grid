import assert from "node:assert/strict";
import { test } from "node:test";
import createMIG from "../../dist/mig/mig.mjs";
import { MotionTake, mergeTakes } from "../../studio/src/motion-capture.mjs";

test("captured routes import into the real WASM engine and recognize only the selected part and direction", async () => {
    const module=await createMIG();
    for(const preset of ["precise","normal","tolerant"]) {
        const takes=[-.15,0,.15].map(offset=>{
            const take=new MotionTake(0);
            for(let t=0;t<=1500;t+=30) take.observe({x:4.5+offset,y:7-6*Math.min(1,Math.max(0,(t-150)/1200))},t);
            return take.finish(1500);
        });
        const movement=mergeTakes(takes,{landmark:"left_wrist",preset,id:"raise",name:"Raise"});
        for(const kind of ["correct","reverse","stationary","wrong-part"]) {
            const tracker=new module.Tracker();let time=0,sequence=0;const actions=[];
            try {
                assert.equal(tracker.load(JSON.stringify({schema_version:2,inputs:[movement]})),"");
                function frame(y) {
                    const points=tracker.bodyBuffer();points.fill(0);
                    const put=(index,x,y)=>points.set([x,y,0,1,0,0,0,0],index*8);
                    put(11,.65,.45);put(12,.35,.45);
                    put(kind==="wrong-part"?16:15,.5,.45+(y-3.5)*.06);
                    const count=tracker.update(time+=40,++sequence,1,0,0);
                    for(let i=0;i<count;i++) actions.push(tracker.eventAction(i));
                }
                for(let i=0;i<35;i++) frame(kind==="reverse"||kind==="stationary"?1:7);
                for(let i=0;i<=30;i++) frame(kind==="stationary"?1:kind==="reverse"?1+i*.2:7-i*.2);
                for(let i=0;i<20;i++) frame(kind==="reverse"?7:1);
                assert.deepEqual(actions,kind==="correct"?["raise"]:[],`${preset}: ${kind}`);
            } finally {tracker.delete();}
        }
    }
});

test("captured endpoints support a live held pose across portrait and landscape body grids",async()=>{
    const module=await createMIG();
    const takes=[-.1,0,.1].map(offset=>{
        const take=new MotionTake(0);
        for(let t=0;t<=1800;t+=30) take.observe({x:4.5+offset,y:7.2-6.8*Math.min(1,Math.max(0,(t-300)/1200))},t);
        return take.finish(1800);
    });
    const movement=mergeTakes(takes,{landmark:"left_wrist",preset:"precise",id:"hold",name:"Hold"});
    movement.action_mode="hold";movement.keyboard=[{keys:[39]}];
    for(const aspect of [9/16,16/9]) for(const [center,span] of [[.45,.25],[.6,.35]]) {
        const tracker=new module.Tracker();let time=0,sequence=0,events=0;
        try {
            assert.equal(tracker.load(JSON.stringify({schema_version:2,inputs:[movement]})),"");
            const frame=y=>{
                const body=tracker.bodyBuffer();body.fill(0);
                const put=(joint,x,y)=>body.set([x,y,0,1,0,0,0,0],joint*8);
                put(11,center+span/2,.45);put(12,center-span/2,.45);
                put(15,center,.45+(y-3.5)*span*.2*aspect);
                events+=tracker.update(time+=40,++sequence,aspect,0,0);
            };
            for(let i=0;i<35;i++) frame(7.2);
            for(let i=0;i<=35;i++) frame(7.2-6.8*i/35);
            for(let i=0;i<15;i++) frame(.4);
            assert.equal(events,1);
            assert.equal(tracker.active(0),true,"the demonstrated resting endpoint must sustain Hold");
            frame(9);assert.equal(tracker.active(0),false);
        } finally {tracker.delete();}
    }
});
