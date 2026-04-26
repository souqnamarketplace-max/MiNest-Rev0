/**
 * stripeApi.js — frontend helpers for our Stripe-related serverless
 * endpoints. The endpoints themselves (`/api/stripe/*`) will be
 * implemented in Phase 2.
 *
 * For Phase 1 these are plumbing-only: they exist so any UI code we
 * write later can import them, but calling them now will return a
 * sensible "not yet implemented" error rather than crashing.
 *
 * Authentication: requests carry the Supabase access token as a
 * Bearer header so the server can identify the calling user. The
 * server never trusts client-provided user_id.
 */
import { supabase } from "@/lib/supabase";

async function authHeaders() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const headers = { "Content-Type": "application/json" };
  if (session?.access_token) {
    headers.Authorization = `Bearer ${session.access_token}`;
  }
  return headers;
}

/**
 * Get-or-create a Stripe customer for the signed-in user.
 * Returns { stripe_customer_id } on success.
 *
 * Phase 2 wires the server endpoint. Phase 1 returns a clear error.
 */
export async function getOrCreateStripeCustomer() {
  const res = await fetch("/api/stripe/get-or-create-customer", {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify({}),
  });
  if (!res.ok) {
    const err = await res.text().catch(() => res.statusText);
    throw new Error(`getOrCreateStripeCustomer failed: ${err}`);
  }
  return res.json();
}

/**
 * Create a Stripe Checkout Session for boosting a single listing for
 * `days` days. Pricing comes from the server's read of boost_settings
 * — the client never decides the amount.
 *
 * @param {string} listingId
 * @param {number} days  1-30
 * @returns {Promise<{ url: string }>}  Stripe-hosted checkout URL
 */
export async function createBoostCheckoutSession(listingId, days) {
  const res = await fetch("/api/stripe/create-boost-checkout", {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify({ listing_id: listingId, days }),
  });
  if (!res.ok) {
    const err = await res.text().catch(() => res.statusText);
    throw new Error(`createBoostCheckoutSession failed: ${err}`);
  }
  return res.json();
}

/**
 * Create a Stripe Checkout Session for the Rental Management
 * subscription. Only succeeds if there's an active row in
 * `payment_plans` with `is_active = true`.
 *
 * @param {string} planSlug  e.g. 'rental_management'
 * @returns {Promise<{ url: string }>}
 */
export async function createSubscriptionCheckoutSession(planSlug) {
  const res = await fetch("/api/stripe/create-subscription-checkout", {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify({ plan_slug: planSlug }),
  });
  if (!res.ok) {
    const err = await res.text().catch(() => res.statusText);
    throw new Error(`createSubscriptionCheckoutSession failed: ${err}`);
  }
  return res.json();
}

/**
 * Open the Stripe Customer Portal so the user can update payment
 * methods, cancel subscriptions, view invoices, etc. Stripe-hosted.
 *
 * @returns {Promise<{ url: string }>}
 */
export async function openCustomerPortal() {
  const res = await fetch("/api/stripe/customer-portal", {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify({}),
  });
  if (!res.ok) {
    const err = await res.text().catch(() => res.statusText);
    throw new Error(`openCustomerPortal failed: ${err}`);
  }
  return res.json();
}

/**
 * Whether the current user has any active or trialing subscription.
 * Reads from our cached `stripe_subscriptions` table (populated by
 * the webhook handler in Phase 2). RLS limits to own rows.
 *
 * Used by the Rentals tab gate (#13): the tab is shown when the user
 * has either active leases OR an active subscription.
 *
 * @returns {Promise<boolean>}
 */
export async function hasActiveSubscription() {
  const { data, error } = await supabase
    .from("stripe_subscriptions")
    .select("id, status")
    .in("status", ["active", "trialing"])
    .limit(1);

  if (error) {
    console.warn("[stripeApi] hasActiveSubscription read failed:", error.message);
    return false; // fail-closed: don't show paid UI if we can't verify
  }
  return (data?.length || 0) > 0;
}
