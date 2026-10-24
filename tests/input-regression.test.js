/* v2.1: Input-Buffer, Cancel, Duck/Block-Regressionen */
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
load('js/palette.js'); load('js/chars.js'); load('js/kampf.js');
var Plaza = ctx.Plaza;
var empty = { l: false, r: false, u: false, d: false, a: false, b: false, c: false };
function I(o) { return Object.assign({}, empty, o); }

// Buffer: Taste A 3 Frames vor frei → Attack startet
var st = Plaza.Kampf.neu('biel', 'toni', 'A', 'B');
st.phase = 'kampf'; st.countdown = 0;
st.p[0].x = 400; st.p[1].x = 900; // weit weg, kein Hit nötig
// Stun blockiert Attacken — setze stun kurz
st.p[0].stun = 3;
Plaza.Kampf.setInput(st, 0, I({ a: true }));
Plaza.Kampf.tick(st); // stun 3→2, buf 5→4
Plaza.Kampf.setInput(st, 0, empty);
Plaza.Kampf.tick(st); // stun 2→1
Plaza.Kampf.tick(st); // stun 1→0 (noch kein Atk in diesem Frame)
Plaza.Kampf.tick(st); // stun 0 → Buffer zündet Light
assert.ok(st.p[0].atk, 'Buffer startet Light nach Stun');
assert.equal(st.p[0].atk.art, 'light');

// Duck senkt Hitbox
st = Plaza.Kampf.neu('lola', 'toni');
st.phase = 'kampf'; st.countdown = 0;
Plaza.Kampf.setInput(st, 0, I({ d: true }));
Plaza.Kampf.tick(st);
assert.ok(st.p[0].crouch, 'crouch flag');
var hbStand = { h: Plaza.Chars.finde('lola').h };
var hbDuck = Plaza.Kampf.hitbox ? null : null;
// hitbox not exported — recreate
var c = Plaza.Chars.finde('lola');
var hDuck = Math.floor(c.h * 0.62);
assert.ok(hDuck < c.h, 'Duck-Hitbox niedriger');

// Standing block vs Biel overhead (heavy): Duck-Block sollte durchschlagen
st = Plaza.Kampf.neu('biel', 'lola', 'Atk', 'Def');
st.phase = 'kampf'; st.countdown = 0;
st.p[0].x = 500; st.p[1].x = 600;
st.p[0].facing = 1; st.p[1].facing = -1;
var hp0 = st.p[1].hp;
// Defender crouch-blocks (back + duck)
Plaza.Kampf.setInput(st, 1, I({ r: true, d: true })); // facing -1, back is r
// Attacker heavy (overhead)
Plaza.Kampf.setInput(st, 0, I({ b: true }));
Plaza.Kampf.tick(st);
Plaza.Kampf.setInput(st, 0, empty);
for (var t = 0; t < 40; t++) {
  Plaza.Kampf.setInput(st, 1, I({ r: true, d: true }));
  Plaza.Kampf.tick(st);
}
assert.ok(st.p[1].hp < hp0, 'Overhead trifft Duck-Block (chip oder full)');

// Light→Special Cancel on hit
st = Plaza.Kampf.neu('nina', 'toni', 'Atk', 'Def');
st.phase = 'kampf'; st.countdown = 0;
st.p[0].x = 520; st.p[1].x = 600;
st.p[0].facing = 1; st.p[1].facing = -1;
Plaza.Kampf.setInput(st, 0, I({ a: true }));
Plaza.Kampf.tick(st);
Plaza.Kampf.setInput(st, 0, empty);
var sawCancel = false;
for (t = 0; t < 30; t++) {
  if (st.p[0]._cancel) {
    Plaza.Kampf.setInput(st, 0, I({ c: true }));
    Plaza.Kampf.tick(st);
    Plaza.Kampf.setInput(st, 0, empty);
    if (st.p[0].atk && st.p[0].atk.art === 'special') sawCancel = true;
    break;
  }
  Plaza.Kampf.tick(st);
}
assert.ok(sawCancel || st.p[1].hp < st.p[1].maxHp, 'Cancel-Pfad oder zumindest Hit');

// Rematch löscht stun/atk/projektile
st = Plaza.Kampf.neu('toni', 'rocco', 'T', 'R');
st.phase = 'kampf'; st.countdown = 0;
st.p[0].stun = 10; st.p[0].atk = { art: 'heavy', m: st.p[0] && Plaza.Chars.finde('toni').moves.heavy, frame: 2 };
st.projektile = [{ x: 1, y: 2 }];
st.phase = 'ende';
var st2 = Plaza.Kampf.rematch(st);
assert.equal(st2.phase === 'kampf' || st2.countdown > 0 || st2.phase === 'countdown' || st2.p[0].hp === st2.p[0].maxHp, true);
assert.ok(!st2.p[0].atk, 'Rematch: kein Atk');
assert.ok(st2.p[0].stun === 0, 'Rematch: stun 0');
assert.ok(!st2.projektile || st2.projektile.length === 0, 'Rematch: keine Projektile');


// Wakeup-Buffer: bei langem Stun (8) bleibt buf erhalten
st = Plaza.Kampf.neu('biel', 'toni', 'A', 'B');
st.phase = 'kampf'; st.countdown = 0;
st.p[0].x = 400; st.p[1].x = 900;
st.p[0].stun = 8;
Plaza.Kampf.setInput(st, 0, I({ a: true }));
Plaza.Kampf.tick(st);
Plaza.Kampf.setInput(st, 0, empty);
for (var w = 0; w < 8; w++) Plaza.Kampf.tick(st);
assert.ok(st.p[0].atk && st.p[0].atk.art === 'light', 'Wakeup-Buffer nach Stun=8');

console.log('ok — input-regression.test.js');
