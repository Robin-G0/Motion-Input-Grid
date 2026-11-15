import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {drawOverlay} from '../../../examples/web/overlay.mjs';
import {verifyPresentationProfiles} from './presentation_profile_tests.mjs';
let resized = 0;
const canvas = {
  _width: 0, _height: 0,
  get width() {return this._width;},
  set width(value) {this._width = value; ++resized;},
  get height() {return this._height;},
  set height(value) {this._height = value; ++resized;},
  getContext() {return {clearRect() {}};},
};
const video = {videoWidth: 640, videoHeight: 480};
drawOverlay(canvas, video, {landmarks: []}, null);
drawOverlay(canvas, video, {landmarks: []}, null);
assert.equal(resized, 2, 'Stable video dimensions must not resize the overlay each frame');
const modulePath = process.argv[2] ?? 'build/web/web/mig.mjs';
const {default:createMIG} = await import(pathToFileURL(modulePath));
const module = await createMIG();
const tracker = new module.Tracker();
try {
  const config = await readFile('configs/default.json','utf8');
  assert.equal(tracker.load(config), '');
  assert.equal(tracker.trackHands(), false);
  assert.equal(tracker.grid(false), null);
  assert.equal(tracker.grid(true), null);
  assert.equal(JSON.parse(tracker.exportConfig()).inputs[0].id, 'left_raise');
  assert.notEqual(tracker.load('{"schema_version":1,"inputs":[]}'), '');
  assert.equal(JSON.parse(tracker.exportConfig()).inputs[0].id, 'left_raise');
  let actions = 0;
  for(let t=20;t<=1800;t+=20) {
    const points = tracker.bodyBuffer(); points.fill(0);
    const put = (index,x,y,z=.1) => {points.set([x,y,z,1,.2,-.3,.4,1],index*8);};
    put(11,.65,.45); put(12,.35,.45);
    const row = t<1200?5.5:t<1400?4.5:2.5;
    put(15,.62,.45+(row-3.5)*.06);
    const count = tracker.update(t,t/20,1,0,0);
    assert.ok(count>=0);
    for(let i=0;i<count;++i) {
      assert.equal(tracker.eventAction(i),'left_raise'); assert.equal(tracker.eventId(i),'left_raise'); ++actions;
    }
  }
  assert.equal(actions,1);
  const grid = tracker.grid(false), reference = tracker.grid(true);
  assert.ok(Math.abs(grid.centerX-.5)<1e-6);
  assert.ok(Math.abs(grid.centerY-.45)<1e-6);
  assert.ok(Math.abs(grid.scale-.06)<1e-6);
  assert.equal(grid.aspect,1);
  assert.deepEqual(grid,reference);
  tracker.recalibrate();
  assert.equal(tracker.grid(false),null);
  const image = tracker.coordinate(15,0), world = tracker.coordinate(15,2);
  assert.ok(Math.abs(image.z-.1)<1e-6); assert.ok(Math.abs(world.y-.3)<1e-6);
  assert.equal(tracker.coordinate(100,0),null);
  assert.equal(tracker.update(NaN,1,1,0,0),-1);
  assert.equal(tracker.active(100),false);
  const withHands = JSON.parse(config); withHands.tracking.hands = true;
  assert.equal(tracker.load(JSON.stringify(withHands)), '');
  assert.equal(tracker.trackHands(), true);
  const handBuffer = tracker.handBuffer(); handBuffer.fill(0);
  for(let joint=0;joint<21;++joint) handBuffer.set([.62,.39,-.1,.1,-.2,.3],joint*6);
  assert.equal(tracker.update(2000,100,1,1,1),0);
  assert.ok(Math.abs(tracker.handCoordinate(0,8,0).z+.1)<1e-6);
  assert.ok(Math.abs(tracker.handCoordinate(0,8,2).y-.2)<1e-6);
  assert.equal(tracker.handCoordinate(1,8,0),null);
  tracker.update(2020,101,1,0,0);
  assert.equal(tracker.handCoordinate(0,8,0),null);
  const extended = JSON.parse(config);
  extended.inputs[0].steps[0].constraints[0].cell = [-9,-9,27,27];
  assert.equal(tracker.load(JSON.stringify(extended)),'');
  const before = tracker.exportConfig();
  extended.inputs[0].steps[0].constraints[0].cell = [18,0];
  assert.notEqual(tracker.load(JSON.stringify(extended)),'');
  assert.equal(tracker.exportConfig(),before);
  assert.notEqual(tracker.load(' '.repeat(1024*1024+1)),'');
  console.log('WebAssembly: config import/export, failed-import preservation, XYZ, recognition and expanded grid passed');
} finally { tracker.delete(); }
await verifyPresentationProfiles(createMIG);
