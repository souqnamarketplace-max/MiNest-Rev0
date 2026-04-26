/**
 * stripeClient.js — lazy loader for Stripe.js.
 *
 * Loads @stripe/stripe-js on demand the first time someone needs to
 * present checkout, NOT on every page load. This keeps initial page
 * weight down and means users who never touch a paid feature never
 * download the Stripe SDK.
 *
 * Returns a Stripe instance (or null if the publishable key isn't
 * configured — happens in dev/preview environments without env vars).
 *
 * Key pattern follows Stripe's own recommendation:
 *   https://stripe.com/docs/js/initializing
 */
import { loadStripe } from "@stripe/stripe-js";

let stripePromise = null;

/**
 * Get a singleton Stripe instance. Lazy-loaded.
 *
 * @returns {Promise<Stripe | null>} Stripe instance or null if no key
 */
export function getStripe() {
  if (stripePromise) return stripePromise;

  const publishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;

  if (!publishableKey) {
    console.warn(
      "[stripeClient] VITE_STRIPE_PUBLISHABLE_KEY is not set. " +
      "Stripe-dependent features (boost checkout, subscriptions) will be disabled. " +
      "Set the env var in Vercel and redeploy."
    );
    return Promise.resolve(null);
  }

  // Optional sanity check — sandbox keys start with pk_test_,
  // production with pk_live_. Warn loudly if something unexpected
  // shows up (a mismatched env, accidentally pasting the secret key,
  // etc.) — but don't refuse to load.
  if (!publishableKey.startsWith("pk_test_") && !publishableKey.startsWith("pk_live_")) {
    console.error(
      "[stripeClient] VITE_STRIPE_PUBLISHABLE_KEY looks malformed " +
      "(should start with pk_test_ or pk_live_). Got:",
      publishableKey.slice(0, 10) + "..."
    );
  }

  stripePromise = loadStripe(publishableKey);
  return stripePromise;
}

/**
 * Whether the Stripe client is configured (publishable key present).
 * Useful for conditionally rendering "Pay" buttons vs "Coming soon"
 * placeholders without importing the entire Stripe SDK to find out.
 *
 * @returns {boolean}
 */
export function isStripeConfigured() {
  return Boolean(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);
}
