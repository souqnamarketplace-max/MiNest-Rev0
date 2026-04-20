/**
 * Updates an existing PaymentPlan for a listing:
 * 1. Archives old plan, creates new Stripe product + price
 * 2. Migrates all active tenant subscriptions to the new price
 * 3. Notifies affected tenants via in-app notification + email
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';
import Stripe from 'npm:stripe@14.21.0';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'));

async function resolveCommission(base44, owner_user_id, listing_type) {
  const rules = await base44.asServiceRole.entities.CommissionRule.filter({ is_active: true });
  const ownerRule = rules.find(r => r.rule_type === 'owner' && r.owner_user_id === owner_user_id);
  if (ownerRule) return ownerRule.commission_percentage;
  const typeRule = rules.find(r => r.rule_type === 'listing_type' && r.listing_type === listing_type);
  if (typeRule) return typeRule.commission_percentage;
  const defaultRule = rules.find(r => r.rule_type === 'default');
  return defaultRule?.commission_percentage ?? 1.0;
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { listing_id, amount, currency = 'cad', interval = 'month', description } = await req.json();
  if (!listing_id || !amount) return Response.json({ error: 'Missing listing_id or amount' }, { status: 400 });

  // Verify ownership
  const listings = await base44.entities.Listing.filter({ id: listing_id });
  const listing = listings[0];
  if (!listing || listing.owner_user_id !== user.email) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Check Stripe Connect
  const connectAccounts = await base44.entities.StripeConnectAccount.filter({ user_id: user.email });
  const connectAccount = connectAccounts[0];
  if (!connectAccount?.charges_enabled) {
    return Response.json({ error: 'Stripe account not fully set up.' }, { status: 400 });
  }

  const commission_percentage = await resolveCommission(base44, user.email, listing.listing_type);
  const amountCents = Math.round(amount * 100);

  // Archive old active plans
  const existingPlans = await base44.asServiceRole.entities.PaymentPlan.filter({ listing_id, status: 'active' });
  for (const plan of existingPlans) {
    await base44.asServiceRole.entities.PaymentPlan.update(plan.id, { status: 'archived' });
    if (plan.stripe_price_id) {
      await stripe.prices.update(plan.stripe_price_id, { active: false }).catch(() => {});
    }
  }

  // Create new Stripe Product + Price
  const product = await stripe.products.create({
    name: `Rent: ${listing.title}`,
    description: description || `Rent for ${listing.title}`,
    metadata: { listing_id, owner_user_id: user.email },
  });

  const price = await stripe.prices.create({
    product: product.id,
    unit_amount: amountCents,
    currency,
    recurring: { interval },
    metadata: { listing_id },
  });

  const platformFeeAmount = Math.round(amountCents * (commission_percentage / 100));
  const amountToOwner = amountCents - platformFeeAmount;

  // Save new plan
  const newPlan = await base44.asServiceRole.entities.PaymentPlan.create({
    listing_id,
    owner_user_id: user.email,
    amount: amountCents,
    currency,
    interval,
    commission_percentage,
    stripe_product_id: product.id,
    stripe_price_id: price.id,
    status: 'active',
    description: description || '',
  });

  // Migrate active subscriptions to new price
  const activeSubs = await base44.asServiceRole.entities.TenantSubscription.filter({
    listing_id,
    status: 'active',
  });

  let migratedCount = 0;
  for (const sub of activeSubs) {
    if (!sub.stripe_subscription_id) continue;

    // Get current Stripe subscription to find subscription item ID
    const stripeSub = await stripe.subscriptions.retrieve(sub.stripe_subscription_id).catch(() => null);
    if (!stripeSub) continue;

    const itemId = stripeSub.items.data[0]?.id;
    if (!itemId) continue;

    // Update subscription to new price, effective next billing cycle
    await stripe.subscriptions.update(sub.stripe_subscription_id, {
      items: [{ id: itemId, price: price.id }],
      proration_behavior: 'none', // take effect at next renewal, no proration charge
    }).catch(() => {});

    // Update our DB record
    await base44.asServiceRole.entities.TenantSubscription.update(sub.id, {
      payment_plan_id: newPlan.id,
      amount_per_period: amountCents,
      platform_fee_amount: platformFeeAmount,
      amount_to_owner: amountToOwner,
    });

    // Notify tenant
    const formattedAmount = `${currency.toUpperCase()} $${(amountCents / 100).toFixed(2)}`;
    const intervalLabel = interval === 'month' ? 'month' : interval === 'week' ? 'week' : 'year';

    await base44.asServiceRole.entities.Notification.create({
      user_id: sub.tenant_user_id,
      type: 'system',
      title: 'Rent amount updated',
      body: `Your rent for "${listing.title}" has been updated to ${formattedAmount}/${intervalLabel}. This takes effect on your next billing date.`,
      link: '/my-payments',
      read: false,
      dedup_key: `rent_updated_${sub.id}_${newPlan.id}`,
    });

    await base44.asServiceRole.integrations.Core.SendEmail({
      to: sub.tenant_user_id,
      subject: `Rent update for "${listing.title}"`,
      body: `Hi,\n\nYour landlord has updated the rent for "${listing.title}" to ${formattedAmount} per ${intervalLabel}.\n\nThis new amount will be charged on your next billing date. No action is required on your part.\n\nView your payments: https://minest.ca/my-payments\n\nBest,\nMiNest`,
    }).catch(() => {});

    migratedCount++;
  }

  return Response.json({
    plan: newPlan,
    commission_percentage,
    platform_fee: platformFeeAmount,
    amount_to_owner: amountToOwner,
    subscriptions_migrated: migratedCount,
  });
});