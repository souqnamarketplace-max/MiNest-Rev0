/**
 * Returns a Stripe Customer Portal URL for the tenant to update their payment method,
 * billing address, or manage their subscription details.
 *
 * Payload: { subscription_id }
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';
import Stripe from 'npm:stripe@14.21.0';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'));

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { subscription_id, return_url } = await req.json();
    if (!subscription_id) return Response.json({ error: 'Missing subscription_id' }, { status: 400 });

    // Fetch the subscription
    const subs = await base44.entities.TenantSubscription.filter({ id: subscription_id });
    const sub = subs[0];
    if (!sub) return Response.json({ error: 'Subscription not found' }, { status: 404 });

    // Only the tenant can update their own payment method
    if (sub.tenant_user_id !== user.email) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (!sub.stripe_customer_id) {
      return Response.json({ error: 'No Stripe customer found for this subscription' }, { status: 400 });
    }

    // Create a Stripe Customer Portal session
    const session = await stripe.billingPortal.sessions.create({
      customer: sub.stripe_customer_id,
      return_url: return_url || 'https://minest.ca/dashboard?tab=payments',
    });

    return Response.json({ url: session.url });
  } catch (error) {
    console.error('getPaymentUpdateUrl error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});