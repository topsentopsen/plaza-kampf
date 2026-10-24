/* Node smoke: KI + Solo-Kampf tickt */
var path = require('path');
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
for (var i = 0; i < 180; i++) {
  Plaza.Kampf.setInput(k, 0, { l: false, r: true, u: false, d: false, a: (i % 20) === 0, b: false, c: false });
  var cpu = Plaza.KI.denk(k, 1, { aggressiv: 0.7 });
  Plaza.Kampf.setInput(k, 1, cpu);
  Plaza.Kampf.tick(k);
  if (k.p[0].hp < k.p[0].maxHp || k.p[1].hp < k.p[1].maxHp) hits++;
}
if (!Plaza.KI.zufallsGegner('biel')) throw new Error('zufallsGegner');
var g = Plaza.KI.zufallsGegner('biel');
if (g === 'biel') throw new Error('gegner sollte anders sein');
var snap = Plaza.Kampf.snapshot(k);
if (!snap || !snap.p || snap.p.length !== 2) throw new Error('snap');
console.log('ok — ki.test.js (ticks=180, dmgFrames=' + hits + ', gegner=' + g + ')');
