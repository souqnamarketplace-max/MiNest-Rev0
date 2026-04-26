/**
 * POST /api/stripe/connect/onboard
 *
 * Creates a Stripe Connect Express account for the calling user
 * (if they don't already have one), then returns a URL to Stripe's
 * hosted onboarding flow.
 *
 * The landlord clicks "Connect Bank Account" in the UI, which calls
 * this endpoint, gets a URL, and is redirected there. Stripe collects
 * KYC info, identity verification, and bank account details. When
 * complete, Stripe redirects back to /dashboard?stripe_connect=success.
 *
 * Idempotent: if the user already has a Connect account row, we
 * reuse the existing stripe_account_id and just generate a fresh
 * onboarding link (links expire after 5 minutes by Stripe's design).
 *
 * Request body: optional { country: 'CA' | 'US' } — defaults to user_profiles.country.
 * Response: { url, stripe_account_id, onboarding_status }
 */
import { stripe, STRIPE_LIVEMODE } from "../../_lib/stripe.js";
import { supabaseAdmin } from "../../_lib/supabaseAdmin.js";
import { requireUser, json } from "../../_lib/auth.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return json(res, 405, { error: "Method not allowed" });
  }

  if (!stripe) return json(res, 500, { error: "Stripe not configured" });
  if (!supabaseAdmin) return json(res, 500, { error: "Supabase not configured" });

  const { user, error: authError } = await requireUser(req);
  if (!user) return json(res, 401, { error: authError || "Unauthorized" });

  // Determine country: from request body or fall back to profile
  let country = req.body?.country;
  if (!country) {
    const { data: profile } = await supabaseAdmin
      .from("user_profiles")
      .select("country")
      .eq("user_id", user.id)
      .maybeSingle();
    country = profile?.country || "CA";
  }
  if (country !== "CA" && country !== "US") {
    return json(res, 400, { error: `Unsupported country: ${country}. Use CA or US.` });
  }

  // Find an existing connect account row, if any
  const { data: existing } = await supabaseAdmin
    .from("stripe_connect_accounts")
    .select("id, stripe_account_id, onboarding_status, charges_enabled, payouts_enabled")
    .eq("user_id", user.id)
    .maybeSingle();

  let stripeAccountId = existing?.stripe_account_id;

  // Create a new Express account if needed
  if (!stripeAccountId) {
    try {
      const account = await stripe.accounts.create({
        type: "express",
        country,
        email: user.email,
        capabilities: {
          transfers: { requested: true },
          // For destination charges (our pattern) we don't need card_payments capability
          // on the connected account — payments are processed by the platform.
        },
        business_type: "individual", // landlords default to individual; can be updated later
        metadata: {
          minest_user_id: user.id,
        },
      });
      stripeAccountId = account.id;

      // Insert the new row
      const { error: insertError } = await supabaseAdmin
        .from("stripe_connect_accounts")
        .insert({
          user_id: user.id,
          stripe_account_id: stripeAccountId,
          country,
          onboarding_status: "pending",
          charges_enabled: false,
          payouts_enabled: false,
          details_submitted: false,
          business_type: "individual",
          livemode: STRIPE_LIVEMODE,
        });

      if (insertError) {
        console.error("[connect/onboard] Failed to insert connect account row:", insertError);
        // Don't bail — we have the Stripe account, just couldn't cache it.
        // Status endpoint will reconcile on next check.
      }
    } catch (err) {
      console.error("[connect/onboard] Stripe account creation failed:", err.message);
      return json(res, 502, { error: "Failed to create Stripe account: " + err.message });
    }
  }

  // Build the redirect URLs. VERCEL_URL is set automatically in Vercel; in dev we fall back.
  const origin =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://minest-xi.vercel.app");

  // Create the account link (the actual onboarding URL)
  let accountLink;
  try {
    accountLink = await stripe.accountLinks.create({
      account: stripeAccountId,
      refresh_url: `${origin}/dashboard?stripe_connect=refresh`,
      return_url: `${origin}/dashboard?stripe_connect=return`,
      type: "account_onboarding",
    });
  } catch (err) {
    console.error("[connect/onboard] Account link creation failed:", err.message);
    return json(res, 502, { error: "Failed to create onboarding link: " + err.message });
  }

  return json(res, 200, {
    url: accountLink.url,
    stripe_account_id: stripeAccountId,
    onboarding_status: existing?.onboarding_status || "pending",
  });
}
