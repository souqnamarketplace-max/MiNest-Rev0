/**
 * Disconnects a homeowner's Stripe Connect account.
 * Existing subscriptions continue, but new payments cannot be set up.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  // Find the user's Stripe Connect account
  const accounts = await base44.entities.StripeConnectAccount.filter({ user_id: user.email });
  const account = accounts[0];
  if (!account) {
    return Response.json({ error: 'No Stripe account connected' }, { status: 404 });
  }

  // Disable payments on all listings
  const listings = await base44.entities.Listing.filter({ owner_user_id: user.email });
  for (const listing of listings) {
    if (listing.payments_enabled) {
      await base44.entities.Listing.update(listing.id, { payments_enabled: false });
    }
  }

  // Archive all active payment plans
  const plans = await base44.entities.PaymentPlan.filter({
    owner_user_id: user.email,
    status: 'active',
  });
  for (const plan of plans) {
    await base44.entities.PaymentPlan.update(plan.id, { status: 'archived' });
  }

  // Update the Stripe Connect account status — clear stripe_account_id so status check doesn't re-sync with Stripe
  await base44.entities.StripeConnectAccount.update(account.id, {
    stripe_account_id: null,
    onboarding_status: 'not_started',
    charges_enabled: false,
    payouts_enabled: false,
    details_submitted: false,
  });

  return Response.json({ success: true });
});