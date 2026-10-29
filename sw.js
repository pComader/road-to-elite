// Road To Elite · service worker: guarda la "carcasa" de la app para que abra rápido.
// Nunca guarda datos (las peticiones al Apps Script y a Google van siempre a la red).
var VERSION = 'rte-v0.4.0';
var CARCASA = ['./', 'index.html', 'styles.css', 'app.js', 'config.js', 'manifest.webmanifest', 'icon.svg', 'icon-192.png', 'icon-512.png'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(VERSION).then(function (c) { return c.addAll(CARCASA); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  var url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;   // solo archivos propios
  // Red primero (para recibir siempre la última versión); si no hay conexión, la copia guardada.
  // no-cache: revalida con GitHub Pages en vez de usar su caché HTTP (10 min)
  e.respondWith(fetch(new Request(e.request, { cache: 'no-cache' })).then(function (r) {
    var copia = r.clone();
    caches.open(VERSION).then(function (c) { c.put(e.request, copia); });
    return r;
  }).catch(function () { return caches.match(e.request); }));
});
