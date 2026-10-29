import assert from "node:assert/strict";
import { test } from "node:test";
import { captureTrace, drawCaptureTrace } from "../../../studio/src/capture-preview.mjs";

test("visited cells fill fast segments and preserve the actual first and last cells",()=>{
    const trace=captureTrace([{x:1.2,y:2.4,time:0},{x:4.8,y:2.4,time:100}]);
    assert.deepEqual(trace.cells,[{x:1,y:2},{x:2,y:2},{x:3,y:2},{x:4,y:2}]);
    assert.deepEqual(trace.start,{x:1,y:2});assert.deepEqual(trace.end,{x:4,y:2});
    const loop=captureTrace([{x:1,y:2},{x:2,y:2},{x:1,y:2}]);
    assert.equal(loop.cells.length,2);assert.deepEqual(loop.end,loop.start);
});

test("invalid positions and tracking gaps do not draw fictitious intermediate cells",()=>{
    for(const middle of [null,{x:NaN,y:0},{x:20,y:0}]) {
        assert.deepEqual(captureTrace([{x:1,y:2},middle,{x:4,y:2}]).cells,[{x:1,y:2},{x:4,y:2}]);
    }
    assert.deepEqual(captureTrace([{x:1,y:2,time:0},{x:4,y:2,time:200}]).cells,[{x:1,y:2},{x:4,y:2}]);
    assert.deepEqual(captureTrace([]),{cells:[],start:null,end:null});
});

test("previous routes are transparent and endpoints remain labeled without leaking canvas opacity",()=>{
    const labels=[],stack=[];
    const ctx={globalAlpha:1,save(){stack.push(this.globalAlpha);},restore(){this.globalAlpha=stack.pop();},
        beginPath(){},closePath(){},moveTo(){},lineTo(){},fill(){},stroke(){},setLineDash(){},translate(){},scale(){},fillRect(){},
        fillText(label){labels.push({label,alpha:this.globalAlpha});}};
    const canvas={width:400,height:300,getContext:()=>ctx,closest:()=>null};
    const geometry={transform:()=>({}),project:(x,y)=>({x:x/27,y:y/27})};
    const trace=captureTrace([{x:1,y:2},{x:4,y:2}]);
    drawCaptureTrace(canvas,geometry,1,"body",trace,{ghost:true,startLabel:"D",endLabel:"A"});
    assert.deepEqual(labels.map(p=>p.label),["D","A"]);
    assert.ok(labels.every(p=>p.alpha>0 && p.alpha<.3));assert.equal(ctx.globalAlpha,1);
    labels.length=0;drawCaptureTrace(canvas,geometry,1,"body",trace);
    assert.deepEqual(labels,[{label:"S",alpha:1},{label:"F",alpha:1}]);
});
