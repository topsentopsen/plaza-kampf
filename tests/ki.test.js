/* Node smoke: KI + Solo-Kampf + v2.3 Anti-Air/Wake */
var path = require('path');
var assert = require('assert');
var root = path.join(__dirname, '..');
function load(f) { require(path.join(root, 'js', f)); }
global.window = global;
global.Plaza = {};
load('palette.js');
load('chars.js');
load('kampf.js');
load('ki.js');

var k = Plaza.Kampf.neu('biel', 'toni', 'Tester', 'CPU');
k.phase = 'kampf';
k.countdown = 0;
var hits = 0;
var specials = 0;
for (var i = 0; i < 180; i++) {
  Plaza.Kampf.setInput(k, 0, { l: false, r: true, u: false, d: false, a: (i % 20) === 0, b: false, c: false });
  var cpu = Plaza.KI.denk(k, 1, { aggressiv: 0.7 });
  if (cpu.c) specials++;
  Plaza.Kampf.setInput(k, 1, cpu);
  Plaza.Kampf.tick(k);
  if (k.p[0].hp < k.p[0].maxHp || k.p[1].hp < k.p[1].maxHp) hits++;
}
assert.ok(Plaza.KI.zufallsGegner('biel'));
var g = Plaza.KI.zufallsGegner('biel');
assert.notEqual(g, 'biel');
assert.ok(specials < 40, 'Special-Cooldown sollte Spam begrenzen, got ' + specials);

// Anti-Air: foe in air → KI punches or backs
k = Plaza.Kampf.neu('biel', 'toni', 'T', 'CPU');
k.phase = 'kampf'; k.countdown = 0;
k.p[0].x = 400; k.p[1].x = 520;
k.p[0].grounded = false; k.p[0].vy = -8; k.p[0].y = 400;
var aa = Plaza.KI.denk(k, 1, { aggressiv: 0.8 });
assert.ok(aa.a || aa.b || aa.l || aa.r, 'Anti-Air Reaktion');

// Wake guard
assert.ok(typeof Plaza.KI.markWake === 'function');
k.p[1].stun = 0;
Plaza.KI.markWake(k.p[1]);
assert.ok(k.p[1]._kiWakeGuard > 0);
var w = Plaza.KI.denk(k, 1, { aggressiv: 0.9 });
assert.equal(w.c, false, 'kein Special während Wake-Guard');
assert.ok(w.l || w.r, 'Wake-Guard blockt');

var snap = Plaza.Kampf.snapshot(k);
assert.ok(snap && snap.p && snap.p.length === 2);
console.log('ok — ki.test.js (ticks=180, dmgFrames=' + hits + ', specials=' + specials + ', gegner=' + g + ')');
