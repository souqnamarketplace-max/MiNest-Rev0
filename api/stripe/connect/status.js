/**
 * GET /api/stripe/connect/status
 *
 * Reads the calling user's Stripe Connect account, fetches latest
 * state from Stripe, mirrors it to the DB, and returns it.
 *
 * Called by the frontend on:
 *   - Initial Payments tab load
 *   - When the user returns from Stripe-hosted onboarding (the URL
 *     has ?stripe_connect=return)
 *   - Periodically while waiting for KYC to complete (every ~10s)
 *
 * Returns:
 *   { connected: false }                    — no account on file
 *   { connected: true, charges_enabled, payouts_enabled,
 *     details_submitted, onboarding_status, requirements_due,
 *     stripe_account_id, country }
 *
 * Stripe is the source of truth — our DB is just a cache. So we
 * always re-fetch from Stripe and overwrite our row. This is safe
 * because Stripe's account data is small (one object) and we only
 * call this on user-initiated checks.
 */
import { stripe } from "../../_lib/stripe.js";
import { supabaseAdmin } from "../../_lib/supabaseAdmin.js";
import { requireUser, json } from "../../_lib/auth.js";

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
    return json(res, 405, { error: "Method not allowed" });
  }

  if (!stripe) return json(res, 500, { error: "Stripe not configured" });
  if (!supabaseAdmin) return json(res, 500, { error: "Supabase not configured" });

  const { user, error: authError } = await requireUser(req);
  if (!user) return json(res, 401, { error: authError || "Unauthorized" });

  const { data: row } = await supabaseAdmin
    .from("stripe_connect_accounts")
    .select("stripe_account_id, country")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!row?.stripe_account_id) {
    return json(res, 200, { connected: false });
  }

  // Fetch from Stripe
  let account;
  try {
    account = await stripe.accounts.retrieve(row.stripe_account_id);
  } catch (err) {
    console.error("[connect/status] Stripe retrieve failed:", err.message);
    return json(res, 502, { error: "Failed to fetch account from Stripe: " + err.message });
  }

  // Compute onboarding_status
  let onboardingStatus;
  if (account.charges_enabled && account.payouts_enabled) {
    onboardingStatus = "enabled";
  } else if (account.requirements?.disabled_reason) {
    onboardingStatus = "restricted";
  } else if (account.details_submitted) {
    onboardingStatus = "pending"; // KYC submitted, awaiting Stripe review
  } else {
    onboardingStatus = "not_started";
  }

  // Mirror to DB
  const { error: updateError } = await supabaseAdmin
    .from("stripe_connect_accounts")
    .update({
      charges_enabled: account.charges_enabled || false,
      payouts_enabled: account.payouts_enabled || false,
      details_submitted: account.details_submitted || false,
      onboarding_status: onboardingStatus,
      requirements_due: account.requirements || null,
      country: account.country || row.country,
      business_type: account.business_type || null,
    })
    .eq("user_id", user.id);

  if (updateError) {
    console.error("[connect/status] DB update failed:", updateError);
    // Return Stripe data anyway — DB cache is non-critical
  }

  return json(res, 200, {
    connected: true,
    stripe_account_id: account.id,
    country: account.country,
    charges_enabled: !!account.charges_enabled,
    payouts_enabled: !!account.payouts_enabled,
    details_submitted: !!account.details_submitted,
    onboarding_status: onboardingStatus,
    requirements_due: account.requirements || null,
  });
}
