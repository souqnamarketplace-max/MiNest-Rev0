/**
 * Admin-only endpoint to manage rental agreements on behalf of owners/tenants.
 * Actions: send_offer, force_accept, force_decline, cancel, set_non_renewal,
 *          clear_non_renewal, reopen
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';
import Stripe from 'npm:stripe@14.21.0';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'));

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin only' }, { status: 403 });
    }

    const body = await req.json();
    const { action, agreement_id } = body;

    // ── SEND OFFER ON BEHALF OF OWNER ─────────────────────────────────────────
    if (action === 'send_offer') {
      const {
        listing_id, tenant_user_id, owner_user_id,
        lease_start_date, lease_end_date,
        deposit_amount, house_rules, guest_policy,
        quiet_hours_start, quiet_hours_end, special_terms,
      } = body;

      if (!listing_id || !tenant_user_id || !lease_start_date || !lease_end_date) {
        return Response.json({ error: 'Missing required fields' }, { status: 400 });
      }

      const listings = await base44.asServiceRole.entities.Listing.filter({ id: listing_id });
      const listing = listings[0];
      if (!listing) return Response.json({ error: 'Listing not found' }, { status: 404 });

      const plans = await base44.asServiceRole.entities.PaymentPlan.filter({ listing_id, status: 'active' });
      const plan = plans[0];
      if (!plan) return Response.json({ error: 'No active payment plan for this listing' }, { status: 400 });

      // Expire old pending offers
      const existing = await base44.asServiceRole.entities.RentalAgreement.filter({ listing_id, tenant_user_id, status: 'pending_tenant' });
      for (const old of existing) {
        await base44.asServiceRole.entities.RentalAgreement.update(old.id, { status: 'expired' });
      }

      const offerExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const effectiveOwner = owner_user_id || listing.owner_user_id;

      const agreement = await base44.asServiceRole.entities.RentalAgreement.create({
        listing_id,
        listing_title: listing.title,
        owner_user_id: effectiveOwner,
        tenant_user_id,
        payment_plan_id: plan.id,
        rent_amount: plan.amount,
        currency: plan.currency,
        interval: plan.interval,
        lease_start_date,
        lease_end_date,
        deposit_amount: deposit_amount || 0,
        property_address: [listing.street_address, listing.city, listing.province_or_state, listing.postal_or_zip].filter(Boolean).join(', '),
        house_rules: house_rules || '',
        guest_policy: guest_policy || '',
        quiet_hours_start: quiet_hours_start || '22:00',
        quiet_hours_end: quiet_hours_end || '08:00',
        special_terms: special_terms || '',
        status: 'pending_tenant',
        owner_signature: `Admin (on behalf of owner)`,
        offer_expires_at: offerExpiresAt,
      });

      await base44.asServiceRole.entities.Notification.create({
        user_id: tenant_user_id,
        type: 'system',
        title: 'You received a rental offer!',
        body: `A rental agreement for "${listing.title}" has been sent to you. Review and sign to proceed.`,
        link: `/my-payments?agreement=${agreement.id}`,
        read: false,
      });

      return Response.json({ agreement });
    }

    // All other actions require agreement_id
    if (!agreement_id) return Response.json({ error: 'Missing agreement_id' }, { status: 400 });

    const agreements = await base44.asServiceRole.entities.RentalAgreement.filter({ id: agreement_id });
    const agreement = agreements[0];
    if (!agreement) return Response.json({ error: 'Agreement not found' }, { status: 404 });

    // ── FORCE ACCEPT ──────────────────────────────────────────────────────────
    if (action === 'force_accept') {
      const signature = body.signature || 'Admin Override';
      await base44.asServiceRole.entities.RentalAgreement.update(agreement_id, {
        status: 'accepted',
        tenant_signature: signature,
        tenant_signed_at: new Date().toISOString(),
      });
      await base44.asServiceRole.entities.Notification.create({
        user_id: agreement.owner_user_id,
        type: 'system',
        title: 'Rental agreement accepted (admin)',
        body: `Admin has force-accepted the rental agreement for "${agreement.listing_title}".`,
        link: '/my-payments',
        read: false,
      });
      return Response.json({ status: 'accepted' });
    }

    // ── FORCE DECLINE ─────────────────────────────────────────────────────────
    if (action === 'force_decline') {
      await base44.asServiceRole.entities.RentalAgreement.update(agreement_id, { status: 'declined' });
      return Response.json({ status: 'declined' });
    }

    // ── CANCEL ACTIVE AGREEMENT ───────────────────────────────────────────────
    if (action === 'cancel') {
      await base44.asServiceRole.entities.RentalAgreement.update(agreement_id, { status: 'canceled' });

      // Cancel Stripe subscription if linked
      if (agreement.subscription_id) {
        const subs = await base44.asServiceRole.entities.TenantSubscription.filter({ id: agreement.subscription_id });
        const sub = subs[0];
        if (sub?.stripe_subscription_id && ['active', 'trialing'].includes(sub.status)) {
          await stripe.subscriptions.cancel(sub.stripe_subscription_id).catch(() => {});
          await base44.asServiceRole.entities.TenantSubscription.update(agreement.subscription_id, {
            status: 'canceled',
            cancel_reason: 'Canceled by admin',
            cancel_requested_by: 'admin',
          });
        }
      }

      await Promise.all([
        base44.asServiceRole.entities.Notification.create({
          user_id: agreement.tenant_user_id,
          type: 'system',
          title: 'Rental agreement canceled',
          body: `Your rental agreement for "${agreement.listing_title}" has been canceled by admin.`,
          link: '/my-payments',
          read: false,
        }),
        base44.asServiceRole.entities.Notification.create({
          user_id: agreement.owner_user_id,
          type: 'system',
          title: 'Rental agreement canceled by admin',
          body: `The rental agreement for "${agreement.listing_title}" has been canceled by an administrator.`,
          link: '/owner-payment-setup',
          read: false,
        }),
      ]);

      return Response.json({ status: 'canceled' });
    }

    // ── SET NON-RENEWAL ───────────────────────────────────────────────────────
    if (action === 'set_non_renewal') {
      await base44.asServiceRole.entities.RentalAgreement.update(agreement_id, { renewal_status: 'ending' });
      return Response.json({ status: 'non_renewal_set' });
    }

    // ── CLEAR NON-RENEWAL ─────────────────────────────────────────────────────
    if (action === 'clear_non_renewal') {
      await base44.asServiceRole.entities.RentalAgreement.update(agreement_id, { renewal_status: 'none' });
      return Response.json({ status: 'non_renewal_cleared' });
    }

    // ── REOPEN AS PENDING ─────────────────────────────────────────────────────
    if (action === 'reopen') {
      const offerExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      await base44.asServiceRole.entities.RentalAgreement.update(agreement_id, {
        status: 'pending_tenant',
        offer_expires_at: offerExpiresAt,
        tenant_signature: null,
        tenant_signed_at: null,
      });
      await base44.asServiceRole.entities.Notification.create({
        user_id: agreement.tenant_user_id,
        type: 'system',
        title: 'Rental offer reopened',
        body: `A rental agreement for "${agreement.listing_title}" has been reopened for your review.`,
        link: `/my-payments?agreement=${agreement.id}`,
        read: false,
      });
      return Response.json({ status: 'reopened' });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});