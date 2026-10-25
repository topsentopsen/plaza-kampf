/* v3.0: Wetter-System */
var assert = require('assert');
var fs = require('fs');
var path = require('path');
var rend = fs.readFileSync(path.join(__dirname, '..', 'js/render.js'), 'utf8');
assert.ok(rend.indexOf('function drawWetter') !== -1);
assert.ok(rend.indexOf('function wetterTick') !== -1);
assert.ok(rend.indexOf("WETTER_PHASEN") !== -1);
assert.ok(rend.indexOf("'regen'") !== -1 && rend.indexOf("'gewitter'") !== -1 && rend.indexOf("'sonne'") !== -1);
assert.ok(rend.indexOf('drawWetter(ctx,') !== -1);
console.log('ok — weather.test.js');
