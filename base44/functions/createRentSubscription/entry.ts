/**
 * Tenant calls this to subscribe to a listing's payment plan.
 * Creates a Stripe Customer + Subscription with application fee.
 * Returns a Stripe Checkout Session URL.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';
import Stripe from 'npm:stripe@14.21.0';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'));

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { payment_plan_id, agreement_id } = await req.json();
  if (!payment_plan_id) return Response.json({ error: 'Missing payment_plan_id' }, { status: 400 });

  // Require a signed rental agreement before allowing payment
  if (!agreement_id) {
    return Response.json({ error: 'A signed rental agreement is required before setting up payments. Please ask the owner to send you a rental offer.' }, { status: 403 });
  }
  const agreements = await base44.asServiceRole.entities.RentalAgreement.filter({ id: agreement_id });
  const agreement = agreements[0];
  if (!agreement || agreement.status !== 'accepted') {
    return Response.json({ error: 'You must sign the rental agreement before setting up payments.' }, { status: 403 });
  }
  if (agreement.tenant_user_id !== user.email) {
    return Response.json({ error: 'Agreement does not match your account.' }, { status: 403 });
  }

  const origin = req.headers.get('origin') || 'https://app.base44.com';

  // Fetch the payment plan
  const plans = await base44.asServiceRole.entities.PaymentPlan.filter({ id: payment_plan_id, status: 'active' });
  const plan = plans[0];
  if (!plan) return Response.json({ error: 'Payment plan not found or inactive' }, { status: 404 });

  // Check owner's Stripe Connect account
  const connectAccounts = await base44.asServiceRole.entities.StripeConnectAccount.filter({ user_id: plan.owner_user_id });
  const connectAccount = connectAccounts[0];
  if (!connectAccount?.charges_enabled) {
    return Response.json({ error: 'Owner has not completed payment setup' }, { status: 400 });
  }

  // Prevent owner from subscribing to own listing
  if (plan.owner_user_id === user.email) {
    return Response.json({ error: 'You cannot subscribe to your own listing' }, { status: 400 });
  }

  // Check for existing active subscription
  const existingSubs = await base44.entities.TenantSubscription.filter({
    tenant_user_id: user.email,
    listing_id: plan.listing_id,
  });
  const activeSub = existingSubs.find(s => ['active', 'trialing', 'incomplete'].includes(s.status));
  if (activeSub) {
    return Response.json({ error: 'You already have an active subscription for this listing' }, { status: 409 });
  }

  // Get listing title
  const listings = await base44.asServiceRole.entities.Listing.filter({ id: plan.listing_id });
  const listingTitle = listings[0]?.title || 'Rental';

  const platformFeeAmount = Math.round(plan.amount * (plan.commission_percentage / 100));
  const depositCents = agreement.deposit_amount || 0;

  // Build line_items: recurring rent + optional one-time deposit
  const lineItems = [{ price: plan.stripe_price_id, quantity: 1 }];
  if (depositCents > 0) {
    lineItems.push({
      price_data: {
        currency: plan.currency,
        product_data: {
          name: `Security Deposit — ${listingTitle}`,
          description: 'One-time security deposit. Refundable per lease terms.',
        },
        unit_amount: depositCents,
      },
      quantity: 1,
    });
  }

  // Create Stripe Checkout Session
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: lineItems,
    customer_email: user.email,
    subscription_data: {
      application_fee_percent: plan.commission_percentage,
      transfer_data: { destination: connectAccount.stripe_account_id },
      metadata: {
        payment_plan_id,
        tenant_user_id: user.email,
        listing_id: plan.listing_id,
        owner_user_id: plan.owner_user_id,
        deposit_amount: depositCents,
      },
    },
    success_url: `${origin}/my-payments?subscription_success=1`,
    cancel_url: `${origin}/listing/${plan.listing_id}?payment_canceled=1`,
    metadata: {
      payment_plan_id,
      tenant_user_id: user.email,
      listing_id: plan.listing_id,
    },
  });

  // Create a pending TenantSubscription record
  const sub = await base44.entities.TenantSubscription.create({
    tenant_user_id: user.email,
    owner_user_id: plan.owner_user_id,
    listing_id: plan.listing_id,
    listing_title: listingTitle,
    payment_plan_id,
    status: 'incomplete',
    amount_per_period: plan.amount,
    platform_fee_amount: platformFeeAmount,
    amount_to_owner: plan.amount - platformFeeAmount,
    start_date: agreement.lease_start_date ? new Date(agreement.lease_start_date).toISOString() : new Date().toISOString(),
    end_date: agreement.lease_end_date ? new Date(agreement.lease_end_date).toISOString() : null,
  });

  // Link subscription to agreement
  await base44.asServiceRole.entities.RentalAgreement.update(agreement_id, { subscription_id: sub.id });

  return Response.json({ url: session.url, session_id: session.id });
});