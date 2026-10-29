import assert from "node:assert/strict";
import { test } from "node:test";
import { MotionTake, CaptureSequence, compareTake, mergeTakes, TAKE_MS } from "../../../studio/src/motion-capture.mjs";
import { captureCopy } from "../../../studio/src/capture-copy.mjs";

function take({ offset = 0, reverse = false, duration = 1500, fixed = false } = {}) {
    const recording = new MotionTake(0);
    for (let time = 0; time <= duration; time += 30) {
        const progress = fixed ? 0 : Math.min(1, Math.max(0, (time - 150) / (duration - 300)));
        recording.observe({ x: 4.5 + offset, y: 7 - (reverse ? 1 - progress : progress) * 6, confidence: 1 }, time);
    }
    return recording;
}
const traces = () => [take().finish(1500), take({offset:.2}).finish(1500), take({offset:-.2}).finish(1500)];
const options = {landmark:"left_wrist",id:"learned",name:"Raise"};

test("capture instructions and error recovery have matching English/French keys",()=>{
    assert.deepEqual(Object.keys(captureCopy.en).sort(),Object.keys(captureCopy.fr).sort());
    for(const language of Object.values(captureCopy)) for(const value of Object.values(language)) assert.ok(value.trim());
});

test("arc-length comparison accepts the same movement at different speeds", () => {
    const first = take().finish(1500), slow = take({duration:3000,offset:.2}).finish(3000);
    assert.doesNotThrow(() => compareTake([first], slow));
    assert.equal(first.length, 25);
});
test("opposite direction and displaced repetitions require a retry", () => {
    const first = take().finish(1500);
    assert.throws(() => compareTake([first], take({reverse:true}).finish(1500)), /captureMismatch/);
    assert.throws(() => compareTake([first], take({offset:4}).finish(1500)), /captureMismatch/);
});
test("stationary, tiny and too short movements cannot become bindings", () => {
    assert.throws(() => take({fixed:true}).finish(1500), /captureNoMotion/);
    assert.throws(() => take({duration:180}).finish(180), /captureTooShort/);
});
test("lost tracking and implausible jumps do not connect unrelated path segments", () => {
    const lost = take(); lost.observe({x:4.5,y:1},2000);
    assert.throws(() => lost.finish(2000), /captureTrackingLost/);
    assert.throws(() => take().finish(1800), /captureTrackingLost/);
    const jump = new MotionTake(0);
    jump.observe({x:1,y:1},0);jump.observe({x:10,y:10},30);
    assert.throws(() => jump.finish(30), /captureJump/);
});
test("invalid points and duplicate clocks do not fill a recording with fake observations", () => {
    const recording = new MotionTake(0);
    for (const point of [null,{x:NaN,y:0},{x:19,y:0},{x:1,y:2,confidence:.2}]) recording.observe(point,30);
    assert.equal(recording.samples.length,0);
    recording.observe({x:4,y:5},60);recording.observe({x:5,y:6},60);
    assert.equal(recording.samples.length,1);
});
test("sampling storage is bounded even on high refresh rate cameras", () => {
    const recording = new MotionTake(0);
    for (let t=0;t<=TAKE_MS+1000;t++) recording.observe({x:4,y:5},t);
    assert.ok(recording.samples.length <= 170);
    assert.ok(recording.samples.every(p => Object.keys(p).sort().join() === "time,x,y"));
});
test("all presets produce one body-part route with one terminal trigger and nested margins", () => {
    const profiles=["precise","normal","tolerant"].map(preset => mergeTakes(traces(), {...options,preset}));
    const lists=profiles.map(p => p.steps[0].constraints);
    assert.ok(lists[0].length>=3);
    assert.ok(lists.every(list => list.filter(c => c.type === "trigger").length===1));
    for(let i=0;i<lists[0].length;i++) {
        for(let p=0;p<2;p++) {
            const a=lists[p][i].cell,b=lists[p+1][i].cell;
            assert.ok(b[0]<=a[0] && b[1]<=a[1] && b[0]+b[2]>=a[0]+a[2] && b[1]+b[3]>=a[1]+a[3]);
        }
        assert.equal(lists[0][i].landmark,"left_wrist");
    }
    assert.ok(lists.every(list => list.at(-1).type === "trigger"));
});
test("broad start and finish regions must not overlap", () => {
    const short=traces().map(trace => trace.map(p => ({x:p.x,y:4+(p.y-4)*.35})));
    assert.throws(() => mergeTakes(short,{...options,preset:"tolerant"}),/captureOverlap/);
});
test("the state machine counts down, stops without frames, and retains good takes on retry", () => {
    const sequence=new CaptureSequence();sequence.start(0);
    sequence.tick(2999);assert.equal(sequence.phase,"countdown");
    sequence.tick(3000);assert.equal(sequence.phase,"recording");
    sequence.tick(8000);assert.equal(sequence.phase,"ready");assert.equal(sequence.error,"captureTrackingLost");
    sequence.start(9000);sequence.tick(12000);
    for(const p of take().samples) sequence.observe(p,12000+p.time);
    sequence.finish(13500);assert.equal(sequence.takes.length,1);
    sequence.start(14000);sequence.tick(17000);
    for(const p of take({reverse:true}).samples) sequence.observe(p,17000+p.time);
    sequence.finish(18500);assert.equal(sequence.takes.length,1);assert.equal(sequence.error,"captureMismatch");
    sequence.cancel();assert.equal(sequence.phase,"cancelled");assert.equal(sequence.takes.length,0);
});

test("a curved route retains intermediate checkpoints instead of becoming a start/end shortcut",()=>{
    const takes=[0,.1,-.1].map(offset=>{
        const recording=new MotionTake(0);
        for(let t=0;t<=1800;t+=30) {
            const fraction=Math.min(1,Math.max(0,(t-150)/1500));
            recording.observe({x:2+6*Math.min(fraction*2,1)+offset,y:7-6*Math.max(0,fraction*2-1)},t);
        }
        return recording.finish(1800);
    });
    const movement=mergeTakes(takes,{...options,preset:"precise"});
    const cells=movement.steps[0].constraints.map(c=>c.cell);
    assert.ok(cells.length>3);
    assert.ok(cells.some(([x,y])=>x>=7 && y>=6),"the corner must remain in the learnt route");
});

test("stationary lead-in and tail do not outweigh the demonstrated movement",()=>{
    const recording=new MotionTake(0);
    for(let t=0;t<=TAKE_MS;t+=30) recording.observe({x:4.5,y:7-6*Math.min(1,Math.max(0,(t-1500)/1200))},t);
    const short=take().finish(1500), padded=recording.finish(4980);
    assert.doesNotThrow(()=>compareTake([short],padded));
});
