// Firebase Messaging Service Worker
// CRITICAL: All event handlers must be registered at the top level during initial evaluation

importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

// Initialize Firebase immediately at the top level
// Config is hardcoded here because service workers can't access import.meta.env
// These are public keys (safe to expose) — they only identify the Firebase project
firebase.initializeApp({
  apiKey: "AIzaSyDrISifC_yuRbJF_7Hiv4E0OM_J_IVxhJ4",
  authDomain: "minest-70bc2.firebaseapp.com",
  projectId: "minest-70bc2",
  storageBucket: "minest-70bc2.firebasestorage.app",
  messagingSenderId: "717987535014",
  appId: "1:717987535014:web:294cf9089925caa1b4fc67",
});

const messaging = firebase.messaging();

// Handle background messages (when app is not in focus)
messaging.onBackgroundMessage((payload) => {
  const { title, body, icon } = payload.notification || {};
  const data = payload.data || {};

  self.registration.showNotification(title || 'MiNest', {
    body: body || 'You have a new notification',
    icon: icon || '/icons/icon-192.png',
    badge: '/icons/icon-72.png',
    tag: data.notification_id || 'minest-' + Date.now(),
    data: { url: data.link || '/' },
  });
});

// Handle notification click — open the app at the right page
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          client.navigate(url);
          return;
        }
      }
      return clients.openWindow(url);
    })
  );
});
