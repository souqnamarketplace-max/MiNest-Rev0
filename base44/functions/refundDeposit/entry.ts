/**
 * Owner initiates a deposit refund to tenant.
 * Supports two modes:
 *   - stripe: refund via Stripe to original payment method
 *   - manual: record a manual bank transfer (e-transfer, bank wire, etc.)
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';
import Stripe from 'npm:stripe@14.21.0';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'));

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const {
    subscription_id,
    refund_amount,
    refund_reason,
    refund_method, // 'stripe' | 'manual'
    bank_details,  // { bank_name, account_name, account_number, transit_number, institution_number, notes }
  } = await req.json();

  if (!subscription_id || !refund_amount || !refund_method) {
    return Response.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const subs = await base44.asServiceRole.entities.TenantSubscription.filter({ id: subscription_id });
  const sub = subs[0];
  if (!sub) return Response.json({ error: 'Subscription not found' }, { status: 404 });
  if (sub.owner_user_id !== user.email) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const refundCents = Math.round(refund_amount * 100);
  let stripeRefundId = null;

  if (refund_method === 'stripe') {
    // Refund via Stripe to original payment method
    if (!sub.stripe_subscription_id) {
      return Response.json({ error: 'No Stripe subscription linked. Use manual refund instead.' }, { status: 400 });
    }

    const invoices = await stripe.invoices.list({
      subscription: sub.stripe_subscription_id,
      limit: 100,
    });

    let chargeId = null;
    for (const invoice of (invoices.data || [])) {
      if (invoice.charge) { chargeId = invoice.charge; break; }
    }

    if (!chargeId) {
      return Response.json({ error: 'No paid Stripe charges found. Use manual refund instead.' }, { status: 400 });
    }

    const stripeRefund = await stripe.refunds.create({
      charge: chargeId,
      amount: refundCents,
      reason: 'requested_by_customer',
    }).catch(err => ({ error: err.message }));

    if (stripeRefund.error) {
      return Response.json({ error: `Stripe refund failed: ${stripeRefund.error}` }, { status: 400 });
    }

    stripeRefundId = stripeRefund.id;
  }

  // Record the refund
  const refundRecord = await base44.asServiceRole.entities.DepositRefund.create({
    subscription_id,
    owner_user_id: user.email,
    tenant_user_id: sub.tenant_user_id,
    listing_id: sub.listing_id,
    refund_amount: refundCents,
    currency: 'cad',
    stripe_refund_id: stripeRefundId || '',
    refund_reason: refund_reason || '',
    refund_method,
    bank_details: bank_details || null,
    status: 'completed',
  }).catch(err => {
    console.warn('Could not create DepositRefund record:', err.message);
    return null;
  });

  // Notify tenant
  const methodLabel = refund_method === 'stripe'
    ? 'to your original payment method (3–5 business days)'
    : `via manual transfer${bank_details?.bank_name ? ` to ${bank_details.bank_name}` : ''}`;

  await base44.asServiceRole.entities.Notification.create({
    user_id: sub.tenant_user_id,
    type: 'system',
    title: 'Deposit refund processed',
    body: `Your landlord has refunded your security deposit ${methodLabel}.${refund_reason ? ` Reason: ${refund_reason}` : ''}`,
    link: '/my-payments',
    read: false,
  }).catch(() => {});

  return Response.json({
    refund: refundRecord || { status: 'completed', refund_method },
    stripe_refund_id: stripeRefundId,
  });
});