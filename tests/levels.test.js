/* v3.3: Level-System */
var assert = require('assert');
var fs = require('fs');
var path = require('path');
var levels = fs.readFileSync(path.join(__dirname, '..', 'js/levels.js'), 'utf8');
var rend = fs.readFileSync(path.join(__dirname, '..', 'js/render.js'), 'utf8');
var html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
var main = fs.readFileSync(path.join(__dirname, '..', 'js/main.js'), 'utf8');
var ui = fs.readFileSync(path.join(__dirname, '..', 'js/ui.js'), 'utf8');

assert.ok(levels.indexOf('Plaza.Levels') !== -1, 'Plaza.Levels');
assert.ok(levels.indexOf("id: 'dschungel'") !== -1, 'dschungel id');
assert.ok(levels.indexOf("id: 'bruecke'") !== -1, 'bruecke id');
assert.ok(levels.indexOf("id: 'stadt'") !== -1, 'stadt id');
assert.ok(levels.indexOf('function bakeDschungel') !== -1, 'bakeDschungel');
assert.ok(levels.indexOf('function bakeBruecke') !== -1, 'bakeBruecke');
assert.ok(levels.indexOf('function bakeStadt') !== -1, 'bakeStadt');

assert.ok(rend.indexOf('function bakeHoelle') !== -1, 'bakeHoelle');
assert.ok(rend.indexOf('function setLevel') !== -1, 'setLevel');
assert.ok(rend.indexOf('function getLevel') !== -1, 'getLevel');
assert.ok(rend.indexOf('Plaza.Levels.bake') !== -1, 'dispatch bake');

assert.ok(html.indexOf('id="level-pick"') !== -1, 'level-pick UI');
assert.ok(html.indexOf('js/levels.js?v=3.3') !== -1, 'levels script');
assert.ok(ui.indexOf('function fillLevels') !== -1, 'fillLevels');
assert.ok(main.indexOf('function applyLevel') !== -1, 'applyLevel');
assert.ok(main.indexOf("typ: 'level'") !== -1, 'netz level msg');

// runtime bake smoke
var g = global;
require('../js/palette.js');
// minimal stub: levels needs only its own + we call bake with mock api
function mockApi() {
  function backe(w, h, fn) {
    var c = { width: w, height: h, getContext: function () {
      return {
        fillStyle: '', globalAlpha: 1, fillRect: function () {},
        beginPath: function () {}, moveTo: function () {}, lineTo: function () {}, closePath: function () {}, fill: function () {},
        ellipse: function () {}, arc: function () {}, stroke: function () {},
        createPattern: function () { return '#000'; },
        save: function () {}, restore: function () {}, translate: function () {}, scale: function () {},
        clearRect: function () {}, drawImage: function () {},
        fillText: function () {}, font: '', textAlign: '', textBaseline: '',
        strokeStyle: '', lineWidth: 1, strokeRect: function () {}
      };
    }};
    // levels.js uses Plaza canvas helpers via werkzeug — we pass werkzeug from a tiny shim
    try { fn({ fillStyle:'', globalAlpha:1, fillRect:function(){}, beginPath:function(){}, moveTo:function(){}, lineTo:function(){}, closePath:function(){}, fill:function(){}, ellipse:function(){}, arc:function(){}, save:function(){}, restore:function(){}, translate:function(){}, scale:function(){}, clearRect:function(){}, createPattern:function(){return null;}, stroke:function(){}, strokeStyle:'', lineWidth:1 }, w, h); } catch (e) {}
    return { w: w, h: h, c: c };
  }
  function werkzeug(x) {
    return {
      R: function () {}, kR: function () {}, ell: function () {}, poly: function () {},
      pat: function (c) { return c; }, toene: function () {}, linie: function () {}
    };
  }
  function rng(seed) { var s = seed || 1; return function () { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }
  return { backe: backe, werkzeug: werkzeug, rng: rng, LW: 1600, H: 768, P: {}, GLUT_DEF: '#ff3a08' };
}
require('../js/levels.js');
var api = mockApi();
['dschungel', 'bruecke', 'stadt'].forEach(function (id) {
  var L = Plaza.Levels.bake(id, api);
  assert.ok(L && L.L0 && L.L5 && L.lw === 1600, 'bake ' + id);
});
assert.strictEqual(Plaza.Levels.bake('hoelle', api), null, 'hoelle stays in render');
assert.ok(Plaza.Levels.LISTE.length === 4, '4 levels');
console.log('ok — levels.test.js');
