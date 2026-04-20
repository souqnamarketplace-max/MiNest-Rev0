/**
 * Handles Stripe webhooks for the rent payment system.
 * Syncs subscription and transaction status back to the database.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';
import Stripe from 'npm:stripe@14.21.0';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'));
const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');

Deno.serve(async (req) => {
  const sig = req.headers.get('stripe-signature');
  const body = await req.text();

  let event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, sig, webhookSecret);
  } catch (err) {
    return Response.json({ error: `Webhook signature failed: ${err.message}` }, { status: 400 });
  }

  const base44 = createClientFromRequest(req);

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    if (session.mode === 'subscription') {
      const { payment_plan_id, tenant_user_id, listing_id } = session.metadata || {};
      if (!payment_plan_id || !tenant_user_id) return Response.json({ received: true });

      // Find and update the pending subscription
      const subs = await base44.asServiceRole.entities.TenantSubscription.filter({
        tenant_user_id,
        listing_id,
        status: 'incomplete',
      });
      const sub = subs[subs.length - 1]; // most recent
      if (sub) {
        const stripeSubscription = await stripe.subscriptions.retrieve(session.subscription);
        await base44.asServiceRole.entities.TenantSubscription.update(sub.id, {
          stripe_subscription_id: session.subscription,
          stripe_customer_id: session.customer,
          status: stripeSubscription.status,
          next_payment_date: stripeSubscription.current_period_end
            ? new Date(stripeSubscription.current_period_end * 1000).toISOString()
            : null,
        });
      }
    }
  }

  if (event.type === 'invoice.payment_succeeded') {
    const invoice = event.data.object;
    const stripeSubId = invoice.subscription;
    if (!stripeSubId) return Response.json({ received: true });

    // Find matching subscription
    const subs = await base44.asServiceRole.entities.TenantSubscription.filter({
      stripe_subscription_id: stripeSubId,
    });
    const sub = subs[0];
    if (!sub) return Response.json({ received: true });

    const amountPaid = invoice.amount_paid; // in cents
    const planRecs = await base44.asServiceRole.entities.PaymentPlan.filter({ id: sub.payment_plan_id });
    const plan = planRecs[0];
    const commissionPct = plan?.commission_percentage ?? 1.0;
    const platformFee = Math.round(amountPaid * (commissionPct / 100));
    const amountToOwner = amountPaid - platformFee;

    // Record transaction
    const tx = await base44.asServiceRole.entities.PaymentTransaction.create({
      tenant_user_id: sub.tenant_user_id,
      owner_user_id: sub.owner_user_id,
      listing_id: sub.listing_id,
      listing_title: sub.listing_title || '',
      subscription_id: sub.id,
      stripe_invoice_id: invoice.id,
      stripe_charge_id: invoice.charge,
      stripe_payment_intent_id: invoice.payment_intent,
      amount: amountPaid,
      platform_fee: platformFee,
      amount_to_owner: amountToOwner,
      currency: invoice.currency,
      status: 'succeeded',
      period_start: invoice.period_start ? new Date(invoice.period_start * 1000).toISOString() : null,
      period_end: invoice.period_end ? new Date(invoice.period_end * 1000).toISOString() : null,
      receipt_url: invoice.hosted_invoice_url || '',
    });

    // Generate and email receipt
    await base44.asServiceRole.functions.invoke('generatePaymentReceipt', {
      transaction_id: tx.id,
    }).catch(err => console.warn('Receipt generation failed:', err.message));

    // Notify tenant: payment confirmed
    const paidDisplay = `$${(amountPaid / 100).toFixed(2)} ${(invoice.currency || 'cad').toUpperCase()}`;
    await base44.asServiceRole.entities.Notification.create({
      user_id: sub.tenant_user_id,
      type: 'system',
      role_target: 'seeker',
      title: '✅ Rent Payment Confirmed',
      body: `Your rent payment of ${paidDisplay} for "${sub.listing_title || 'your rental'}" was successfully processed.`,
      link: '/my-payments',
      read: false,
      metadata: { transaction_id: tx.id, listing_id: sub.listing_id },
    });

    // Notify owner: rent received
    await base44.asServiceRole.entities.Notification.create({
      user_id: sub.owner_user_id,
      type: 'system',
      role_target: 'lister',
      title: '💰 Rent Payment Received',
      body: `A rent payment of ${paidDisplay} for "${sub.listing_title || 'your listing'}" has been successfully collected from your tenant.`,
      link: '/dashboard?tab=payments',
      read: false,
      metadata: { transaction_id: tx.id, listing_id: sub.listing_id },
    });

    // Update subscription totals + next payment date
    const stripeSubscription = await stripe.subscriptions.retrieve(stripeSubId);
    await base44.asServiceRole.entities.TenantSubscription.update(sub.id, {
      status: 'active',
      total_paid: (sub.total_paid || 0) + amountPaid,
      total_fee_collected: (sub.total_fee_collected || 0) + platformFee,
      next_payment_date: new Date(stripeSubscription.current_period_end * 1000).toISOString(),
    });

    // On first payment: mark listing as rented so it's hidden from search
    if (sub.listing_id && (sub.total_paid || 0) === 0) {
      await base44.asServiceRole.entities.Listing.update(sub.listing_id, { status: 'rented' });
    }
  }

  if (event.type === 'invoice.payment_failed') {
    const invoice = event.data.object;
    const stripeSubId = invoice.subscription;
    if (!stripeSubId) return Response.json({ received: true });

    const subs = await base44.asServiceRole.entities.TenantSubscription.filter({
      stripe_subscription_id: stripeSubId,
    });
    const sub = subs[0];
    if (sub) {
      await base44.asServiceRole.entities.TenantSubscription.update(sub.id, { status: 'past_due' });
      await base44.asServiceRole.entities.PaymentTransaction.create({
        tenant_user_id: sub.tenant_user_id,
        owner_user_id: sub.owner_user_id,
        listing_id: sub.listing_id,
        subscription_id: sub.id,
        stripe_invoice_id: invoice.id,
        amount: invoice.amount_due,
        platform_fee: 0,
        amount_to_owner: 0,
        currency: invoice.currency,
        status: 'failed',
        failure_reason: invoice.last_payment_error?.message || 'Payment failed',
      });

      const failureReason = invoice.last_payment_error?.message || 'Payment failed';
      const amountDisplay = `$${(invoice.amount_due / 100).toFixed(2)} ${(invoice.currency || 'cad').toUpperCase()}`;

      // Notify tenant: their payment failed
      await base44.asServiceRole.entities.Notification.create({
        user_id: sub.tenant_user_id,
        type: 'system',
        role_target: 'seeker',
        title: '⚠️ Rent Payment Failed',
        body: `Your rent payment of ${amountDisplay} for "${sub.listing_title}" could not be processed. Reason: ${failureReason}. Please update your payment method to avoid losing your tenancy.`,
        link: '/my-payments',
        read: false,
        metadata: { subscription_id: sub.id, listing_id: sub.listing_id },
      });

      // Notify owner: tenant payment failed
      await base44.asServiceRole.entities.Notification.create({
        user_id: sub.owner_user_id,
        type: 'system',
        role_target: 'lister',
        title: '⚠️ Tenant Payment Failed',
        body: `The rent payment of ${amountDisplay} from your tenant for "${sub.listing_title}" has failed. The subscription is now past due.`,
        link: '/dashboard?tab=payments',
        read: false,
        metadata: { subscription_id: sub.id, listing_id: sub.listing_id },
      });
    }
  }

  if (event.type === 'customer.subscription.deleted') {
    const stripeSub = event.data.object;
    const subs = await base44.asServiceRole.entities.TenantSubscription.filter({
      stripe_subscription_id: stripeSub.id,
    });
    const sub = subs[0];
    if (sub && sub.status !== 'canceled') {
      await base44.asServiceRole.entities.TenantSubscription.update(sub.id, {
        status: 'canceled',
        end_date: new Date().toISOString(),
        cancel_requested_by: 'system',
      });

      // Notify tenant
      await base44.asServiceRole.entities.Notification.create({
        user_id: sub.tenant_user_id,
        type: 'system',
        role_target: 'seeker',
        title: 'Rent Subscription Cancelled',
        body: `Your rent subscription for "${sub.listing_title}" has been cancelled.`,
        link: '/my-payments',
        read: false,
        metadata: { subscription_id: sub.id, listing_id: sub.listing_id },
      });

      // Notify owner
      await base44.asServiceRole.entities.Notification.create({
        user_id: sub.owner_user_id,
        type: 'system',
        role_target: 'lister',
        title: 'Tenant Subscription Cancelled',
        body: `The rent subscription for "${sub.listing_title}" has been cancelled.`,
        link: '/dashboard?tab=payments',
        read: false,
        metadata: { subscription_id: sub.id, listing_id: sub.listing_id },
      });
    }
  }

  return Response.json({ received: true });
});