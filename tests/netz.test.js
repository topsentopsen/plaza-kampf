var assert = require('assert');
var fs = require('fs');
var path = require('path');
var vm = require('vm');
var ctx = { console: console, Math: Math, setInterval: setInterval, clearInterval: clearInterval, setTimeout: setTimeout, clearTimeout: clearTimeout };
ctx.globalThis = ctx; ctx.window = ctx;
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../js/netz.js'), 'utf8'), ctx);
var Plaza = ctx.Plaza;
assert.ok(Plaza.Netz.raumIdNeu().length === 6);
var statuses = [];
var netz = Plaza.Netz.erstelle({
  onStatus: function (t, e) { statuses.push(t); },
  onMsg: function () {}
});
assert.equal(typeof netz.linkFuer('https://x/','false'.length&&false), 'string');
var link = netz.linkFuer('https://example.com/p/', false);
// raum noch null → raum=
assert.ok(link.indexOf('v=1.5') !== -1);
assert.ok(link.indexOf('host=1') === -1);
var linkH = netz.linkFuer('https://example.com/p/', true);
assert.ok(linkH.indexOf('host=1') !== -1);
console.log('ok — netz.test.js');
