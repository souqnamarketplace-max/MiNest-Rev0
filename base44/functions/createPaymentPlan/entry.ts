/**
 * Creates a PaymentPlan for a listing, including a Stripe Product + Price.
 * Resolves commission from CommissionRule (owner-specific > listing_type > default).
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';
import Stripe from 'npm:stripe@14.21.0';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'));

async function resolveCommission(base44, owner_user_id, listing_type) {
  const rules = await base44.asServiceRole.entities.CommissionRule.filter({ is_active: true });
  // Priority: owner-specific > listing_type > default
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

  // Check Stripe Connect account
  const connectAccounts = await base44.entities.StripeConnectAccount.filter({ user_id: user.email });
  const connectAccount = connectAccounts[0];
  if (!connectAccount?.charges_enabled) {
    return Response.json({ error: 'Stripe account not fully set up. Please complete onboarding first.' }, { status: 400 });
  }

  // Deactivate any existing plan for this listing
  const existingPlans = await base44.entities.PaymentPlan.filter({ listing_id, status: 'active' });
  for (const plan of existingPlans) {
    await base44.entities.PaymentPlan.update(plan.id, { status: 'archived' });
    if (plan.stripe_price_id) {
      await stripe.prices.update(plan.stripe_price_id, { active: false }).catch(() => {});
    }
  }

  // Resolve commission
  const commission_percentage = await resolveCommission(base44, user.email, listing.listing_type);

  // Create Stripe Product
  const product = await stripe.products.create({
    name: `Rent: ${listing.title}`,
    description: description || `Monthly rent for ${listing.title} in ${listing.city}`,
    metadata: { listing_id, owner_user_id: user.email },
  });

  // Amount in cents
  const amountCents = Math.round(amount * 100);

  // Create Stripe Price
  const price = await stripe.prices.create({
    product: product.id,
    unit_amount: amountCents,
    currency,
    recurring: { interval },
    metadata: { listing_id },
  });

  const platformFeeAmount = Math.round(amountCents * (commission_percentage / 100));
  const amountToOwner = amountCents - platformFeeAmount;

  const plan = await base44.entities.PaymentPlan.create({
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

  // Enable payments on the listing
  await base44.entities.Listing.update(listing_id, { payments_enabled: true });

  return Response.json({ plan, commission_percentage, platform_fee: platformFeeAmount, amount_to_owner: amountToOwner });
});