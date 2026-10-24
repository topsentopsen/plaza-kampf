/* v2.5: Audio API smoke (ohne real AudioContext) */
var assert = require('assert');
var fs = require('fs');
var path = require('path');
var vm = require('vm');
var root = path.join(__dirname, '..');
function FakeAC() {
  this.state = 'running';
  this.currentTime = 0;
  this.sampleRate = 44100;
  this.destination = {};
}
FakeAC.prototype.createGain = function () {
  var g = { gain: { value: 1, setValueAtTime: function () {}, linearRampToValueAtTime: function () {}, exponentialRampToValueAtTime: function () {}, cancelScheduledValues: function () {} }, connect: function () { return g; } };
  return g;
};
FakeAC.prototype.createOscillator = function () {
  return { type: 'square', frequency: { setValueAtTime: function () {}, exponentialRampToValueAtTime: function () {} }, connect: function () {}, start: function () {}, stop: function () {} };
};
FakeAC.prototype.createBiquadFilter = function () {
  return { type: 'lowpass', frequency: { value: 1000 }, connect: function () { return this; } };
};
FakeAC.prototype.createDynamicsCompressor = function () {
  return { threshold: { value: 0 }, knee: { value: 0 }, ratio: { value: 1 }, attack: { value: 0 }, release: { value: 0 }, connect: function () { return this; } };
};
FakeAC.prototype.createBuffer = function (ch, len, rate) {
  return { getChannelData: function () { return new Float32Array(len); } };
};
FakeAC.prototype.createBufferSource = function () {
  return { buffer: null, connect: function () {}, start: function () {}, stop: function () {} };
};
FakeAC.prototype.resume = function () { this.state = 'running'; return Promise.resolve(); };

var ctx = {
  console: console, Math: Math, Date: Date, JSON: JSON,
  setTimeout: setTimeout, clearTimeout: clearTimeout,
  AudioContext: FakeAC, webkitAudioContext: FakeAC,
  localStorage: { getItem: function () { return null; }, setItem: function () {} }
};
ctx.window = ctx; ctx.globalThis = ctx;
vm.runInNewContext(fs.readFileSync(path.join(root, 'js/sound.js'), 'utf8'), ctx);
var Sound = ctx.Plaza.Sound;
assert.ok(Sound);
assert.ok(typeof Sound.init === 'function' || typeof Sound.resume === 'function');
if (Sound.init) Sound.init();
if (Sound.resume) Sound.resume();
if (Sound.sfx) {
  Sound.sfx('hit');
  Sound.sfx('win');
  Sound.sfx('ui');
}
var src = fs.readFileSync(path.join(root, 'js/sound.js'), 'utf8');
assert.ok(src.indexOf('duckHit') !== -1, 'duckHit');
assert.ok(src.indexOf('winSting') !== -1 || src.indexOf('case \'win\'') !== -1, 'win');
console.log('ok — audio-smoke.test.js');
