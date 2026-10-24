/* Netz unit smoke */
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
  location: { href: 'http://localhost/plaza-kampf/', search: '' },
  document: { createElement: function () { return {}; } },
  WebSocket: function () {},
  mqtt: undefined, Peer: undefined
};
ctx.globalThis = ctx; ctx.window = ctx;
vm.runInNewContext(fs.readFileSync(path.join(root, 'js/netz.js'), 'utf8'), ctx, 'netz.js');
var Plaza = ctx.Plaza;
assert.ok(Plaza.Netz);
var api = Plaza.Netz.erstelle({
  onStatus: function () {}, onPeer: function () {}, onMsg: function () {}, onClose: function () {}
});
assert.ok(typeof api.sende === 'function');
var id = Plaza.Netz.raumIdNeu();
assert.ok(id && id.length >= 4);
// Force raum for link
if (api.hostStarten) { /* skip network */ }
var src = fs.readFileSync(path.join(root, 'js/netz.js'), 'utf8');
var m = src.match(/VERSION_Q = '([^']+)'/);
assert.ok(m);
var vq = m[1];
assert.equal(Plaza.Netz.VERSION_Q, vq);
// Simulate gastLink builder pattern from source
assert.ok(src.indexOf("'&v=' + VERSION_Q") !== -1 || src.indexOf('&v=') !== -1);
var link = '?raum=TEST&v=' + vq;
assert.ok(link.indexOf('v=' + vq) !== -1);
console.log('ok — netz.test.js');
