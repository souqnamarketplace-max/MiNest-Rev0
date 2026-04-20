/**
 * Scheduled daily: checks for leases expiring soon or expired.
 * - Auto-renews leases (extends by same duration) unless tenant requested cancellation
 * - Sends email + push notifications at 30 days and 7 days before renewal
 * - On expiry with no renewal: cancels subscription, reactivates listing
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';
import Stripe from 'npm:stripe@14.21.0';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'));

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Allow scheduled (no user) or admin calls
    const user = await base44.auth.me().catch(() => null);
    if (user && user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const now = new Date();
    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    // Fetch all accepted agreements
    const agreements = await base44.asServiceRole.entities.RentalAgreement.filter({ status: 'accepted' });

    let autoRenewed = 0, notified30 = 0, notified7 = 0, expired = 0;

    for (const agreement of agreements) {
      if (!agreement.lease_end_date) continue;
      const endDate = new Date(agreement.lease_end_date);
      const endDateStr = endDate.toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' });

      // ── EXPIRED LEASE ────────────────────────────────────────────────────────
      if (endDate < now) {
        // If tenant has NOT requested cancellation → AUTO-RENEW
        if (agreement.renewal_status !== 'ending') {
          // Calculate same lease duration
          const startDate = new Date(agreement.lease_start_date);
          const durationMs = endDate.getTime() - startDate.getTime();
          const newStartDate = endDate.toISOString().split('T')[0];
          const newEndDate = new Date(endDate.getTime() + durationMs).toISOString().split('T')[0];

          await base44.asServiceRole.entities.RentalAgreement.update(agreement.id, {
            lease_start_date: newStartDate,
            lease_end_date: newEndDate,
            renewal_status: 'renewed',
          });

          // Notify both parties of auto-renewal
          const dedupKey = `lease_autorenewed_${agreement.id}_${newEndDate}`;
          await Promise.all([
            base44.asServiceRole.entities.Notification.create({
              user_id: agreement.tenant_user_id,
              type: 'system',
              title: '🔄 Lease auto-renewed',
              body: `Your lease for "${agreement.listing_title}" has been automatically renewed until ${new Date(newEndDate).toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' })}. To cancel, contact your owner.`,
              link: '/my-payments',
              read: false,
              dedup_key: dedupKey + '_tenant',
            }),
            base44.asServiceRole.entities.Notification.create({
              user_id: agreement.owner_user_id,
              type: 'system',
              title: '🔄 Tenant lease auto-renewed',
              body: `The lease for "${agreement.listing_title}" has been automatically renewed until ${new Date(newEndDate).toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' })}.`,
              link: '/owner-payment-setup',
              read: false,
              dedup_key: dedupKey + '_owner',
            }),
            // Send email to tenant
            base44.asServiceRole.integrations.Core.SendEmail({
              to: agreement.tenant_user_id,
              subject: `Your lease has been automatically renewed — ${agreement.listing_title}`,
              body: `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f4f6f9;font-family:'Helvetica Neue',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:40px 0;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
      <tr><td style="background:#0f172a;padding:28px 40px;text-align:center;">
        <span style="font-size:24px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">Mi<span style="color:#10b981;">Nest</span></span>
      </td></tr>
      <tr><td style="padding:40px;">
        <h2 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#0f172a;">Your Lease Has Been Renewed</h2>
        <p style="margin:0 0 24px;color:#64748b;font-size:15px;">Great news — your tenancy continues seamlessly.</p>
        <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:20px 24px;margin-bottom:28px;">
          <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#15803d;text-transform:uppercase;letter-spacing:0.5px;">Renewal Details</p>
          <p style="margin:0 0 4px;font-size:15px;color:#0f172a;font-weight:600;">${agreement.listing_title}</p>
          <p style="margin:0;font-size:14px;color:#475569;">New term: <strong>${newStartDate}</strong> → <strong>${newEndDate}</strong></p>
        </div>
        <p style="margin:0 0 16px;font-size:15px;color:#334155;line-height:1.6;">Your rent payments will continue without interruption. All terms of your original agreement remain in effect.</p>
        <p style="margin:0 0 28px;font-size:15px;color:#334155;line-height:1.6;">If you wish to end your tenancy, please contact your landlord before the next renewal date to request cancellation.</p>
        <table cellpadding="0" cellspacing="0"><tr><td style="border-radius:8px;background:#10b981;">
          <a href="https://minest.ca/my-payments" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">Manage My Payments</a>
        </td></tr></table>
      </td></tr>
      <tr><td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:24px 40px;text-align:center;">
        <p style="margin:0;font-size:13px;color:#94a3b8;">© ${new Date().getFullYear()} MiNest · <a href="https://minest.ca" style="color:#10b981;text-decoration:none;">minest.ca</a></p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`,
            }).catch(() => {}),
          ]);
          autoRenewed++;
          continue;
        }

        // Tenant requested cancellation (renewal_status === 'ending') — expire it
        await base44.asServiceRole.entities.RentalAgreement.update(agreement.id, {
          status: 'expired',
        });

        // Cancel Stripe subscription
        if (agreement.subscription_id) {
          const subs = await base44.asServiceRole.entities.TenantSubscription.filter({ id: agreement.subscription_id });
          const sub = subs[0];
          if (sub?.stripe_subscription_id && sub.status === 'active') {
            await stripe.subscriptions.cancel(sub.stripe_subscription_id).catch(() => {});
            await base44.asServiceRole.entities.TenantSubscription.update(agreement.subscription_id, {
              status: 'canceled',
              cancel_reason: 'Lease term ended — cancellation requested',
              cancel_requested_by: 'system',
            });
          }
        }

        // Reactivate listing so it shows as available again (from rented or paused)
        if (agreement.listing_id) {
          const listingRecs = await base44.asServiceRole.entities.Listing.filter({ id: agreement.listing_id });
          const listing = listingRecs[0];
          if (listing && ['rented', 'paused'].includes(listing.status)) {
            await base44.asServiceRole.entities.Listing.update(agreement.listing_id, { status: 'active' });
          }
        }

        const dedupKey = `lease_expired_${agreement.id}`;
        await Promise.all([
          base44.asServiceRole.entities.Notification.create({
            user_id: agreement.tenant_user_id,
            type: 'system',
            title: 'Your lease has ended',
            body: `Your lease for "${agreement.listing_title}" ended on ${endDateStr}. Your rent payments have been stopped.`,
            link: '/my-payments',
            read: false,
            dedup_key: dedupKey + '_tenant',
          }),
          base44.asServiceRole.entities.Notification.create({
            user_id: agreement.owner_user_id,
            type: 'system',
            title: 'Tenant lease ended',
            body: `The lease for "${agreement.listing_title}" has ended and your listing is now active again.`,
            link: '/dashboard',
            read: false,
            dedup_key: dedupKey + '_owner',
          }),
          base44.asServiceRole.integrations.Core.SendEmail({
            to: agreement.tenant_user_id,
            subject: `Your lease has ended — ${agreement.listing_title}`,
            body: `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f4f6f9;font-family:'Helvetica Neue',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:40px 0;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
      <tr><td style="background:#0f172a;padding:28px 40px;text-align:center;">
        <span style="font-size:24px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">Mi<span style="color:#10b981;">Nest</span></span>
      </td></tr>
      <tr><td style="padding:40px;">
        <h2 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#0f172a;">Your Lease Has Ended</h2>
        <p style="margin:0 0 24px;color:#64748b;font-size:15px;">Your tenancy period has officially concluded.</p>
        <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:20px 24px;margin-bottom:28px;">
          <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#dc2626;text-transform:uppercase;letter-spacing:0.5px;">Lease Ended</p>
          <p style="margin:0 0 4px;font-size:15px;color:#0f172a;font-weight:600;">${agreement.listing_title}</p>
          <p style="margin:0;font-size:14px;color:#475569;">End date: <strong>${endDateStr}</strong></p>
        </div>
        <p style="margin:0 0 16px;font-size:15px;color:#334155;line-height:1.6;">Your rent payments have been automatically stopped as of the lease end date.</p>
        <p style="margin:0 0 28px;font-size:15px;color:#334155;line-height:1.6;">Thank you for being part of the MiNest community. We hope your experience was a positive one and we're here whenever you're ready to find your next home.</p>
        <table cellpadding="0" cellspacing="0"><tr><td style="border-radius:8px;background:#10b981;">
          <a href="https://minest.ca/search" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">Find Your Next Room</a>
        </td></tr></table>
      </td></tr>
      <tr><td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:24px 40px;text-align:center;">
        <p style="margin:0;font-size:13px;color:#94a3b8;">© ${new Date().getFullYear()} MiNest · <a href="https://minest.ca" style="color:#10b981;text-decoration:none;">minest.ca</a></p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`,
          }).catch(() => {}),
        ]);
        expired++;
        continue;
      }

      // ── EXPIRING IN 7 DAYS — urgent renewal notice ───────────────────────────
      if (endDate <= in7Days && agreement.renewal_status === 'none') {
        const dedupKey = `lease_expiring_7_${agreement.id}`;
        await Promise.all([
          base44.asServiceRole.entities.Notification.create({
            user_id: agreement.tenant_user_id,
            type: 'system',
            title: '⚠️ Lease renews in 7 days',
            body: `Your lease for "${agreement.listing_title}" renews on ${endDateStr}. If you want to cancel, contact your owner now.`,
            link: '/my-payments',
            read: false,
            dedup_key: dedupKey + '_tenant',
          }),
          base44.asServiceRole.entities.Notification.create({
            user_id: agreement.owner_user_id,
            type: 'system',
            title: '⚠️ Tenant lease renews in 7 days',
            body: `The lease for "${agreement.listing_title}" will auto-renew on ${endDateStr}.`,
            link: '/owner-payment-setup',
            read: false,
            dedup_key: dedupKey + '_owner',
          }),
          base44.asServiceRole.integrations.Core.SendEmail({
            to: agreement.tenant_user_id,
            subject: `Action required: Your lease renews in 7 days — ${agreement.listing_title}`,
            body: `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f4f6f9;font-family:'Helvetica Neue',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:40px 0;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
      <tr><td style="background:#0f172a;padding:28px 40px;text-align:center;">
        <span style="font-size:24px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">Mi<span style="color:#10b981;">Nest</span></span>
      </td></tr>
      <tr><td style="padding:40px;">
        <div style="background:#fef9c3;border:1px solid #fde047;border-radius:8px;padding:10px 16px;display:inline-block;margin-bottom:24px;">
          <span style="font-size:13px;font-weight:700;color:#854d0e;">⚠️ URGENT — 7 DAYS REMAINING</span>
        </div>
        <h2 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#0f172a;">Your Lease Renews in 7 Days</h2>
        <p style="margin:0 0 24px;color:#64748b;font-size:15px;">Your lease will automatically renew unless you take action.</p>
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:20px 24px;margin-bottom:28px;">
          <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;">Lease Details</p>
          <p style="margin:0 0 4px;font-size:15px;color:#0f172a;font-weight:600;">${agreement.listing_title}</p>
          <p style="margin:0;font-size:14px;color:#475569;">Auto-renews on: <strong>${endDateStr}</strong></p>
        </div>
        <p style="margin:0 0 16px;font-size:15px;color:#334155;line-height:1.6;">If you are happy to continue your tenancy, <strong>no action is required</strong> — your lease will renew automatically and payments will continue uninterrupted.</p>
        <p style="margin:0 0 28px;font-size:15px;color:#334155;line-height:1.6;">If you wish to <strong>end your tenancy</strong>, please contact your landlord immediately to arrange a cancellation before the renewal date.</p>
        <table cellpadding="0" cellspacing="0"><tr><td style="border-radius:8px;background:#10b981;">
          <a href="https://minest.ca/my-payments" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">View My Lease</a>
        </td></tr></table>
      </td></tr>
      <tr><td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:24px 40px;text-align:center;">
        <p style="margin:0;font-size:13px;color:#94a3b8;">© ${new Date().getFullYear()} MiNest · <a href="https://minest.ca" style="color:#10b981;text-decoration:none;">minest.ca</a></p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`,
          }).catch(() => {}),
        ]);
        notified7++;
        continue;
      }

      // ── EXPIRING IN 30 DAYS — early notice ───────────────────────────────────
      if (endDate <= in30Days && agreement.renewal_status === 'none') {
        const dedupKey = `lease_expiring_30_${agreement.id}`;
        await Promise.all([
          base44.asServiceRole.entities.Notification.create({
            user_id: agreement.tenant_user_id,
            type: 'system',
            title: 'Lease renews in 30 days',
            body: `Your lease for "${agreement.listing_title}" will automatically renew on ${endDateStr}. No action needed unless you want to cancel.`,
            link: '/my-payments',
            read: false,
            dedup_key: dedupKey + '_tenant',
          }),
          base44.asServiceRole.entities.Notification.create({
            user_id: agreement.owner_user_id,
            type: 'system',
            title: 'Tenant lease renews in 30 days',
            body: `The lease for "${agreement.listing_title}" will auto-renew on ${endDateStr}.`,
            link: '/owner-payment-setup',
            read: false,
            dedup_key: dedupKey + '_owner',
          }),
          base44.asServiceRole.integrations.Core.SendEmail({
            to: agreement.tenant_user_id,
            subject: `Heads up: Your lease renews in 30 days — ${agreement.listing_title}`,
            body: `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f4f6f9;font-family:'Helvetica Neue',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:40px 0;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
      <tr><td style="background:#0f172a;padding:28px 40px;text-align:center;">
        <span style="font-size:24px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">Mi<span style="color:#10b981;">Nest</span></span>
      </td></tr>
      <tr><td style="padding:40px;">
        <h2 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#0f172a;">Your Lease Renews in 30 Days</h2>
        <p style="margin:0 0 24px;color:#64748b;font-size:15px;">Just a friendly reminder about your upcoming lease renewal.</p>
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:20px 24px;margin-bottom:28px;">
          <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;">Lease Details</p>
          <p style="margin:0 0 4px;font-size:15px;color:#0f172a;font-weight:600;">${agreement.listing_title}</p>
          <p style="margin:0;font-size:14px;color:#475569;">Auto-renews on: <strong>${endDateStr}</strong></p>
        </div>
        <p style="margin:0 0 16px;font-size:15px;color:#334155;line-height:1.6;">Your lease will <strong>automatically renew</strong> for another term on the above date. No action is needed if you plan to stay — your payments will continue as normal.</p>
        <p style="margin:0 0 28px;font-size:15px;color:#334155;line-height:1.6;">If you'd like to end your tenancy, please reach out to your landlord at least 7 days before the renewal date to arrange a smooth transition.</p>
        <table cellpadding="0" cellspacing="0"><tr><td style="border-radius:8px;background:#10b981;">
          <a href="https://minest.ca/my-payments" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">View My Lease</a>
        </td></tr></table>
      </td></tr>
      <tr><td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:24px 40px;text-align:center;">
        <p style="margin:0;font-size:13px;color:#94a3b8;">© ${new Date().getFullYear()} MiNest · <a href="https://minest.ca" style="color:#10b981;text-decoration:none;">minest.ca</a></p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`,
          }).catch(() => {}),
        ]);
        notified30++;
      }
    }

    // Also expire pending offers older than 7 days
    const pendingAgreements = await base44.asServiceRole.entities.RentalAgreement.filter({ status: 'pending_tenant' });
    let offersExpired = 0;
    for (const a of pendingAgreements) {
      if (a.offer_expires_at && new Date(a.offer_expires_at) < now) {
        await base44.asServiceRole.entities.RentalAgreement.update(a.id, { status: 'expired' });
        offersExpired++;
      }
    }

    return Response.json({
      success: true,
      auto_renewed: autoRenewed,
      leases_expired: expired,
      notified_30_days: notified30,
      notified_7_days: notified7,
      offers_expired: offersExpired,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});