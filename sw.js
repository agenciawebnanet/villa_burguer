'use strict';

const cachePrefix = 'villa-burguer-';
const cacheName = cachePrefix + 'v2';
const shell = [
  'index.html', 'estilo.css', 'catalogo.js', 'menu.js', 'pwa.js', 'ramo.svg',
  'manifest.webmanifest', 'app-192.png', 'app-512.png',
  'fotos/0.webp', 'fotos/6.webp', 'fotos/15.webp', 'fotos/22.webp', 'fotos/31.webp',
  'fotos/32.webp', 'fotos/38.webp', 'fotos/39.webp', 'fotos/45.webp',
];
const appUrl = path => new URL(path, self.registration.scope).href;

self.addEventListener('install', event => {
  event.waitUntil(caches.open(cacheName).then(cache => cache.addAll(shell.map(appUrl))));
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith(cachePrefix) && key !== cacheName)
      .map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET' || !request.url.startsWith(self.registration.scope)) return;

  const url = new URL(request.url);
  const photosPath = new URL('fotos/', self.registration.scope).pathname;
  const photo = url.pathname.startsWith(photosPath);
  const navigation = request.mode === 'navigate' &&
    (url.pathname === new URL(self.registration.scope).pathname || url.pathname === new URL(appUrl('index.html')).pathname);
  if (!navigation && !photo && !shell.some(path => appUrl(path) === url.href)) return;

  event.respondWith((async () => {
    const cache = await caches.open(cacheName);
    const cacheKey = navigation ? appUrl('index.html') : request;
    if (photo) {
      const cached = await cache.match(cacheKey);
      if (cached) return cached;
    }
    try {
      const response = await fetch(request);
      if (response.ok) await cache.put(cacheKey, response.clone()).catch(() => {});
      return response;
    } catch {
      return (await cache.match(cacheKey)) || Response.error();
    }
  })());
});
