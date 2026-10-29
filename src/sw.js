// Road To Elite · service worker.
// La app se abre al instante desde la copia guardada (también sin internet) y se actualiza en segundo plano.
// Nunca guarda datos de entrenamiento: las peticiones al Apps Script y a Google van siempre a la red.
var VERSION = '__VERSION__';
var CARCASA = ['./', 'index.html', 'styles.css', 'app.js', 'm-menu.js', 'm-timer.js', 'config.js', 'manifest.webmanifest', 'icon.svg', 'icon-192.png', 'icon-512.png',
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js', 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js'];
var AJENOS = /^https:\/\/(www\.gstatic\.com\/firebasejs\/|fonts\.googleapis\.com\/|fonts\.gstatic\.com\/)/;

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(VERSION).then(function (c) {
    return Promise.all(CARCASA.map(function (u) { return c.add(new Request(u, { cache: 'no-cache' })).catch(function () {}); }));
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  var req = e.request, url = new URL(req.url);
  if (req.method !== 'GET') return;
  var propio = url.origin === self.location.origin;
  if (!propio && !AJENOS.test(req.url)) return;                       // API, login, vídeos: siempre red
  var clave = propio ? new Request(url.origin + url.pathname) : req;   // ignora ?v= de los módulos
  // Copia guardada al instante; en paralelo se pide la nueva y se guarda para la próxima vez.
  e.respondWith(caches.open(VERSION).then(function (c) {
    return c.match(clave, { ignoreSearch: propio }).then(function (guardada) {
      var red = fetch(propio ? new Request(req, { cache: 'no-cache' }) : req).then(function (r) {
        if (r && (r.ok || r.type === 'opaque')) c.put(clave, r.clone());
        return r;
      });
      if (guardada) { e.waitUntil(red.catch(function () {})); return guardada; }
      return red.catch(function () { return req.mode === 'navigate' ? c.match('index.html') : Response.error(); });
    });
  }));
});

// ---------- avisos al móvil (los manda el Apps Script por Firebase Cloud Messaging) ----------
self.addEventListener('push', function (e) {
  var d = {};
  try { d = e.data ? e.data.json() : {}; } catch (x) { d = { data: { texto: e.data && e.data.text() } }; }
  var m = d.data || d.notification || d;
  e.waitUntil(self.registration.showNotification(m.titulo || m.title || 'Road To Elite', {
    body: m.texto || m.body || '', icon: 'icon-192.png', badge: 'icon-192.png', tag: m.titulo || 'rte', data: { enlace: m.enlace || './' }
  }));
});
self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (cs) {
    for (var i = 0; i < cs.length; i++) if ('focus' in cs[i]) return cs[i].focus();
    return self.clients.openWindow((e.notification.data && e.notification.data.enlace) || './');
  }));
});
