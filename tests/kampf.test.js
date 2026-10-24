/* Einfache Node-Tests für die Kampfsimulation. */
var assert = require('assert');
var path = require('path');
var root = path.join(__dirname, '..');

// Scripts als IIFE mit globalThis laden
var fs = require('fs');
var vm = require('vm');
var ctx = { console: console, Math: Math, performance: { now: Date.now } };
ctx.globalThis = ctx;
ctx.window = ctx;
function load(rel) {
  var code = fs.readFileSync(path.join(root, rel), 'utf8');
  vm.runInNewContext(code, ctx, rel);
}
load('js/chars.js');
load('js/kampf.js');

var Plaza = ctx.Plaza;
assert.ok(Plaza.Chars.LISTE.length === 5, '5 chars');
assert.ok(Plaza.Chars.finde('lola').name === 'Lola');

var st = Plaza.Kampf.neu('biel', 'toni');
assert.equal(st.p[0].charId, 'biel');
assert.equal(st.p[1].charId, 'toni');
assert.ok(st.p[0].hp > 0 && st.p[1].hp > 0);

// Laufen nach rechts
Plaza.Kampf.setInput(st, 0, { l: false, r: true, u: false, d: false, a: false, b: false, c: false });
var x0 = st.p[0].x;
for (var i = 0; i < 30; i++) Plaza.Kampf.tick(st);
assert.ok(st.p[0].x > x0, 'bewegt sich nach rechts');

// Leichter Treffer: nah ran, schlagen
st = Plaza.Kampf.neu('biel', 'toni');
st.phase = 'kampf';
st.countdown = 0;
st.p[0].x = 140; st.p[1].x = 165;
Plaza.Kampf.setInput(st, 0, { l: false, r: false, u: false, d: false, a: true, b: false, c: false });
Plaza.Kampf.tick(st);
Plaza.Kampf.setInput(st, 0, { l: false, r: false, u: false, d: false, a: false, b: false, c: false });
var hp1 = st.p[1].hp;
for (i = 0; i < 20; i++) Plaza.Kampf.tick(st);
assert.ok(st.p[1].hp < hp1 || st.p[0].atk === null, 'Angriff läuft / Schaden möglich');

// Snapshot serialisierbar
var snap = Plaza.Kampf.snapshot(st);
assert.ok(snap.p.length === 2);
assert.ok(JSON.stringify(snap).length > 10);

// KO
st = Plaza.Kampf.neu('nina', 'rocco');
st.phase = 'kampf';
st.p[1].hp = 1;
st.p[0].x = 150; st.p[1].x = 170;
Plaza.Kampf.setInput(st, 0, { l: false, r: false, u: false, d: false, a: false, b: true, c: false });
for (i = 0; i < 40; i++) Plaza.Kampf.tick(st);
// Zeit-Ende
st = Plaza.Kampf.neu('biel', 'lola');
st.phase = 'kampf';
st.zeit = 0;
Plaza.Kampf.tick(st);
assert.equal(st.phase, 'ende');
assert.ok(st.sieger === 0 || st.sieger === 1);

console.log('ok — kampf.test.js');
