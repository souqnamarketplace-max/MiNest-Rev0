/**
 * api/_lib/stripe.js — server-side Stripe SDK initializer.
 *
 * Reads STRIPE_SECRET_KEY from the env. This file is server-only;
 * the secret key MUST NOT reach the browser bundle. Vercel
 * serverless functions run server-side, so anything in /api/* is
 * safe.
 *
 * The API version is pinned. We use 2024-06-20, the version of the
 * Stripe API current at the time this code was written. Pinning
 * means Stripe won't surprise us with breaking changes — to upgrade,
 * we change this string deliberately.
 */
import Stripe from "stripe";

const apiKey = process.env.STRIPE_SECRET_KEY;

if (!apiKey) {
  console.error(
    "[api/_lib/stripe] STRIPE_SECRET_KEY is missing. " +
    "Stripe-dependent endpoints will fail."
  );
}

if (apiKey && !apiKey.startsWith("sk_test_") && !apiKey.startsWith("sk_live_")) {
  console.error(
    "[api/_lib/stripe] STRIPE_SECRET_KEY looks malformed. Got prefix:",
    apiKey.slice(0, 10) + "..."
  );
}

export const stripe = apiKey
  ? new Stripe(apiKey, {
      apiVersion: "2024-06-20",
      typescript: false,
      appInfo: { name: "MiNest", version: "1.0.0" },
    })
  : null;

/**
 * True when stripe is sandbox (test mode), false for live.
 * Used as a safety check in webhook handlers and DB writes.
 */
export const STRIPE_LIVEMODE = apiKey?.startsWith("sk_live_") ?? false;
