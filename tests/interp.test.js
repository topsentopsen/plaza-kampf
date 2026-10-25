/* v4.0: Snapshot-Interpolation */
'use strict';
var assert = require('assert');
var fs = require('fs');
var path = require('path');
var vm = require('vm');
var root = path.join(__dirname, '..');
var ctx = { console: console, Math: Math, performance: { now: function () { return ctx._now; } } };
ctx._now = 1000;
ctx.globalThis = ctx; ctx.window = ctx;
vm.runInNewContext(fs.readFileSync(path.join(root, 'js/interp.js'), 'utf8'), ctx, 'interp.js');
var Plaza = ctx.Plaza;
assert.ok(Plaza.Interp);

var a = {
  tick: 10, phase: 'kampf', countdown: 0, zeit: 90,
  sieger: null, endeTimer: 0, nachricht: '',
  p: [
    { id: 0, charId: 'biel', name: 'A', x: 100, y: 600, facing: 1, grounded: true,
      hp: 100, maxHp: 100, stun: 0, atk: null, invuln: 0, crouch: false, blk: false,
      hitSeq: 0, hitKind: '', combo: 0, comboDmg: 0, vx: 4, af: 0 },
    { id: 1, charId: 'toni', name: 'B', x: 800, y: 600, facing: -1, grounded: true,
      hp: 100, maxHp: 100, stun: 0, atk: null, invuln: 0, crouch: false, blk: false,
      hitSeq: 0, hitKind: '', combo: 0, comboDmg: 0, vx: 0, af: 0 }
  ],
  projektil: []
};
var b = JSON.parse(JSON.stringify(a));
b.tick = 12;
b.p[0].x = 140;
b.p[0].vx = 4;
b.p[0].atk = { art: 'punch', frame: 2 };

var mid = Plaza.Interp.lerpSnap(a, b, 0.5);
assert.ok(Math.abs(mid.p[0].x - 120) < 0.01, 'lerp x mid');
assert.ok(mid.p[0].atk && mid.p[0].atk.art === 'punch', 'discrete from newer');
assert.equal(mid.tick, 12);

var buf = Plaza.Interp.erstelle({ delayMs: 40 });
ctx._now = 1000;
buf.push(a);
ctx._now = 1033;
buf.push(b);
// render at 1033: renderAt=993 → before/at from → should be near from or lerping
ctx._now = 1050; // renderAt=1010, span=33, alpha=(1010-1000)/33≈0.30
var s = buf.sample(1050);
assert.ok(s.p[0].x > 100 && s.p[0].x < 140, 'buffered sample in between, got ' + s.p[0].x);

// phase ende → hard snap
var end = JSON.parse(JSON.stringify(b));
end.phase = 'ende'; end.sieger = 0;
ctx._now = 1100;
buf.push(end);
assert.equal(buf.sample(1140).phase, 'ende');

// ignore small reorder (tick-1), keep latest
ctx._now = 1200;
var old = JSON.parse(JSON.stringify(end));
old.tick = end.tick - 1;
buf.push(old);
assert.equal(buf.latest().tick, end.tick);

buf.reset();
assert.equal(buf.sample(), null);

var html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
assert.ok(html.indexOf('js/interp.js?v=4.0') !== -1, 'interp script tag');
var main = fs.readFileSync(path.join(root, 'js/main.js'), 'utf8');
assert.ok(main.indexOf('snapInterp') !== -1 && main.indexOf('pushInterp') !== -1);
assert.ok(/VERSION = 'v4\.0'/.test(main));
assert.ok(main.indexOf('jeden Sim-Tick') !== -1 || main.indexOf('broadcast()') !== -1);

// rematch rewind must accept new low tick
ctx._now = 2000;
var buf2 = Plaza.Interp.erstelle({ delayMs: 40 });
buf2.push({ tick: 500, phase: 'ende', p: [{ x: 1, y: 1, vx: 0 }], projektil: [] });
ctx._now = 2050;
buf2.push({ tick: 1, phase: 'countdown', countdown: 3, p: [{ x: 100, y: 1, vx: 0 }], projektil: [] });
assert.equal(buf2.latest().tick, 1, 'rematch rewind');

// Burst: drei Ticks in 2 ms dürfen den Gast nicht ans Ende teleportieren.
ctx._now = 3000;
var burst = Plaza.Interp.erstelle({ delayMs: 50 });
function snapAt(tick, x) {
  return {
    tick: tick, phase: 'kampf', countdown: 0, zeit: 90,
    sieger: null, endeTimer: 0, nachricht: '',
    p: [{ id: 0, charId: 'biel', name: 'A', x: x, y: 600, facing: 1, grounded: true,
      hp: 100, maxHp: 100, stun: 0, atk: null, invuln: 0, crouch: false, blk: false,
      hitSeq: 0, hitKind: '', combo: 0, comboDmg: 0, vx: 10, vy: 0, af: 0 }],
    projektil: []
  };
}
burst.push(snapAt(30, 0));
ctx._now = 3001;
burst.push(snapAt(31, 20));
ctx._now = 3002;
burst.push(snapAt(32, 40));
var early = burst.sample(3002);
assert.ok(early.p[0].x < 5, 'burst hält am Pufferanfang, x=' + early.p[0].x);
var later = burst.sample(3068);
assert.ok(later.p[0].x > early.p[0].x && later.p[0].x < 30, 'burst entzerrt statt ans Ende zu springen, x=' + later.p[0].x);

// Projektile gleicher Liste per id, nicht per Index
var pa = snapAt(1, 0);
pa.projektil = [{ i: 7, x: 10, y: 20, vx: 4, vy: 0, w: 8, h: 8, owner: 0, typ: 'ball' }];
var pb = snapAt(2, 0);
pb.projektil = [{ i: 7, x: 30, y: 20, vx: 4, vy: 0, w: 8, h: 8, owner: 0, typ: 'ball' }];
var pm = Plaza.Interp.lerpSnap(pa, pb, 0.5);
assert.ok(Math.abs(pm.projektil[0].x - 20) < 0.01, 'proj lerp by id');

console.log('ok — interp.test.js');
