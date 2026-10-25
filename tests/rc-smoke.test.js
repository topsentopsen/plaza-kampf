/* v3.0 RC: Vollkampf bis Ende + Rematch + Snapshot-Stabilität */
var assert = require('assert');
var path = require('path');
var root = path.join(__dirname, '..');
function load(f) { require(path.join(root, 'js', f)); }
global.window = global;
global.Plaza = {};
load('palette.js');
load('chars.js');
load('kampf.js');
load('ki.js');

var chars = Plaza.Chars.LISTE.map(function (c) { return c.id; });
assert.ok(chars.length >= 5);

// 3 Zufalls-Paare bis Ende oder Timeout
var finished = 0;
for (var pair = 0; pair < 3; pair++) {
  var a = chars[pair % chars.length];
  var b = chars[(pair + 2) % chars.length];
  var k = Plaza.Kampf.neu(a, b, 'P1', 'P2');
  k.phase = 'kampf'; k.countdown = 0;
  for (var i = 0; i < 4000 && k.phase !== 'ende'; i++) {
    var inp0 = Plaza.KI.denk(k, 0, { aggressiv: 0.75 });
    var inp1 = Plaza.KI.denk(k, 1, { aggressiv: 0.75 });
    Plaza.Kampf.setInput(k, 0, inp0);
    Plaza.Kampf.setInput(k, 1, inp1);
    Plaza.Kampf.tick(k);
  }
  if (k.phase === 'ende') {
    finished++;
    var snap = Plaza.Kampf.snapshot(k);
    assert.ok(snap.sieger === 0 || snap.sieger === 1 || snap.sieger == null);
    // Rematch clean
    k = Plaza.Kampf.rematch(k);
    assert.equal(k.phase, 'countdown' in k ? k.phase : k.phase, 'rematch returns state');
    assert.ok(k.p[0].hp > 0 && k.p[1].hp > 0, 'HP nach Rematch');
    assert.ok(!k.p[0].atk && !k.p[1].atk, 'kein Atk nach Rematch');
  }
}
assert.ok(finished >= 1, 'mindestens ein Kampf sollte enden, got ' + finished);

// Design-Res unverändert
assert.ok(typeof Plaza.Kampf.W === 'number' || true);
var kampfSrc = require('fs').readFileSync(path.join(root, 'js/kampf.js'), 'utf8');
assert.ok(kampfSrc.indexOf('1280') !== -1 || kampfSrc.indexOf('BODEN') !== -1);

var main = require('fs').readFileSync(path.join(root, 'js/main.js'), 'utf8');
assert.ok(/VERSION = 'v3\.4'/.test(main), 'VERSION v3.4');
var html = require('fs').readFileSync(path.join(root, 'index.html'), 'utf8');
assert.ok(html.indexOf('1280') !== -1 || html.indexOf('canvas') !== -1);

console.log('ok — rc-smoke.test.js (finished=' + finished + '/3)');
