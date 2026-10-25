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

assert.ok(Plaza.KI.PRAXIS >= 0.8, 'Praxis-Aggressivität');
function atkCount(aggr) {
  var st = Plaza.Kampf.neu('biel', 'lola', 'T', 'CPU');
  st.phase = 'kampf'; st.countdown = 0;
  var n = 0, sp = 0;
  for (var t = 0; t < 300; t++) {
    Plaza.Kampf.setInput(st, 0, { l: false, r: false, u: false, d: false, a: false, b: false, c: false });
    var cpu = Plaza.KI.denk(st, 1, { aggressiv: aggr });
    if (cpu.a || cpu.b || cpu.c) n++;
    if (cpu.c) sp++;
    Plaza.Kampf.setInput(st, 1, cpu);
    Plaza.Kampf.tick(st);
  }
  return { n: n, sp: sp, hp: st.p[0].hp, max: st.p[0].maxHp };
}
var soft = atkCount(0.35);
var hard = atkCount(Plaza.KI.PRAXIS);
assert.ok(hard.n > soft.n, 'Praxis schlägt öfter: ' + hard.n + ' vs ' + soft.n);
assert.ok(hard.sp >= soft.sp, 'Praxis nutzt mindestens so viele Specials');
assert.ok(hard.sp < 40, 'Special-Cooldown hält, got ' + hard.sp);
Plaza.Chars.LISTE.forEach(function (c) {
  var s2 = c.moves.special2;
  assert.ok(s2, c.id + ' special2');
  var burst = s2.dmg * (s2.hits || 1);
  assert.ok(burst < c.hp * 0.5, c.id + ' special2 kein Halb-Leben-Hit ' + burst);
  assert.ok(c.moves.special.dmg < c.hp * 0.5, c.id + ' special kein Halb-Leben-Hit');
});
var mainKi = require('fs').readFileSync(path.join(root, 'js/main.js'), 'utf8');
assert.ok(mainKi.indexOf('Plaza.KI.PRAXIS') !== -1, 'Solo nutzt Praxis-KI');

// Spiegelkampf: gleiche Figur, Praxis schlägt die weiche KI und behält deutlich HP.
var spiegel = Plaza.Kampf.neu('biel', 'biel', 'weich', 'praxis');
spiegel.phase = 'kampf'; spiegel.countdown = 0;
for (var ts = 0; ts < 5000 && spiegel.phase !== 'ende'; ts++) {
  Plaza.Kampf.setInput(spiegel, 0, Plaza.KI.denk(spiegel, 0, { aggressiv: 0.45 }));
  Plaza.Kampf.setInput(spiegel, 1, Plaza.KI.denk(spiegel, 1, { aggressiv: Plaza.KI.PRAXIS }));
  Plaza.Kampf.tick(spiegel);
}
assert.equal(spiegel.sieger, 1, 'Praxis gewinnt den Spiegelkampf');
assert.ok(spiegel.p[1].hp > 40, 'Praxis behält HP, got ' + spiegel.p[1].hp);

console.log('ok — ki.test.js (ticks=180, dmgFrames=' + hits + ', specials=' + specials + ', gegner=' + g + ', praxisAtk=' + hard.n + '/' + soft.n + ', praxisSp=' + hard.sp + ')');
