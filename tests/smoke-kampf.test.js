/* v1.9: Automatisierter Kampf-Smoke — alle Chars × Moves, Bounds, kein NaN. */
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
load('js/ki.js');

var Plaza = ctx.Plaza;
var IDS = Plaza.Chars.LISTE.map(function (c) { return c.id; });
var MOVES = ['a', 'b', 'c']; // light, heavy, special
var fails = [];

function finite(n, label) {
  if (typeof n !== 'number' || !isFinite(n)) fails.push(label + '=' + n);
}

function assertBounds(st, tag) {
  var A = Plaza.Kampf.ARENA || { w: 1280, h: 768 };
  var BODEN = Plaza.Kampf.BODEN;
  st.p.forEach(function (p, i) {
    finite(p.x, tag + '.p' + i + '.x');
    finite(p.y, tag + '.p' + i + '.y');
    finite(p.vx, tag + '.p' + i + '.vx');
    finite(p.vy, tag + '.p' + i + '.vy');
    finite(p.hp, tag + '.p' + i + '.hp');
    assert.ok(p.hp >= 0 && p.hp <= p.maxHp + 0.01, tag + ' hp ' + p.hp + '/' + p.maxHp);
    assert.ok(p.x >= -200 && p.x <= A.w + 200, tag + ' x out ' + p.x);
    assert.ok(p.y >= -400 && p.y <= BODEN + 80, tag + ' y out ' + p.y);
  });
  if (st.projektile) {
    st.projektile.forEach(function (pr, j) {
      finite(pr.x, tag + '.proj' + j + '.x');
      finite(pr.y, tag + '.proj' + j + '.y');
    });
  }
}

var empty = { l: false, r: false, u: false, d: false, a: false, b: false, c: false };
function inp(o) {
  return Object.assign({}, empty, o);
}

// 1) Jedes Char-Paar: kurze Walk + Light
IDS.forEach(function (a) {
  IDS.forEach(function (b) {
    var st = Plaza.Kampf.neu(a, b, 'A', 'B');
    st.phase = 'kampf'; st.countdown = 0;
    for (var t = 0; t < 40; t++) {
      Plaza.Kampf.setInput(st, 0, inp({ r: true, a: t === 10 }));
      Plaza.Kampf.setInput(st, 1, inp({ l: true }));
      Plaza.Kampf.tick(st);
      assertBounds(st, a + '-vs-' + b + '@' + t);
    }
  });
});

// 2) Jeder Char × Light/Heavy/Special gegen festen Dummy
IDS.forEach(function (id) {
  MOVES.forEach(function (taste) {
    var st = Plaza.Kampf.neu(id, 'toni', 'Atk', 'Dummy');
    st.phase = 'kampf'; st.countdown = 0;
    st.p[0].x = 500; st.p[1].x = 620;
    st.p[0].facing = 1; st.p[1].facing = -1;
    var o = {}; o[taste] = true;
    Plaza.Kampf.setInput(st, 0, inp(o));
    Plaza.Kampf.tick(st);
    Plaza.Kampf.setInput(st, 0, empty);
    for (var t = 0; t < 50; t++) {
      Plaza.Kampf.tick(st);
      assertBounds(st, id + '.' + taste + '@' + t);
    }
  });
});

// 3) Duck + Block + Jump
['biel', 'lola', 'nina'].forEach(function (id) {
  var st = Plaza.Kampf.neu(id, 'rocco', 'P', 'Q');
  st.phase = 'kampf'; st.countdown = 0;
  for (var t = 0; t < 30; t++) {
    Plaza.Kampf.setInput(st, 0, inp({ d: true, b: t > 10 && t < 20 }));
    Plaza.Kampf.setInput(st, 1, inp({ a: t === 15 }));
    Plaza.Kampf.tick(st);
    assertBounds(st, 'duck-' + id + '@' + t);
  }
  st = Plaza.Kampf.neu(id, 'toni', 'P', 'Q');
  st.phase = 'kampf'; st.countdown = 0;
  Plaza.Kampf.setInput(st, 0, inp({ u: true }));
  for (t = 0; t < 40; t++) {
    Plaza.Kampf.tick(st);
    assertBounds(st, 'jump-' + id + '@' + t);
  }
});

// 4) Solo-KI 180 Ticks
var stKi = Plaza.Kampf.neu('nina', 'biel', 'Topsen', 'CPU');
stKi.phase = 'kampf'; stKi.countdown = 0;
for (var k = 0; k < 180; k++) {
  var denk = Plaza.KI.denk(stKi, 1, k);
  Plaza.Kampf.setInput(stKi, 0, inp({ r: k % 20 < 10, a: k % 30 === 0 }));
  Plaza.Kampf.setInput(stKi, 1, denk);
  Plaza.Kampf.tick(stKi);
  assertBounds(stKi, 'ki@' + k);
}

// 5) Rematch behält Namen/Chars
var stR = Plaza.Kampf.neu('lola', 'rocco', 'Tobi', 'Alex');
stR.phase = 'kampf'; stR.zeit = 0;
Plaza.Kampf.tick(stR);
assert.equal(stR.phase, 'ende');
var stR2 = Plaza.Kampf.rematch(stR);
assert.equal(stR2.p[0].name, 'Tobi');
assert.equal(stR2.p[1].name, 'Alex');
assert.equal(stR2.p[0].charId, 'lola');
assert.equal(stR2.p[1].charId, 'rocco');

assert.equal(fails.length, 0, 'NaN/Inf: ' + fails.join('; '));
console.log('ok — smoke-kampf.test.js (chars=' + IDS.length + ', pairs=' + (IDS.length * IDS.length) + ')');
