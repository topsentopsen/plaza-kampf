/* v4.0: Rückwärtslauf in Block-Stance + Pause-Menü Guards. */
'use strict';
var assert = require('assert');
var path = require('path');
var fs = require('fs');
var vm = require('vm');
var root = path.join(__dirname, '..');
var ctx = { console: console, Math: Math, performance: { now: Date.now } };
ctx.globalThis = ctx; ctx.window = ctx;
function load(rel) {
  vm.runInNewContext(fs.readFileSync(path.join(root, rel), 'utf8'), ctx, rel);
}
load('js/palette.js');
load('js/chars.js');
load('js/kampf.js');
var Plaza = ctx.Plaza;

var st = Plaza.Kampf.neu('biel', 'toni');
st.phase = 'kampf'; st.countdown = 0;
st.p[0].x = 400; st.p[1].x = 700;
st.p[0].facing = 1; st.p[1].facing = -1;
var x0 = st.p[0].x;
// left = away from opponent when facing right → block stance + backwalk
Plaza.Kampf.setInput(st, 0, { l: true, r: false, u: false, d: false, a: false, b: false, c: false });
Plaza.Kampf.setInput(st, 1, { l: false, r: false, u: false, d: false, a: false, b: false, c: false });
for (var i = 0; i < 25; i++) Plaza.Kampf.tick(st);
assert.equal(st.p[0].blocking, true, 'p0 blocking when holding away');
assert.ok(st.p[0].x < x0 - 5, 'backwalk: x ' + st.p[0].x + ' from ' + x0);
assert.equal(st.p[0].facing, 1, 'facing stays toward opponent while backwalking');

// crouch-backwalk slower but still moves
st = Plaza.Kampf.neu('biel', 'toni');
st.phase = 'kampf'; st.countdown = 0;
st.p[0].x = 400; st.p[1].x = 700; st.p[0].facing = 1;
x0 = st.p[0].x;
Plaza.Kampf.setInput(st, 0, { l: true, r: false, u: false, d: true, a: false, b: false, c: false });
for (i = 0; i < 25; i++) Plaza.Kampf.tick(st);
assert.ok(st.p[0].blocking, 'crouch block');
assert.ok(st.p[0].x < x0 - 1, 'crouch backwalk moves');

var main = fs.readFileSync(path.join(root, 'js/main.js'), 'utf8');
assert.ok(/VERSION = 'v4\.0'/.test(main), 'VERSION v4.0');
assert.ok(main.indexOf('onPause:') !== -1 && main.indexOf('onAbort:') !== -1);
assert.ok(main.indexOf('&& !paused') !== -1, 'freeze while paused');
assert.ok(main.indexOf('netz.trennen()') !== -1, 'abort disconnect');

var ui = fs.readFileSync(path.join(root, 'js/ui.js'), 'utf8');
assert.ok(ui.indexOf('setPauseBtn') !== -1 && ui.indexOf('onPause') !== -1);
assert.ok(ui.indexOf("e.key !== 'Escape'") !== -1);

var html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
assert.ok(html.indexOf('id="btn-pause"') !== -1);
assert.ok(html.indexOf('data-screen="pause"') !== -1);
assert.ok(html.indexOf('data-act="abort"') !== -1);
assert.ok(html.indexOf('js/main.js?v=4.0') !== -1);

var netz = fs.readFileSync(path.join(root, 'js/netz.js'), 'utf8');
assert.ok(netz.indexOf("VERSION_Q = '4.0'") !== -1);

console.log('ok — backwalk-pause.test.js');
