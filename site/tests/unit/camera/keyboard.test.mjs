import assert from "node:assert/strict";
import { test } from "node:test";
import { eventChord, validateKeyboard, keyboardSummary } from "../../../studio/src/keyboard.mjs";
import { controllerDownloads } from "../../../studio/src/controller-downloads.mjs";

test("keyboard sequences retain repeated presses and simultaneous chords without sending keys",()=>{
    const movement={keyboard:[{keys:[17,67]},{keys:[67]},{keys:[67]},{text:"Hello\nworld"}],action_mode:"single_press"};
    assert.equal(validateKeyboard(movement),movement);
    assert.match(keyboardSummary(movement),/Ctrl \+ C → C → C → "Hello\\nworld"/);
    assert.deepEqual(eventChord({key:"c",ctrlKey:true,shiftKey:true}),[17,16,67]);
    assert.equal(eventChord({key:"Dead",ctrlKey:false}),null);
    assert.equal(eventChord({key:"Control",ctrlKey:true}),null);
});
test("keyboard validation catches native limits and invalid hold sequences",()=>{
    for(const keyboard of [[{keys:[]}],[{keys:[17,17]}],[{keys:[256]}],[{text:"\0"}],[{text:"x",keys:[65]}]]) assert.throws(()=>validateKeyboard({keyboard}),/keyboardInvalid/);
    assert.throws(()=>validateKeyboard({keyboard:[{text:"x"}],action_mode:"hold"}),/holdNeedsKeys/);
    assert.throws(()=>validateKeyboard({keyboard:[{text:"é".repeat(8193)}]}),/keyboardLimit/);
    assert.throws(()=>validateKeyboard({keyboard:[{keys:[65]}],action_mode:"repeat",repeat_interval_ms:19}),/keyboardInterval/);
    assert.doesNotThrow(()=>validateKeyboard({keyboard:[{text:"Ready"},{keys:[16]}],action_mode:"hold"}));
    assert.doesNotThrow(()=>validateKeyboard({keyboard:[{keys:[39]}],action_mode:"repeat"}));
});
test("Controller downloads only link real published Controller-only assets from the official repository",()=>{
    const url=name=>`https://github.com/Robin-G0/Motion-Input-Grid/releases/download/v2/${name}`;
    const windows="motion-input-grid-controller-windows-x64.exe", linux="motion-input-grid-controller-linux-x64.run";
    const release={assets:[windows,linux,"motion-input-grid-windows-x64-native.zip"].map(name=>({name,browser_download_url:url(name)}))};
    assert.deepEqual(controllerDownloads(release),{windows:url(windows),linux:url(linux)});
    assert.deepEqual(controllerDownloads({assets:[{name:windows,browser_download_url:"https://example.org/file.exe"}]}),{});
    assert.deepEqual(controllerDownloads({assets:[]}),{});
});
