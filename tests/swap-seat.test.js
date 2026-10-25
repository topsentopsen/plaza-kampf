/* v3.4: Side-swap seat slots + peer input + endscreen seite */
var assert = require('assert');
var fs = require('fs');
var path = require('path');
var main = fs.readFileSync(path.join(__dirname, '..', 'js/main.js'), 'utf8');

assert.ok(main.indexOf("var VERSION = 'v3.4'") !== -1, 'VERSION v3.4');
assert.ok(main.indexOf('clearPeerInput') !== -1, 'clearPeerInput');
assert.ok(main.indexOf('msg.seite !== seite') !== -1, 'peer input any other seite');
assert.ok(main.indexOf("msg.seite === 1) peerInput") === -1, 'old seite===1-only input gone');
assert.ok(main.indexOf('sieger === seite') !== -1, 'endscreen uses seite');
assert.ok(main.indexOf('wonH = letzterSnap.sieger === 0') === -1, 'host wonH not hard-coded 0');
// onWahl stores by seite, not istHost role
assert.ok(main.indexOf('seite === 0) { hostWahl') !== -1 || main.indexOf('seite === 0) { hostWahl = id') !== -1, 'wahl by seite');
assert.ok(main.indexOf('Host seite===1 → Host rechts: Chars tauschen') === -1, 'no double-swap in versucheStart');
assert.ok(main.indexOf('clearPeerInput()') !== -1, 'peerInput cleared on start/rematch');

var netz = fs.readFileSync(path.join(__dirname, '..', 'js/netz.js'), 'utf8');
assert.ok(netz.indexOf("VERSION_Q = '3.4'") !== -1, 'VERSION_Q 3.4');

console.log('ok — swap-seat.test.js');
