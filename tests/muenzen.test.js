/* v4.2: Münzen pro Sieg, localStorage, kein Shop. */
'use strict';
var assert = require('assert');
var fs = require('fs');
var path = require('path');
var vm = require('vm');
var root = path.join(__dirname, '..');

function mem() {
  var m = {};
  return {
    getItem: function (k) { return Object.prototype.hasOwnProperty.call(m, k) ? m[k] : null; },
    setItem: function (k, v) { m[k] = String(v); }
  };
}

var ctx = { console: console, Math: Math };
ctx.globalThis = ctx;
vm.runInNewContext(fs.readFileSync(path.join(root, 'js/muenzen.js'), 'utf8'), ctx, 'muenzen.js');
var M = ctx.Plaza.Muenzen;
var s = mem();
assert.equal(M.lesen(s), 0);
assert.equal(M.gutschreiben(M.PRO_SIEG, s), 10);
assert.equal(M.lesen(s), 10);
assert.equal(M.gutschreiben(M.PRO_SIEG, s), 20, 'zweiter Sieg stapelt');
s.setItem(M.KEY, 'nope');
assert.equal(M.lesen(s), 0, 'Müll zählt als 0');
assert.equal(M.PRO_SIEG, 10);

var html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
assert.ok(html.indexOf('id="muenzen-anzeige"') !== -1);
assert.ok(html.indexOf('id="ende-muenzen"') !== -1);
assert.ok(html.indexOf('js/muenzen.js?v=4.2') !== -1);
var main = fs.readFileSync(path.join(root, 'js/main.js'), 'utf8');
assert.ok(main.indexOf('noteSieg') !== -1);
assert.ok(main.indexOf('sieger !== seite') !== -1, 'nur der lokale Sieger');
var ui = fs.readFileSync(path.join(root, 'js/ui.js'), 'utf8');
assert.ok(ui.indexOf('zeigeMuenzen') !== -1);
var rend = fs.readFileSync(path.join(root, 'js/render.js'), 'utf8');
assert.ok(rend.indexOf('Münzen') !== -1);
assert.ok(main.indexOf('kauf') === -1 || main.indexOf('noteSieg') !== -1);
console.log('ok — muenzen.test.js');
