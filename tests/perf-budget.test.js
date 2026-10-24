/* v2.6: Perf-Budget Checks */
var assert = require('assert');
var fs = require('fs');
var path = require('path');
var root = path.join(__dirname, '..');
var main = fs.readFileSync(path.join(root, 'js/main.js'), 'utf8');
var rend = fs.readFileSync(path.join(root, 'js/render.js'), 'utf8');
assert.ok(main.indexOf('tabHidden') !== -1, 'tabHidden skip draw');
assert.ok(main.indexOf('framesSkipped') !== -1);
assert.ok(rend.indexOf('FX_MAX') !== -1, 'FX_MAX');
assert.ok(/FX_MAX\s*=\s*\d+/.test(rend));
console.log('ok — perf-budget.test.js');
