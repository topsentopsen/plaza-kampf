/* v2.9: Parallax-Drift / Kamera-Faktoren */
var assert = require('assert');
var fs = require('fs');
var path = require('path');
var rend = fs.readFileSync(path.join(__dirname, '..', 'js/render.js'), 'utf8');
assert.ok(/CAM_MAX\s*=\s*120/.test(rend), 'CAM_MAX 120');
assert.ok(/DRIFT\s*=\s*\{/.test(rend), 'DRIFT table');
assert.ok(rend.indexOf('function driftOf') !== -1, 'driftOf');
assert.ok(rend.indexOf("drawLayer(ctx, layers.L0, PAR.L0, tick, 'L0')") !== -1, 'L0 key');
assert.ok(rend.indexOf('Heat-Shimmer') !== -1, 'heat shimmer');
assert.ok(/PAR\s*=\s*\{[^}]*L0:\s*0\.04/.test(rend), 'PAR.L0 slow');
assert.ok(/L5:\s*1\.28/.test(rend), 'PAR.L5 fast');
assert.ok(/\*\s*0\.72/.test(rend), 'stronger camera follow');
console.log('ok — parallax.test.js');
