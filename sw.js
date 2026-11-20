// Guarda la app en el teléfono para que abra sin internet.
// Al cambiar cualquier archivo, sube el número de VERSION.
const VERSION = 'guia-tomas-0.3.1';
const ARCHIVOS = [
  './',
  'index.html',
  'css/app.css',
  'js/app.js',
  'js/datos.js',
  'js/edicion.js',
  'js/almacen.js',
  'js/dibujos.js',
  'js/voz.js',
  'manifest.webmanifest',
  'iconos/icono-192.png',
  'iconos/icono-512.png',
  'iconos/apple-touch-icon.png',
  'datos/ejemplo-ficticio.json',
];

self.addEventListener('install', (ev) => {
  ev.waitUntil(caches.open(VERSION).then((c) => c.addAll(ARCHIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (ev) => {
  ev.waitUntil(
    caches.keys()
      .then((claves) => Promise.all(claves.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Primero lo guardado; si no está, la red.
self.addEventListener('fetch', (ev) => {
  if (ev.request.method !== 'GET') return;
  ev.respondWith(
    caches.match(ev.request, { ignoreSearch: true }).then((r) => r || fetch(ev.request)),
  );
});
