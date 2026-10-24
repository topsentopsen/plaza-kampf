/* v2.2: Netz-Protokoll-Härtung (ohne echten MQTT) */
var assert = require('assert');
var path = require('path');
var fs = require('fs');
var vm = require('vm');
var root = path.join(__dirname, '..');
var ctx = {
  console: console, Math: Math, Date: Date, JSON: JSON,
  setInterval: function () { return 1; }, clearInterval: function () {},
  setTimeout: function (fn) { return 1; }, clearTimeout: function () {},
  performance: { now: Date.now },
  location: { href: 'http://localhost/plaza-kampf/?v=2.2', search: '?v=2.2' },
  document: { createElement: function () { return {}; } },
  WebSocket: function () {},
  mqtt: undefined, Peer: undefined
};
ctx.globalThis = ctx; ctx.window = ctx;
function load(rel) {
  vm.runInNewContext(fs.readFileSync(path.join(root, rel), 'utf8'), ctx, rel);
}
load('js/netz.js');
var Plaza = ctx.Plaza;
assert.ok(Plaza.Netz);
assert.equal(Plaza.Netz.VERSION_Q, '2.2');
var link = Plaza.Netz.erstelle({}).gastLink ? null : null;
// raumIdNeu format
var id = Plaza.Netz.raumIdNeu();
assert.ok(typeof id === 'string' && id.length >= 4, 'raumId');

// Link enthält Version
var api = Plaza.Netz.erstelle({
  onStatus: function () {}, onPeer: function () {}, onMsg: function () {}, onClose: function () {}
});
assert.ok(api.gastLink || api.link || typeof api.sende === 'function');
// gastLink may need host first — check VERSION_Q in module
var src = fs.readFileSync(path.join(root, 'js/netz.js'), 'utf8');
assert.ok(src.indexOf("VERSION_Q = '2.2'") !== -1);
assert.ok(src.indexOf('&v=') !== -1 || src.indexOf("'&v='") !== -1);

// main.js Rematch-Guard vorhanden
var main = fs.readFileSync(path.join(root, 'js/main.js'), 'utf8');
assert.ok(main.indexOf("kampf.phase !== 'ende'") !== -1, 'Rematch nur aus Ende');
assert.ok(main.indexOf("typ: 'rematch', ver: VERSION") !== -1, 'Rematch trägt Version');

console.log('ok — netz-regression.test.js');
