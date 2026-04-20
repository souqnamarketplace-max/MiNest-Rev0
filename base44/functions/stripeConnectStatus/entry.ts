/**
 * Checks and syncs the current user's Stripe Connect account status.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';
import Stripe from 'npm:stripe@14.21.0';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'));

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const existing = await base44.entities.StripeConnectAccount.filter({ user_id: user.email });
  const record = existing[0];

  if (!record?.stripe_account_id) {
    return Response.json({ status: 'not_started', connected: false });
  }

  // Sync with Stripe
  const account = await stripe.accounts.retrieve(record.stripe_account_id);
  const onboarding_status = account.details_submitted
    ? (account.charges_enabled ? 'completed' : 'requires_attention')
    : 'in_progress';

  await base44.entities.StripeConnectAccount.update(record.id, {
    charges_enabled: account.charges_enabled,
    payouts_enabled: account.payouts_enabled,
    details_submitted: account.details_submitted,
    onboarding_status,
  });

  return Response.json({
    connected: account.charges_enabled,
    charges_enabled: account.charges_enabled,
    payouts_enabled: account.payouts_enabled,
    onboarding_status,
    stripe_account_id: record.stripe_account_id,
  });
});