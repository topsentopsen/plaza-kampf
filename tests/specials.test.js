/* v4.0: feste Motion-Specials (Hadoken-Stil), Host liest nur den Input-Strom. */
'use strict';
var assert = require('assert');
var fs = require('fs');
var path = require('path');
var vm = require('vm');
var root = path.join(__dirname, '..');
var ctx = { console: console, Math: Math, performance: { now: Date.now } };
ctx.globalThis = ctx; ctx.window = ctx;
function load(rel) {
  vm.runInNewContext(fs.readFileSync(path.join(root, rel), 'utf8'), ctx, rel);
}
load('js/palette.js'); load('js/chars.js'); load('js/kampf.js');
var Plaza = ctx.Plaza;
var idle = { l: false, r: false, u: false, d: false, a: false, b: false, c: false };
function I(o) {
  var x = { l: false, r: false, u: false, d: false, a: false, b: false, c: false };
  for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) x[k] = o[k];
  return x;
}
function step(st, side, inp) {
  Plaza.Kampf.setInput(st, side, inp);
  Plaza.Kampf.setInput(st, 1 - side, idle);
  Plaza.Kampf.tick(st);
}
function hold(st, side, inp, n) {
  for (var i = 0; i < n; i++) step(st, side, inp);
}
function fight(a, b) {
  var st = Plaza.Kampf.neu(a, b, 'A', 'B');
  st.phase = 'kampf'; st.countdown = 0;
  st.p[0].x = 280; st.p[1].x = 1000;
  return st;
}

// ↓↘→ + A → Signatur-Special (Nina, Blick nach rechts)
var st = fight('nina', 'toni');
hold(st, 0, I({ d: true }), 4);
hold(st, 0, I({ d: true, r: true }), 3);
step(st, 0, I({ r: true, a: true }));
assert.ok(st.p[0].atk && st.p[0].atk.art === 'special', 'QCF+A special, got ' + (st.p[0].atk && st.p[0].atk.art));
assert.ok(st.p[0].bn.indexOf('Sonnen') !== -1, 'Name-Flash');
assert.ok(st.p[0].bt > 0, 'Banner-Timer');

// Tastatur-Kurzform ↓→ + A
st = fight('nina', 'toni');
hold(st, 0, I({ d: true }), 3);
step(st, 0, I({ r: true, a: true }));
assert.equal(st.p[0].atk && st.p[0].atk.art, 'special', '26+A Kurzform');

// Zu langsame Kombi verfällt → normaler Punch
st = fight('nina', 'toni');
hold(st, 0, I({ d: true }), 3);
hold(st, 0, I({ r: true }), 20);
step(st, 0, I({ a: true }));
assert.equal(st.p[0].atk && st.p[0].atk.art, 'light', 'abgelaufene Kombi ist Light');

// Nacktes A bleibt Light. Ein Extra-Feld „special“ zündet nichts — nur der Input-Strom.
st = fight('biel', 'toni');
step(st, 0, I({ a: true, special: true }));
assert.equal(st.p[0].atk && st.p[0].atk.art, 'light', 'kein Client-Special-Flag');

// C bleibt die direkte Signatur
st = fight('biel', 'toni');
step(st, 0, I({ c: true }));
assert.equal(st.p[0].atk && st.p[0].atk.art, 'special', 'C = Special');

// ↓↙← + B → Biel Ankerhieb, auch aus der Block-Haltung
st = fight('biel', 'toni');
hold(st, 0, I({ d: true }), 4);
hold(st, 0, I({ d: true, l: true }), 3);
step(st, 0, I({ l: true, b: true }));
assert.equal(st.p[0].atk && st.p[0].atk.art, 'special2', 'QCB+B special2');
assert.ok(st.p[0].bn.indexOf('Anker') !== -1, 'Ankerhieb Name');
assert.equal(st.p[0].facing, 1, 'QCB dreht das Facing nicht weg');

// Toni →↓↘ + A = Glutfaust, nicht der Erdstoß
st = fight('toni', 'lola');
hold(st, 0, I({ r: true }), 3);
hold(st, 0, I({ d: true }), 3);
step(st, 0, I({ d: true, r: true, a: true }));
assert.equal(st.p[0].atk && st.p[0].atk.art, 'special2', 'DP+A Glutfaust');
assert.ok(st.p[0].bn.indexOf('Glut') !== -1);

// Falsche Reihenfolge
st = fight('toni', 'lola');
hold(st, 0, I({ r: true }), 3);
hold(st, 0, I({ d: true }), 2);
step(st, 0, I({ a: true }));
assert.equal(st.p[0].atk && st.p[0].atk.art, 'light', 'halbe DP ist kein Special');

// Blick nach links: vorwärts ist ← 
st = fight('lola', 'rocco');
hold(st, 1, I({ d: true }), 4);
hold(st, 1, I({ d: true, l: true }), 3);
step(st, 1, I({ l: true, a: true }));
assert.equal(st.p[1].atk && st.p[1].atk.art, 'special', 'QCF spiegelverkehrt');
assert.equal(st.p[1].facing, -1);

// Jeder Kämpfer hat zwei feste Kombis, keine Zufalls-Liste
Plaza.Chars.LISTE.forEach(function (c) {
  assert.ok(c.motions && c.motions.length >= 2, c.id + ' motions');
  c.motions.forEach(function (m) {
    assert.ok(m.seq && m.seq.length >= 3, c.id + ' seq');
    assert.ok(m.art === 'special' || m.art === 'special2');
    assert.ok(c.moves[m.art], c.id + ' move ' + m.art);
  });
});

var kampfSrc = fs.readFileSync(path.join(root, 'js/kampf.js'), 'utf8');
assert.ok(kampfSrc.indexOf('tryMotion') !== -1 && kampfSrc.indexOf('motionOk') !== -1);
assert.ok(kampfSrc.indexOf('Math.random') === -1, 'keine Zufalls-Kombis in der Sim');

var html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
assert.ok(html.indexOf('↓↘→') !== -1, 'Tutorial zeigt die Kombi');

console.log('ok — specials.test.js');
