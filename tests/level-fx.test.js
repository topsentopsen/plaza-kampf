/* v3.5: Level-gated Arena-FX + Wetter-Sync */
var assert = require('assert');
var fs = require('fs');
var path = require('path');
var rend = fs.readFileSync(path.join(__dirname, '..', 'js/render.js'), 'utf8');
var main = fs.readFileSync(path.join(__dirname, '..', 'js/main.js'), 'utf8');

assert.ok(rend.indexOf("levelId === 'hoelle'") !== -1, 'hoelle gate');
assert.ok(rend.indexOf('Fackeln/Kegel nur Hölle') !== -1, 'fg gate');
assert.ok(rend.indexOf('Glühwürmchen') !== -1, 'dschungel ambient');
assert.ok(rend.indexOf('Laternen-Puls') !== -1, 'bruecke ambient');
assert.ok(rend.indexOf('function applyWetter') !== -1, 'applyWetter');
assert.ok(rend.indexOf('wetter.next < 0') !== -1, 'wetter next reset');
assert.ok(rend.indexOf('camX = 0') !== -1, 'cam reset on level');

assert.ok(main.indexOf('applyWetter') !== -1, 'main applyWetter');
assert.ok(main.indexOf('wetter:') !== -1 || main.indexOf('wetter: (') !== -1, 'state carries wetter');
assert.ok(/VERSION = 'v3\.9'/.test(main), 'VERSION v3.9');

console.log('ok — level-fx.test.js');
