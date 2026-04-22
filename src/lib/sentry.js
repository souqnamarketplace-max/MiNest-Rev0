/**
 * Sentry Error Tracking for MiNest
 * Captures unhandled errors, rejected promises, and performance data.
 * Only active when VITE_SENTRY_DSN is set.
 */

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN;
const ENVIRONMENT = import.meta.env.VITE_SENTRY_ENVIRONMENT || 'development';
const IS_PRODUCTION = ENVIRONMENT === 'production';

let sentryLoaded = false;

/**
 * Initialize Sentry — called once in main.jsx
 * Uses dynamic import so Sentry is only loaded when DSN is configured
 */
export async function initSentry() {
  if (!SENTRY_DSN || sentryLoaded) return;
  
  try {
    const Sentry = await import('https://cdn.jsdelivr.net/npm/@sentry/browser@8/+esm');
    
    Sentry.init({
      dsn: SENTRY_DSN,
      environment: ENVIRONMENT,
      
      // Only send 10% of transactions in production to save quota
      tracesSampleRate: IS_PRODUCTION ? 0.1 : 1.0,
      
      // Capture 100% of errors
      sampleRate: 1.0,
      
      // Don't send PII
      sendDefaultPii: false,
      
      // Filter out noisy errors
      ignoreErrors: [
        'ResizeObserver loop',
        'Non-Error promise rejection',
        'Load failed',
        'Failed to fetch',
        'NetworkError',
        'ChunkLoadError',
        'NavigatorLockAcquireTimeoutError',
      ],
      
      beforeSend(event) {
        // Strip sensitive data from URLs
        if (event.request?.url) {
          try {
            const url = new URL(event.request.url);
            url.searchParams.delete('token');
            url.searchParams.delete('key');
            event.request.url = url.toString();
          } catch {}
        }
        return event;
      },
    });
    
    sentryLoaded = true;
    console.log('[Sentry] Initialized for', ENVIRONMENT);
  } catch (err) {
    // Sentry failed to load — don't break the app
    console.warn('[Sentry] Failed to initialize:', err.message);
  }
}

/**
 * Capture a custom error
 */
export function captureError(error, context = {}) {
  if (!sentryLoaded) {
    console.error('[Error]', error, context);
    return;
  }
  
  try {
    import('https://cdn.jsdelivr.net/npm/@sentry/browser@8/+esm').then(Sentry => {
      Sentry.withScope(scope => {
        Object.entries(context).forEach(([key, val]) => scope.setExtra(key, val));
        Sentry.captureException(error);
      });
    });
  } catch {}
}

/**
 * Set the current user for error context
 */
export function setUser(user) {
  if (!sentryLoaded || !user) return;
  
  try {
    import('https://cdn.jsdelivr.net/npm/@sentry/browser@8/+esm').then(Sentry => {
      Sentry.setUser({
        id: user.id,
        email: user.email,
      });
    });
  } catch {}
}

/**
 * Clear user on logout
 */
export function clearUser() {
  if (!sentryLoaded) return;
  
  try {
    import('https://cdn.jsdelivr.net/npm/@sentry/browser@8/+esm').then(Sentry => {
      Sentry.setUser(null);
    });
  } catch {}
}
