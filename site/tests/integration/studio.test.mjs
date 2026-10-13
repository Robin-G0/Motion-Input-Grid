import assert from "node:assert/strict";
import { test } from "node:test";
import createMIG from "../../dist/mig/mig.mjs";
import { starter, newInput, addRegion, pasteRegion, parseProfile, parseDraft, ProfileHistory, MAX_BYTES } from "../../studio/src/profile.mjs";

test("unfinished drafts restore without execution validation while damaged draft structures stay rejected", async () => {
    const draft = {schema_version:2,tracking:{hands:false},inputs:[newInput()]};
    assert.deepEqual(parseDraft(JSON.stringify(draft)),draft);
    const module = await createMIG(), tracker = new module.Tracker();
    try { assert.notEqual(tracker.load(JSON.stringify(draft)), ""); } finally { tracker.delete(); }
    const broken = structuredClone(draft); broken.inputs[0].steps = [null];
    assert.throws(() => parseDraft(JSON.stringify(broken)), /draftUnreadable/);
    assert.throws(() => parseDraft(JSON.stringify({...draft,inputs:[null]})), /draftUnreadable/);
    const advanced = starter(); advanced.inputs[0].steps.push({id:"unfinished",mode:"simultaneous",constraints:[],hold_ms:100});
    advanced.inputs[0].mirror = true;
    assert.deepEqual(parseDraft(JSON.stringify(advanced)),advanced);
});
import { PreviewGrid, trackedPoint } from "../../studio/src/camera.mjs";
import { copy } from "../../studio/src/copy.mjs";
import { NoteLayer, lineCells, previewCell } from "../../studio/src/notes.mjs";
import { setFingerRule } from "../../studio/src/fingers.mjs";
import { transformRect, selectionRect, transformSelection, RegionHighlights } from "../../studio/src/grid.mjs";

test("camera region feedback follows each reliable landmark, fades after leaving and confirms only the native action zone", () => {
    const input = {id:"move",space:"body",steps:[{constraints:[
        {id:"pass",landmark:"left_wrist",type:"required",cell:[2,3,1,1]},
        {id:"action",landmark:"right_wrist",type:"trigger",cell:[4,3,1,1]}
    ]}]};
    const geometry = {local:(x,y) => ({x,y})};
    let reliable = true;
    const session = {coordinate:index => ({x:index === 15 ? 2.5 : 10,y:3.5,confidence:reliable ? 1 : .1})};
    const feedback = new RegionHighlights();
    feedback.observe(input,session,geometry,1,100);
    assert.equal(feedback.intensity("pass",100),1); assert.equal(feedback.intensity("action",100),0);
    reliable = false; feedback.observe(input,session,geometry,1,200);
    assert.equal(feedback.intensity("pass",325),.5);
    assert.equal(feedback.intensity("pass",325,true),1);
    assert.equal(feedback.intensity("pass",551),0);
    feedback.confirm(input,600);
    assert.equal(feedback.intensity("action",600),1);
    assert.equal(feedback.intensity("action",1075),.5);
    assert.equal(feedback.intensity("action",1301,true),0);
    feedback.observe({...input,id:"other"},session,geometry,1,700);
    assert.equal(feedback.intensity("action",700),0);
    feedback.reset(); assert.equal(feedback.intensity("pass",700),0);
});

test("region moves and corner resizing preserve dimensions and stay within native grid bounds", () => {
    const rect = {x:2,y:3,w:3,h:2};
    assert.deepEqual(transformRect(rect, "move", 2, -1), {x:4,y:2,w:3,h:2});
    assert.deepEqual(transformRect(rect, "move", -100, 100), {x:-9,y:16,w:3,h:2});
    assert.deepEqual(transformRect(rect, "nw", -2, -1), {x:0,y:2,w:5,h:3});
    assert.deepEqual(transformRect(rect, "se", 100, -100), {x:2,y:3,w:16,h:1});
    assert.deepEqual(transformRect(rect, "nw", 100, 100), {x:4,y:4,w:1,h:1});
    assert.deepEqual(rect, {x:2,y:3,w:3,h:2});
});
test("group transforms preserve relative positions when moved and stay aligned to whole cells when resized", () => {
    const selected = [{cell:[2,3,1,1]},{cell:[4,3,1,1]}];
    const original = selectionRect(selected);
    assert.deepEqual(original,{x:2,y:3,w:3,h:1});
    transformSelection(selected,original,{x:3,y:4,w:3,h:1});
    assert.deepEqual(selected.map(region => region.cell),[[3,4,1,1],[5,4,1,1]]);
    transformSelection(selected,selectionRect(selected),{x:3,y:4,w:1,h:1});
    assert.deepEqual(selected.map(region => region.cell),[[3,4,1,1],[3,4,1,1]]);
});
test("pasting keeps detailed rules, gives a fresh identity and places required regions before the trigger", async () => {
    const profile = starter(), movement = profile.inputs[0], source = movement.steps[0].constraints[0];
    source.fingers = [{hand:"left",finger:"thumb",pose:"extended",stable_ms:150,grace_ms:100}];
    profile.tracking.hands = true;
    const before = structuredClone(source);
    const pastedId = pasteRegion(movement, "0", source, -1);
    const pasted = movement.steps[0].constraints.find(region => region.id === pastedId);
    assert.notEqual(pasted.id, source.id);
    assert.deepEqual(pasted.cell, [-9,5,27,4]);
    assert.deepEqual(pasted.fingers, source.fingers);
    assert.notEqual(pasted.fingers, source.fingers);
    assert.equal(pasted.order, 2); assert.equal(movement.steps[0].constraints[1].order, 3);
    assert.deepEqual(source, before);
    const module = await createMIG(), tracker = new module.Tracker();
    try { assert.equal(tracker.load(JSON.stringify(profile)), ""); } finally {tracker.delete();}
    assert.throws(() => pasteRegion(movement,"0",movement.steps[0].constraints[1]), /oneTrigger/);
    assert.throws(() => pasteRegion(newInput(),"0",{...source,priority:"low",tolerance_for:source.id}), /copyReference/);
});

test("the Studio starter really emits its action through published MIG on landscape and portrait cameras", async () => {
    const module = await createMIG();
    for (const aspect of [16 / 9, 9 / 16, 1]) {
        const tracker = new module.Tracker();
        try {
            assert.equal(tracker.load(JSON.stringify(starter())), "");
            let time = 0, sequence = 0;
            const observe = row => {
                const buffer = tracker.bodyBuffer(); buffer.fill(0);
                const put = (index, x, y) => buffer.set([x, y, 0, 1, 0, 0, 0, 0], index * 8);
                put(11, .65, .45); put(12, .35, .45);
                put(15, .5, .45 + (row - 3.5) * .06 * aspect);
                const count = tracker.update(time += 50, ++sequence, aspect, 0, 0);
                return Array.from({ length: count }, (_, i) => tracker.eventAction(i));
            };
            for (let i = 0; i < 30; i++) assert.deepEqual(observe(5.5), []);
            assert.deepEqual(observe(3.5), []);
            assert.deepEqual(observe(1.5), ["hand_raised"]);
            for (let i = 0; i < 20; i++) assert.deepEqual(observe(1.5), []);
        } finally { tracker.delete(); }
    }
});
test("published MIG distinguishes unordered visits, simultaneous occupancy and independent ordered landmark lanes", async () => {
    const module = await createMIG();
    const run = (mode, constraints, observations) => {
        const tracker = new module.Tracker();
        try {
            const profile = {schema_version:2,tracking:{hands:false},inputs:[{...newInput(),cooldown_ms:0,steps:[{id:"step",mode,constraints}]}]};
            assert.equal(tracker.load(JSON.stringify(profile)), "");
            let time = 0, sequence = 0;
            const observe = (left, right) => {
                const buffer = tracker.bodyBuffer(); buffer.fill(0);
                const put = (i,x,y) => buffer.set([x,y,0,1,0,0,0,0],i*8);
                put(11,.65,.45); put(12,.35,.45);
                for (const [i,point] of [[15,left],[16,right]]) put(i,.5+(point[0]-4.5)*.06,.45+(point[1]-3.5)*.06);
                return tracker.update(time+=50,++sequence,1,0,0);
            };
            for(let i=0;i<30;i++) assert.equal(observe([4.5,8.5],[4.5,8.5]),0);
            return observations.map(([left,right]) => observe(left,right));
        } finally { tracker.delete(); }
    };
    const region = (id,landmark,x,y,order=0) => ({id,landmark,cell:[x,y,1,1],type:"required",priority:"high",order});
    const both = [region("left","left_wrist",6,3),region("right","right_wrist",2,3)];
    const alternate = [[[6.5,3.5],[2.5,5.5]],[[6.5,5.5],[2.5,3.5]],[[6.5,3.5],[2.5,3.5]]];
    assert.deepEqual(run("visited",both,alternate.slice(0,2)),[0,1]);
    assert.deepEqual(run("simultaneous",both,alternate),[0,0,1]);
    const route = [region("first","left_wrist",6,5,1),region("second","left_wrist",6,3,2)];
    const reversed = [[[6.5,3.5],[2.5,8.5]],[[6.5,5.5],[2.5,8.5]]];
    assert.deepEqual(run("visited",route.map(region => ({...region,order:0})),reversed),[0,1]);
    assert.deepEqual(run("ordered",route,[...reversed,[[6.5,3.5],[2.5,8.5]]]),[0,0,1]);
    const parallel = [...route,region("right-first","right_wrist",2,5,1),region("right-second","right_wrist",2,3,2)];
    assert.deepEqual(run("ordered",parallel,[[[6.5,5.5],[2.5,5.5]],[[6.5,5.5],[2.5,3.5]],[[6.5,3.5],[2.5,3.5]]]),[0,0,1]);
    const alternatives = [...route,region("alternative","left_wrist",7,5,1)];
    assert.deepEqual(run("ordered",alternatives,[[[7.5,5.5],[2.5,8.5]],[[6.5,3.5],[2.5,8.5]]]),[0,1]);
});

test("visual editing preserves advanced options across undo and redo; imports stay bounded", () => {
    const profile = starter();
    profile.inputs[0].keyboard = [{ text: "Example" }];
    const history = new ProfileHistory(profile);
    const next = structuredClone(profile); next.inputs[0].name = "Edited";
    assert.equal(history.commit(next), true);
    assert.deepEqual(history.value.inputs[0].keyboard, [{ text: "Example" }]);
    history.undo(); assert.equal(history.value.inputs[0].name, profile.inputs[0].name);
    history.redo(); assert.equal(history.value.inputs[0].name, "Edited");
    assert.throws(() => parseProfile("{"), /json/);
    assert.throws(() => parseProfile('{"schema_version":1,"inputs":[]}'), /schema/);
    assert.throws(() => parseProfile(" ".repeat(MAX_BYTES + 1)), /size/);
});
test("drawn interaction profiles pass the native validator; global and duplicate triggers are refused", async () => {
    const movement = newInput();
    addRegion(movement, "0", [2, 4, 2, 1], { type: "required", landmark: "left_wrist" });
    addRegion(movement, "0", [2, 2, 2, 1], { type: "interaction", landmark: "left_wrist" });
    assert.throws(() => addRegion(movement, "0", [4, 2, 1, 1], { type: "trigger", landmark: "left_wrist" }), /oneTrigger/);
    assert.throws(() => addRegion(movement, "global", [4, 2, 1, 1], { type: "trigger", landmark: "left_wrist" }), /globalTrigger/);
    const module = await createMIG(), tracker = new module.Tracker();
    try { assert.equal(tracker.load(JSON.stringify({ schema_version: 2, tracking: { hands: true }, inputs: [movement] })), ""); }
    finally { tracker.delete(); }
});
test("preview coordinates retain the shoulder anchor and camera aspect without authorising actions", () => {
    for (const aspect of [16 / 9, 9 / 16]) {
        const grid = new PreviewGrid();
        for (let time = 0; time <= 1100; time += 50) grid.observe({ x: .65, y: .45, confidence: 1 }, { x: .35, y: .45, confidence: 1 }, aspect, time);
        assert.deepEqual(grid.project(4.5, 3.5, aspect), { x: .5, y: .45 });
        assert.ok(Math.abs(grid.project(5.5, 3.5, aspect).x - .56) < 1e-6);
        assert.equal(grid.observe(null, null, aspect, 1200), "missing");
        assert.equal(grid.project(4.5, 3.5, aspect), null);
        grid.reset(); assert.equal(grid.reference, null);
    }
});
test("Studio languages expose the same controls and recovery messages", () => {
    assert.deepEqual(Object.keys(copy.fr).sort(), Object.keys(copy.en).sort());
});
test("imported secondary landmarks and the head's nose fallback stay visible", () => {
    const session = { coordinate: index => index === 0 || index === 19 ? { x: .3, y: .4, confidence: 1 } : null };
    assert.deepEqual(trackedPoint(session, "left_index"), { x: .3, y: .4, confidence: 1 });
    assert.deepEqual(trackedPoint(session, "head"), { x: .3, y: .4, confidence: 1 });
    assert.equal(trackedPoint(session, "unknown"), null);
});
test("annotation coordinates match the grid in mirrored portrait and landscape previews", () => {
    for (const aspect of [16 / 9, 9 / 16]) {
        const geometry = new PreviewGrid();
        for (let time = 0; time <= 1100; time += 50) geometry.observe({ x: .65, y: .45, confidence: 1 }, { x: .35, y: .45, confidence: 1 }, aspect, time);
        const canvas = { getBoundingClientRect: () => ({ left: 12, top: 20, width: 800, height: 800 / aspect }) };
        for (const mirror of [false, true]) for (const space of ["body", "calibrated"]) {
            const point = geometry.project(2.5, 4.5, aspect, space);
            const event = { clientX: 12 + (mirror ? 1 - point.x : point.x) * 800, clientY: 20 + point.y * 800 / aspect };
            assert.deepEqual(previewCell(event, canvas, geometry, aspect, space, mirror), { x: 2, y: 4 });
        }
        geometry.reset(); assert.equal(previewCell({ clientX: 100, clientY: 100 }, canvas, geometry, aspect), null);
    }
});
test("notes align with contained video in a fixed frame and ignore its letterbox margins", () => {
    for (const aspect of [16 / 9, 9 / 16]) {
        const geometry = new PreviewGrid();
        for (let time = 0; time <= 1100; time += 50) geometry.observe({x:.65,y:.45,confidence:1}, {x:.35,y:.45,confidence:1}, aspect, time);
        const canvas = {getBoundingClientRect: () => ({left:12,top:20,width:800,height:500})};
        const width = Math.min(800, 500 * aspect), height = width / aspect;
        for (const mirror of [false, true]) for (const space of ["body", "calibrated"]) {
            const point = geometry.project(2.5, 4.5, aspect, space);
            const event = {clientX:12+(800-width)/2+(mirror?1-point.x:point.x)*width, clientY:20+(500-height)/2+point.y*height};
            assert.deepEqual(previewCell(event, canvas, geometry, aspect, space, mirror), {x:2,y:4});
        }
        assert.equal(previewCell({clientX:13,clientY:21}, canvas, geometry, aspect, "body"), null);
    }
});

test("notes stay separate per movement, cover fast strokes, survive reload and can be cleaned", () => {
    const layer = new NoteLayer();
    layer.paint("one", lineCells({ x: 0, y: 0 }, { x: 8, y: 8 }));
    layer.paint("two", [{ x: 4, y: 4 }]);
    assert.equal(layer.cells("one").length, 9);
    layer.paint("one", [{ x: 100, y: 100 }, { x: 1.5, y: 0 }]);
    assert.equal(layer.cells("one").length, 9);
    const saved = new NoteLayer(); saved.load(layer.serialize());
    saved.paint("one", [{ x: 4, y: 4 }], true);
    assert.equal(saved.cells("one").length, 8);
    saved.clear("one"); assert.deepEqual(saved.cells("one"), []);
    assert.deepEqual(saved.cells("two"), [{ x: 4, y: 4 }]);
    const configuration = starter(); assert.equal(Object.hasOwn(configuration, "notes"), false);
});
test("zone finger editing retains the other hand and native validation accepts its timing", async () => {
    const profile = starter(), region = profile.inputs[0].steps[0].constraints[0];
    profile.tracking.hands = true;
    setFingerRule(region, "left", "index", "extended", { stable_ms: 250, grace_ms: 90 });
    setFingerRule(region, "right", "thumb", "closed");
    setFingerRule(region, "left", "index", "closed");
    assert.equal(region.fingers.find(rule => rule.hand === "left").stable_ms, 250);
    setFingerRule(region, "left", "index", "");
    assert.deepEqual(region.fingers.map(rule => [rule.hand, rule.finger]), [["right", "thumb"]]);
    const module = await createMIG(), tracker = new module.Tracker();
    try { assert.equal(tracker.load(JSON.stringify(profile)), ""); }
    finally { tracker.delete(); }
});
