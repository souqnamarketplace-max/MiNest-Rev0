/**
 * MiNest Service Worker — PWA offline support & caching
 */
const CACHE_NAME = 'minest-v1';
const STATIC_ASSETS = [
  '/',
  '/search',
  '/roommates',
  '/how-it-works',
  '/pricing',
];

// Install: cache static pages
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS).catch(() => {}))
  );
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch strategy: Network first, cache fallback
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET, API calls, Supabase, external
  if (request.method !== 'GET') return;
  if (url.pathname.startsWith('/api/')) return;
  if (url.hostname.includes('supabase.co')) return;
  if (url.hostname.includes('supabase.io')) return;
  if (url.pathname.includes('auth')) return;
  if (url.hostname.includes('resend.com')) return;
  if (url.hostname !== self.location.hostname && !url.hostname.includes('openstreetmap')) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        // Cache successful HTML/JS/CSS responses
        if (response.ok && (request.destination === 'document' || request.destination === 'script' || request.destination === 'style')) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone)).catch(() => {});
        }
        return response;
      })
      .catch(() =>
        caches.match(request).then((cached) => {
          if (cached) return cached;
          // Offline fallback for navigation
          if (request.destination === 'document') {
            return caches.match('/').then((r) => r || new Response('MiNest is offline. Please check your connection.', { headers: { 'Content-Type': 'text/html' } }));
          }
          return new Response('', { status: 503 });
        })
      )
  );
});

// Push notifications (placeholder for future FCM)
self.addEventListener('push', (event) => {
  if (!event.data) return;
  try {
    const data = event.data.json();
    event.waitUntil(
      self.registration.showNotification(data.title || 'MiNest', {
        body: data.body,
        icon: '/icon-192.png',
        badge: '/icon-badge.png',
        data: { url: data.url || '/' },
        vibrate: [100, 50, 100],
      })
    );
  } catch {}
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(clients.openWindow(url));
});
