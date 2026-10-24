/* v2.7: UX Checks */
var assert = require('assert');
var fs = require('fs');
var path = require('path');
var root = path.join(__dirname, '..');
var main = fs.readFileSync(path.join(root, 'js/main.js'), 'utf8');
var html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
assert.ok(main.indexOf('sanitizeName') !== -1);
assert.ok(main.indexOf("&v=1.0") === -1, 'setUrl darf nicht mehr v=1.0 hardcoden');
assert.ok(main.indexOf('VERSION_Q') !== -1 || main.indexOf("VERSION.replace") !== -1);
assert.ok(html.indexOf('ende-rematch-hint') !== -1);
assert.ok(html.indexOf('Rematch') !== -1);
console.log('ok — ux-smoke.test.js');
