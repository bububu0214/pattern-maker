/* 離線用：第一次開過之後，冇網都用到 */
var CACHE = 'pattern-maker-v7';
var FILES = [
  './', 'index.html', 'css/style.css', 'manifest.webmanifest',
  'js/geom.js', 'js/draft.js', 'js/draft-skirt.js', 'js/draft-trousers.js', 'js/modify.js', 'js/layout.js',
  'js/export-svg.js', 'js/export-dxf.js', 'js/export-pdf.js', 'js/export-seamly.js', 'js/parse-request.js', 'js/app.js', 'js/quickpick.js',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'
];
self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(FILES); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
// 有網就用最新版本（同時更新快取），冇網就用快取
self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  e.respondWith(fetch(e.request).then(function (res) {
    var copy = res.clone();
    caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
    return res;
  }).catch(function () {
    return caches.match(e.request, { ignoreSearch: true }).then(function (r) { return r || caches.match('index.html'); });
  }));
});
