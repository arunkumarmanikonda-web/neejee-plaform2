// Only immutable public assets and the generic offline page belong in this cache.
const CACHE_VERSION = 'neejee-mobile-v4';
const OFFLINE = '/offline';
const APP_ICON = '/brand/identity/icon-192.png?v=bindi';

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_VERSION);
    const response = await fetch(OFFLINE, { credentials: 'same-origin', cache: 'reload' });
    if (!response.ok || response.redirected || !response.headers.get('content-type')?.includes('text/html'))
      throw new Error('Offline sheet unavailable');
    await cache.put(OFFLINE, response);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k.startsWith('neejee-') && k !== CACHE_VERSION).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(async () => {
      const cache = await caches.open(CACHE_VERSION);
      return await cache.match(OFFLINE) || new Response('You are offline. Reconnect and try again.', {
        status: 503, headers: {'Content-Type':'text/plain; charset=utf-8'},
      });
    }));
    return;
  }
  if (!url.pathname.startsWith('/_next/static/') && !url.pathname.startsWith('/brand/')) return;
  if (request.headers.has('range')) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_VERSION);
    const cached = await cache.match(request);
    if (cached) return cached;
    const response = await fetch(request);
    if (response.ok && !response.redirected && response.type === 'basic'
        && !/private|no-store/i.test(response.headers.get('cache-control') || '')
        && !/text\/html/i.test(response.headers.get('content-type') || '')) {
      try { await cache.put(request, response.clone()); } catch { /* The network response remains usable when storage is full. */ }
    }
    return response;
  })());
});

function appTarget(raw) {
  try {
    const target = new URL(typeof raw === 'string' ? raw : '/', self.location.origin);
    if (target.origin === self.location.origin && !target.username && !target.password) return target.href;
  } catch {}
  return self.location.origin + '/';
}

self.addEventListener('push', event => {
  if (!event.data) return;
  let payload;
  try { payload = event.data.json(); } catch { payload = {body: event.data.text()}; }
  if (!payload || typeof payload !== 'object') payload = {};
  event.waitUntil(self.registration.showNotification(payload.title || 'Neejee', {
    body: payload.body || 'An update from Neejee.', icon: APP_ICON, badge: APP_ICON,
    data:{url:appTarget(payload.url)}, tag:payload.tag || 'neejee',
  }));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = appTarget(event.notification.data?.url);
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({type:'window', includeUncontrolled:true});
    const open = windows.find(win => win.url === target);
    if (open) return open.focus();
    return self.clients.openWindow(target);
  })());
});
