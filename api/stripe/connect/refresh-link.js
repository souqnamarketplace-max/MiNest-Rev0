/**
 * POST /api/stripe/connect/refresh-link
 *
 * Stripe AccountLink URLs expire after ~5 minutes. If the user comes
 * back to MiNest mid-onboarding (e.g. closed the tab), the existing
 * link is dead. They click "Continue setup" → this endpoint → a
 * fresh URL.
 *
 * Different from /connect/onboard:
 *   - /onboard creates the Stripe account if it doesn't exist
 *   - /refresh-link only generates a new link for an existing account
 *
 * If the user has no account at all, this returns 404 — they should
 * call /onboard first.
 */
import { stripe } from "../../_lib/stripe.js";
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

  const { data: row } = await supabaseAdmin
    .from("stripe_connect_accounts")
    .select("stripe_account_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!row?.stripe_account_id) {
    return json(res, 404, { error: "No Stripe Connect account on file. Call /api/stripe/connect/onboard first." });
  }

  const origin =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://minest-xi.vercel.app");

  try {
    const accountLink = await stripe.accountLinks.create({
      account: row.stripe_account_id,
      refresh_url: `${origin}/dashboard?stripe_connect=refresh`,
      return_url: `${origin}/dashboard?stripe_connect=return`,
      type: "account_onboarding",
    });
    return json(res, 200, { url: accountLink.url });
  } catch (err) {
    console.error("[connect/refresh-link] Failed:", err.message);
    return json(res, 502, { error: "Failed to create onboarding link: " + err.message });
  }
}
