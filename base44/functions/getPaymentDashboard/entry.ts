/**
 * Returns aggregated payment data for the calling user.
 * For owners: their subscriptions, transactions, and earnings.
 * For tenants: their subscriptions and payment history.
 * For admin: platform-wide totals.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { role = 'both' } = await req.json().catch(() => ({}));

  if (user.role === 'admin') {
    const [allSubs, allTx, allDisputes] = await Promise.all([
      base44.asServiceRole.entities.TenantSubscription.list('-created_date', 100),
      base44.asServiceRole.entities.PaymentTransaction.list('-created_date', 200),
      base44.asServiceRole.entities.PaymentDispute.list('-created_date', 50),
    ]);
    const totalRevenue = allTx.filter(t => t.status === 'succeeded').reduce((s, t) => s + (t.platform_fee || 0), 0);
    const totalVolume = allTx.filter(t => t.status === 'succeeded').reduce((s, t) => s + (t.amount || 0), 0);
    return Response.json({
      subscriptions: allSubs,
      transactions: allTx,
      disputes: allDisputes,
      summary: {
        total_revenue_cents: totalRevenue,
        total_volume_cents: totalVolume,
        active_subscriptions: allSubs.filter(s => s.status === 'active').length,
        open_disputes: allDisputes.filter(d => d.status === 'open').length,
      },
    });
  }

  // Owner data
  const [ownerSubs, ownerTx] = await Promise.all([
    base44.entities.TenantSubscription.filter({ owner_user_id: user.email }, '-created_date', 50),
    base44.entities.PaymentTransaction.filter({ owner_user_id: user.email }, '-created_date', 100),
  ]);

  // Tenant data
  const [tenantSubs, tenantTx] = await Promise.all([
    base44.entities.TenantSubscription.filter({ tenant_user_id: user.email }, '-created_date', 50),
    base44.entities.PaymentTransaction.filter({ tenant_user_id: user.email }, '-created_date', 100),
  ]);

  const ownerEarnings = ownerTx.filter(t => t.status === 'succeeded').reduce((s, t) => s + (t.amount_to_owner || 0), 0);
  const tenantSpend = tenantTx.filter(t => t.status === 'succeeded').reduce((s, t) => s + (t.amount || 0), 0);

  return Response.json({
    owner: { subscriptions: ownerSubs, transactions: ownerTx, total_earnings_cents: ownerEarnings },
    tenant: { subscriptions: tenantSubs, transactions: tenantTx, total_spent_cents: tenantSpend },
  });
});