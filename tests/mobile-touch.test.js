/* v2.4: Mobile/PWA/Touch Checks (statisch) */
var assert = require('assert');
var fs = require('fs');
var path = require('path');
var root = path.join(__dirname, '..');
var html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
var ui = fs.readFileSync(path.join(root, 'js/ui.js'), 'utf8');
var man = fs.readFileSync(path.join(root, 'manifest.webmanifest'), 'utf8');
assert.ok(html.indexOf('viewport-fit=cover') !== -1);
assert.ok(html.indexOf('apple-mobile-web-app-capable') !== -1);
assert.ok(html.indexOf('overscroll-behavior') !== -1);
assert.ok(html.indexOf('min-width: 64px') !== -1, 'coarse pointer pad size');
assert.ok(ui.indexOf('pointerdown') !== -1);
assert.ok(ui.indexOf('setPointerCapture') !== -1, 'pointer capture');
assert.ok(man.indexOf('display') !== -1);
console.log('ok — mobile-touch.test.js');
