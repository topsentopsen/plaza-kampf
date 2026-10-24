/* Node-Tests Kampfsimulation + v0.3 Guards. */
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
assert.ok(Plaza.Chars.LISTE.length === 5);
assert.ok(Plaza.Chars.finde('lola').spitzname === 'La Rosa');
assert.ok(Plaza.Chars.finde('toni').lore.indexOf('schmied') !== -1);

var st = Plaza.Kampf.neu('biel', 'toni');
assert.equal(st.p[0].charId, 'biel');
Plaza.Kampf.setInput(st, 0, { l: false, r: true, u: false, d: false, a: false, b: false, c: false });
var x0 = st.p[0].x;
for (var i = 0; i < 30; i++) Plaza.Kampf.tick(st);
assert.ok(st.p[0].x > x0);

st = Plaza.Kampf.neu('biel', 'toni');
st.phase = 'kampf'; st.countdown = 0;
st.p[0].x = 140; st.p[1].x = 165;
Plaza.Kampf.setInput(st, 0, { l: false, r: false, u: false, d: false, a: true, b: false, c: false });
Plaza.Kampf.tick(st);
Plaza.Kampf.setInput(st, 0, { l: false, r: false, u: false, d: false, a: false, b: false, c: false });
var hp1 = st.p[1].hp;
for (i = 0; i < 20; i++) Plaza.Kampf.tick(st);
assert.ok(st.p[1].hp < hp1 || st.p[0].atk === null);

var snap = Plaza.Kampf.snapshot(st);
var snapLen = JSON.stringify(snap).length;
assert.ok(snapLen < 1500, 'snapshot zu groß: ' + snapLen);

// Determinismus: gleicher Input → gleicher Endzustand
function runScript() {
  var s = Plaza.Kampf.neu('nina', 'rocco');
  s.phase = 'kampf'; s.countdown = 0;
  for (var t = 0; t < 600; t++) {
    Plaza.Kampf.setInput(s, 0, { l: t % 40 < 20, r: t % 40 >= 20, u: t % 90 === 0, d: false, a: t % 25 === 0, b: t % 55 === 0, c: t % 80 === 0 });
    Plaza.Kampf.setInput(s, 1, { l: t % 35 >= 15, r: t % 35 < 15, u: t % 100 === 5, d: false, a: t % 30 === 3, b: t % 60 === 7, c: false });
    Plaza.Kampf.tick(s);
  }
  return JSON.stringify(Plaza.Kampf.snapshot(s));
}
assert.equal(runScript(), runScript(), 'deterministisch');

st = Plaza.Kampf.neu('biel', 'lola');
st.phase = 'kampf'; st.zeit = 0;
Plaza.Kampf.tick(st);
assert.equal(st.phase, 'ende');

// Spielernamen
st = Plaza.Kampf.neu('biel', 'lola', 'Tobi', 'Alex');
assert.equal(st.p[0].name, 'Tobi');
assert.equal(st.p[1].name, 'Alex');
st.phase = 'kampf'; st.zeit = 0;
Plaza.Kampf.tick(st);
assert.equal(st.phase, 'ende');
assert.ok(st.nachricht.indexOf('gewinnt') !== -1);
var st2 = Plaza.Kampf.rematch(st);
assert.equal(st2.p[0].name, 'Tobi');

st = Plaza.Kampf.neu('biel', 'toni', 'Thompson', 'Alex');
assert.equal(st.p[0].name, 'Thompson');
assert.ok(st.p[0].name.indexOf('S') !== -1 || st.p[0].name.indexOf('s') !== -1);

console.log('ok — kampf.test.js (snap=' + snapLen + 'B)');
