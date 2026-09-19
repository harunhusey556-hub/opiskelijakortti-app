// Opiskelijakortti — service worker (offline calisma icin)
const CACHE = 'opiskelukortti-v15';

// Ilk yuklemede onbellekle
const PRECACHE = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.webmanifest',
  './syl-logo.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './frank-text.png',
  './fonts/SF-Pro-Text-Regular.woff2',
  './fonts/SF-Pro-Text-Semibold.woff2',
  './fonts/SF-Pro-Text-Bold.woff2'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(PRECACHE))
      .then(() => self.skipWaiting())
      .catch(err => console.warn('precache kismi basarisiz:', err))
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Ag varsa guncelle, yoksa onbellekten don
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;

  e.respondWith(
    fetch(e.request)
      .then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(e.request).then(r => r || caches.match('./index.html')))
  );
});
