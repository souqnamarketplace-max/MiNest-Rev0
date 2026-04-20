/**
 * Cancels a tenant's rent subscription. Either the tenant or the owner can cancel.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';
import Stripe from 'npm:stripe@14.21.0';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'));

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { subscription_id, cancel_reason } = await req.json();
  if (!subscription_id) return Response.json({ error: 'Missing subscription_id' }, { status: 400 });

  const subs = await base44.entities.TenantSubscription.filter({ id: subscription_id });
  const sub = subs[0];
  if (!sub) return Response.json({ error: 'Subscription not found' }, { status: 404 });

  // Only tenant, owner, or admin can cancel
  const isAdmin = user.role === 'admin';
  const isTenant = sub.tenant_user_id === user.email;
  const isOwner = sub.owner_user_id === user.email;
  if (!isTenant && !isOwner && !isAdmin) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Cancel on Stripe if we have the subscription ID
  if (sub.stripe_subscription_id) {
    await stripe.subscriptions.cancel(sub.stripe_subscription_id).catch(err => {
      console.error('Stripe cancel error:', err.message);
    });
  }

  const cancelledBy = isAdmin ? 'admin' : isTenant ? 'tenant' : 'owner';

  await base44.entities.TenantSubscription.update(sub.id, {
    status: 'canceled',
    cancel_reason: cancel_reason || '',
    cancel_requested_by: cancelledBy,
    end_date: new Date().toISOString(),
  });

  return Response.json({ success: true, cancelled_by: cancelledBy });
});