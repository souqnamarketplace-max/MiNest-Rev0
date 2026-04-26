/**
 * POST /api/stripe/webhook
 *
 * Receives Stripe webhook events. Verifies the signature using
 * STRIPE_WEBHOOK_SECRET. Idempotency-checks against
 * stripe_webhook_events. Dispatches by event type.
 *
 * Critical implementation notes:
 *
 * 1. Stripe signs the raw request body. Vercel automatically parses
 *    JSON bodies which DESTROYS the signature. We must read the raw
 *    body before any JSON parsing happens. The bodyParser config at
 *    the bottom of this file disables Vercel's auto-parsing.
 *
 * 2. Stripe retries non-200 responses for up to 3 days. Always
 *    return 200 even for events we don't care about — log them and
 *    move on.
 *
 * 3. Events can be delivered multiple times. We dedupe on event_id
 *    via the stripe_webhook_events table (PRIMARY KEY = event_id).
 *
 * 4. This handler is the ONE place where we trust DB writes from
 *    Stripe state. The frontend's /connect/status endpoint also
 *    writes, but only with the user's own Authorization. Webhooks
 *    use service_role which bypasses RLS.
 *
 * Phase 1 scope: handle 'account.updated' only. Future phases will
 * add invoice.paid, customer.subscription.*, charge.refunded, etc.
 * Unknown events are logged with outcome='ignored' and we return 200.
 */
import { stripe, STRIPE_LIVEMODE } from "../_lib/stripe.js";
import { supabaseAdmin } from "../_lib/supabaseAdmin.js";

// Vercel-specific: opt out of body parsing so we get the raw bytes
// for signature verification.
export const config = {
  api: {
    bodyParser: false,
  },
};

// Read the raw request body as a buffer.
async function readRawBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!stripe) return res.status(500).json({ error: "Stripe not configured" });
  if (!supabaseAdmin) return res.status(500).json({ error: "Supabase not configured" });

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("[webhook] STRIPE_WEBHOOK_SECRET is missing — cannot verify signature");
    // Refuse to process — without signature verification anyone could POST fake events.
    return res.status(500).json({ error: "Webhook secret not configured" });
  }

  // 1. Read raw body
  let rawBody;
  try {
    rawBody = await readRawBody(req);
  } catch (err) {
    console.error("[webhook] Failed to read raw body:", err.message);
    return res.status(400).json({ error: "Failed to read body" });
  }

  // 2. Verify signature
  const signature = req.headers["stripe-signature"];
  if (!signature) {
    console.warn("[webhook] Missing Stripe-Signature header");
    return res.status(400).json({ error: "Missing signature" });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    console.error("[webhook] Signature verification failed:", err.message);
    return res.status(400).json({ error: "Invalid signature" });
  }

  // 3. Safety check: livemode must match our key's mode
  if (event.livemode !== STRIPE_LIVEMODE) {
    console.error(
      `[webhook] livemode mismatch — event.livemode=${event.livemode} but key is ${
        STRIPE_LIVEMODE ? "live" : "test"
      }. Refusing to process.`
    );
    return res.status(400).json({ error: "Livemode mismatch" });
  }

  // 4. Idempotency: have we processed this event before?
  const { data: existing } = await supabaseAdmin
    .from("stripe_webhook_events")
    .select("event_id, outcome")
    .eq("event_id", event.id)
    .maybeSingle();

  if (existing) {
    console.log(`[webhook] Duplicate event ${event.id} (${event.type}) — already processed with outcome=${existing.outcome}`);
    return res.status(200).json({ received: true, deduped: true });
  }

  // 5. Dispatch by type
  let outcome = "ok";
  let errorMessage = null;
  try {
    switch (event.type) {
      case "account.updated":
        await handleAccountUpdated(event);
        break;
      // Future phases will add more cases here:
      //   - checkout.session.completed
      //   - customer.subscription.created/updated/deleted
      //   - invoice.paid / invoice.payment_failed
      //   - charge.refunded
      //   - charge.dispute.created / .closed
      default:
        outcome = "ignored";
        console.log(`[webhook] Ignoring event type ${event.type}`);
    }
  } catch (err) {
    outcome = "error";
    errorMessage = err.message;
    console.error(`[webhook] Handler for ${event.type} failed:`, err);
    // Don't rethrow — we still want to record the event and return 200
    // to prevent Stripe retrying. If we want a retry, we'd return 500
    // instead. For Phase 1, treat handler errors as logged-and-moved-on.
  }

  // 6. Append to idempotency log
  await supabaseAdmin.from("stripe_webhook_events").insert({
    event_id: event.id,
    type: event.type,
    livemode: event.livemode,
    payload: event,
    outcome: errorMessage ? `error: ${errorMessage}` : outcome,
  });

  return res.status(200).json({ received: true, outcome });
}

/**
 * Handle account.updated — refresh our cached state for this Connect
 * account. This is the Stripe-pushed equivalent of our /connect/status
 * pull endpoint. Either should produce the same row state.
 */
async function handleAccountUpdated(event) {
  const account = event.data.object;
  if (!account?.id) {
    throw new Error("account.updated event missing account.id");
  }

  let onboardingStatus;
  if (account.charges_enabled && account.payouts_enabled) {
    onboardingStatus = "enabled";
  } else if (account.requirements?.disabled_reason) {
    onboardingStatus = "restricted";
  } else if (account.details_submitted) {
    onboardingStatus = "pending";
  } else {
    onboardingStatus = "not_started";
  }

  const { error } = await supabaseAdmin
    .from("stripe_connect_accounts")
    .update({
      charges_enabled: account.charges_enabled || false,
      payouts_enabled: account.payouts_enabled || false,
      details_submitted: account.details_submitted || false,
      onboarding_status: onboardingStatus,
      requirements_due: account.requirements || null,
      country: account.country || null,
      business_type: account.business_type || null,
    })
    .eq("stripe_account_id", account.id);

  if (error) {
    throw new Error(`Failed to update stripe_connect_accounts: ${error.message}`);
  }

  console.log(`[webhook] account.updated processed for ${account.id} → ${onboardingStatus}`);
}
