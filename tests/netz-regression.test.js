/* Netz-Protokoll-Härtung (ohne echten MQTT) — version-agnostisch */
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
assert.ok(/^\d+\.\d+$/.test(Plaza.Netz.VERSION_Q), 'VERSION_Q format');
var id = Plaza.Netz.raumIdNeu();
assert.ok(typeof id === 'string' && id.length >= 4, 'raumId');

var api = Plaza.Netz.erstelle({
  onStatus: function () {}, onPeer: function () {}, onMsg: function () {}, onClose: function () {}
});
assert.ok(typeof api.sende === 'function');
var src = fs.readFileSync(path.join(root, 'js/netz.js'), 'utf8');
assert.ok(/VERSION_Q = '\d+\.\d+'/.test(src));
assert.ok(src.indexOf('&v=') !== -1 || src.indexOf("'&v='") !== -1);

var main = fs.readFileSync(path.join(root, 'js/main.js'), 'utf8');
assert.ok(main.indexOf("kampf.phase !== 'ende'") !== -1, 'Rematch nur aus Ende');
assert.ok(main.indexOf("typ: 'rematch', ver: VERSION") !== -1, 'Rematch trägt Version');

assert.ok(main.indexOf("typ: 'level'") !== -1 && main.indexOf('onLevel') !== -1);
assert.ok(main.indexOf("typ: 'input'") !== -1, 'Gast sendet Input');
assert.ok(main.indexOf('Motion-Inputs') !== -1, 'Input jeden Frame für Kombis');
assert.ok(main.indexOf('framesDrawn % 3') === -1, '20Hz-Drossel entfernt');
assert.ok(src.indexOf('reliable: false') !== -1, 'DataChannel ungeordnet');
assert.ok(src.indexOf("typ === 'state' || payload.typ === 'input'") !== -1, 'State/Input über Peer');
assert.ok(src.indexOf('peer-offer') !== -1, 'Peer-Id über MQTT');
assert.ok(main.indexOf('hatDirekt') !== -1, 'Host kennt den Direktkanal');
assert.ok(main.indexOf('applyLocalPredict') !== -1, 'lokale Gast-Glättung');
console.log('ok — netz-regression.test.js (v=' + Plaza.Netz.VERSION_Q + ')');
