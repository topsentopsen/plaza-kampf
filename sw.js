/* Plaza-Kampf SW v3.8 */
var CACHE = 'plaza-kampf-v3.8';
var ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './js/palette.js?v=3.8',
  './js/chars.js?v=3.8',
  './js/kampf.js?v=3.8',
  './js/netz.js?v=3.8',
  './js/sound.js?v=3.8',
  './js/levels.js?v=3.8',
  './js/render.js?v=3.8',
  './js/ki.js?v=3.8',
  './js/ui.js?v=3.8',
  './js/main.js?v=3.8'
];
self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(ASSETS); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  e.respondWith(
    fetch(req).then(function (res) {
      var copy = res.clone();
      caches.open(CACHE).then(function (c) { c.put(req, copy); });
      return res;
    }).catch(function () { return caches.match(req); })
  );
});
