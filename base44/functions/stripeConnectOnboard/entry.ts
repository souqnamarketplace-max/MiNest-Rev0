/**
 * Creates or retrieves a Stripe Connect account for a homeowner,
 * then returns an onboarding link URL.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';
import Stripe from 'npm:stripe@14.21.0';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'));

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { return_url } = await req.json().catch(() => ({}));
  const origin = req.headers.get('origin') || 'https://app.base44.com';
  const redirectUrl = return_url || `${origin}/dashboard?tab=payments`;

  // Find existing connect account record
  const existing = await base44.entities.StripeConnectAccount.filter({ user_id: user.email });
  let record = existing[0];

  let stripeAccountId;

  if (record?.stripe_account_id) {
    stripeAccountId = record.stripe_account_id;
    // Re-check account status from Stripe
    const account = await stripe.accounts.retrieve(stripeAccountId);
    const updatedData = {
      charges_enabled: account.charges_enabled,
      payouts_enabled: account.payouts_enabled,
      details_submitted: account.details_submitted,
      onboarding_status: account.details_submitted
        ? (account.charges_enabled ? 'completed' : 'requires_attention')
        : 'in_progress',
    };
    await base44.entities.StripeConnectAccount.update(record.id, updatedData);
    record = { ...record, ...updatedData };

    // If already fully onboarded, generate a dashboard/update link instead of returning early
    // so the user can always reach Stripe (e.g. after a UI-side "disconnect" that cleared the DB record
    // but left the Stripe account intact)
  } else {
    // Create a new Stripe Connect Express account
    const account = await stripe.accounts.create({
      type: 'express',
      country: 'CA',
      email: user.email,
      capabilities: { transfers: { requested: true } },
    });
    stripeAccountId = account.id;

    const saveData = {
      user_id: user.email,
      stripe_account_id: account.id,
      onboarding_status: 'in_progress',
      charges_enabled: false,
      payouts_enabled: false,
      details_submitted: false,
    };
    if (record) {
      await base44.entities.StripeConnectAccount.update(record.id, saveData);
    } else {
      record = await base44.entities.StripeConnectAccount.create(saveData);
    }
  }

  // Create an account link for onboarding
  const accountLink = await stripe.accountLinks.create({
    account: stripeAccountId,
    refresh_url: `${origin}/dashboard?tab=payments&onboard_refresh=1`,
    return_url: redirectUrl,
    type: 'account_onboarding',
  });

  return Response.json({ url: accountLink.url, status: record.onboarding_status });
});