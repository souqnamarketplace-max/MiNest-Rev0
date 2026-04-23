/**
 * MiNest Push Notification Service
 * Handles browser push notification registration via Firebase Cloud Messaging.
 * 
 * Setup: Set these env vars in Vercel:
 *   VITE_FIREBASE_API_KEY
 *   VITE_FIREBASE_AUTH_DOMAIN
 *   VITE_FIREBASE_PROJECT_ID
 *   VITE_FIREBASE_MESSAGING_SENDER_ID
 *   VITE_FIREBASE_APP_ID
 *   VITE_FIREBASE_VAPID_KEY
 */

import { supabase } from '@/lib/supabase';

const FIREBASE_CONFIG = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY;

let messaging = null;
let swRegistration = null;

/**
 * Check if push notifications are supported
 */
export function isPushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

/**
 * Get current permission status
 */
export function getPushPermission() {
  if (!isPushSupported()) return 'unsupported';
  return Notification.permission; // 'granted' | 'denied' | 'default'
}

/**
 * Initialize Firebase Messaging (lazy load)
 */
async function initFirebase() {
  if (messaging) return messaging;
  if (!FIREBASE_CONFIG.apiKey || !FIREBASE_CONFIG.projectId) {
    console.warn('[Push] Firebase not configured — missing env vars');
    return null;
  }

  try {
    const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js');
    const { getMessaging } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging.js');

    const app = initializeApp(FIREBASE_CONFIG);
    
    // Register service worker (config is hardcoded in the SW file)
    swRegistration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');

    messaging = getMessaging(app);
    return messaging;
  } catch (err) {
    console.error('[Push] Firebase init failed:', err);
    return null;
  }
}

/**
 * Request push notification permission and get FCM token.
 * Saves the token to the user's profile in Supabase.
 * Returns the token or null if denied/failed.
 */
export async function requestPushPermission(userId) {
  if (!isPushSupported()) return null;
  if (!userId) return null;

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.log('[Push] Permission denied');
      return null;
    }

    const msg = await initFirebase();
    if (!msg) return null;

    const { getToken } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging.js');
    
    const token = await getToken(msg, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: swRegistration,
    });

    if (!token) {
      console.warn('[Push] No token received');
      return null;
    }

    // Save token to Supabase
    await savePushToken(userId, token);
    console.log('[Push] Token registered successfully');
    return token;
  } catch (err) {
    console.error('[Push] Failed to get token:', err);
    return null;
  }
}

/**
 * Save FCM token to the push_tokens table in Supabase
 */
async function savePushToken(userId, token) {
  try {
    // Upsert — if this token already exists for this user, update it
    const { error } = await supabase
      .from('push_tokens')
      .upsert(
        {
          user_id: userId,
          token: token,
          platform: detectPlatform(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'token' }
      );

    if (error) {
      console.error('[Push] Failed to save token:', error.message);
    }
  } catch (err) {
    console.error('[Push] savePushToken error:', err);
  }
}

/**
 * Remove push token (on logout or unsubscribe)
 */
export async function removePushToken(userId) {
  if (!userId) return;
  try {
    await supabase
      .from('push_tokens')
      .delete()
      .eq('user_id', userId);
  } catch (err) {
    console.error('[Push] removePushToken error:', err);
  }
}

/**
 * Listen for foreground messages (when app is open)
 */
export async function onForegroundMessage(callback) {
  const msg = await initFirebase();
  if (!msg) return () => {};

  const { onMessage } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging.js');
  return onMessage(msg, (payload) => {
    callback(payload);
  });
}

/**
 * Detect user's platform
 */
function detectPlatform() {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua)) return 'ios';
  if (/Android/.test(ua)) return 'android';
  return 'web';
}
