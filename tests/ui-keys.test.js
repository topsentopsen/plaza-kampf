/* Namensfeld darf WASD nicht verlieren (Thompson / S). */
var assert = require('assert');
var path = require('path');
var fs = require('fs');
var vm = require('vm');
var root = path.join(__dirname, '..');
var listeners = { keydown: [], keyup: [] };
var fakeInput = { tagName: 'INPUT', value: '', isContentEditable: false };
function q(s) {
  if (s === '#overlay') return {
    querySelectorAll: function () { return []; },
    querySelector: function () { return null; },
    hidden: false
  };
  if (s === '#controls') return { hidden: true, querySelector: function () { return null; } };
  if (s === '#status') return { textContent: '' };
  return null;
}
var rootEl = { querySelector: q };
var ctx = {
  console: console,
  document: {
    body: rootEl,
    querySelector: q,
    createElement: function () {
      return { style: {}, addEventListener: function () {}, classList: { add: function () {}, remove: function () {} }, dataset: {}, appendChild: function () {} };
    }
  },
  window: null,
  Plaza: {}
};
ctx.window = ctx;
ctx.globalThis = ctx;
ctx.window.addEventListener = function (typ, fn) {
  if (listeners[typ]) listeners[typ].push(fn);
};
vm.runInNewContext(fs.readFileSync(path.join(root, 'js/ui.js'), 'utf8'), ctx);
assert.ok(ctx.Plaza && ctx.Plaza.UI, 'Plaza.UI');
ctx.Plaza.UI.erstelle({ root: rootEl });
assert.ok(listeners.keydown.length >= 1, 'keydown bound');
var prevented = false;
var ev = { key: 's', code: 'KeyS', target: fakeInput, preventDefault: function () { prevented = true; } };
listeners.keydown.forEach(function (fn) { fn(ev); });
assert.equal(prevented, false, 'S im Namensfeld nicht stehlen');
prevented = false;
ev.target = { tagName: 'BODY', isContentEditable: false };
listeners.keydown.forEach(function (fn) { fn(ev); });
assert.equal(prevented, true, 'S außerhalb = Duck');
// Also a, w, d, j, k, l
['a', 'w', 'd', 'j', 'k', 'l'].forEach(function (ch) {
  prevented = false;
  listeners.keydown.forEach(function (fn) {
    fn({ key: ch, code: 'Key' + ch.toUpperCase(), target: fakeInput, preventDefault: function () { prevented = true; } });
  });
  assert.equal(prevented, false, ch + ' im Input frei');
});
console.log('ok — ui-keys.test.js (Thompson/S)');
