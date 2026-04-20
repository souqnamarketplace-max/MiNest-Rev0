/**
 * Tenant accepts a rental agreement by providing their typed signature.
 * After acceptance, they can proceed to pay via Stripe.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  let user;
  try { user = await base44.auth.me(); } catch {}
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { agreement_id, signature, action } = await req.json();
  if (!agreement_id) return Response.json({ error: 'Missing agreement_id' }, { status: 400 });

  // Fetch agreement
  let agreement;
  try {
    agreement = await base44.asServiceRole.entities.RentalAgreement.get(agreement_id);
  } catch (_) {}
  if (!agreement) return Response.json({ error: 'Agreement not found' }, { status: 404 });

  // Only the tenant can accept/decline/request_cancel
  if (agreement.tenant_user_id !== user.email) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Handle cancellation request on an active (accepted) agreement
  if (action === 'request_cancel') {
    if (agreement.status !== 'accepted') {
      return Response.json({ error: 'Can only request cancellation on an active agreement' }, { status: 409 });
    }
    await base44.asServiceRole.entities.RentalAgreement.update(agreement_id, { renewal_status: 'ending' });
    // Notify owner
    const tenantProfiles2 = await base44.asServiceRole.entities.UserProfile.filter({ user_id: user.email });
    const tenantName2 = tenantProfiles2[0]?.display_name || tenantProfiles2[0]?.first_name || user.full_name || user.email;
    await base44.asServiceRole.entities.Notification.create({
      user_id: agreement.owner_user_id,
      type: 'system',
      title: 'Tenant requested lease cancellation',
      body: `${tenantName2} has requested not to renew the lease for "${agreement.listing_title}". It will end on ${agreement.lease_end_date}.`,
      link: '/owner-payment-setup',
      read: false,
    });
    return Response.json({ status: 'cancel_requested' });
  }

  if (agreement.status !== 'pending_tenant') {
    return Response.json({ error: 'Agreement is no longer pending' }, { status: 409 });
  }

  // Check expiry
  if (agreement.offer_expires_at && new Date(agreement.offer_expires_at) < new Date()) {
    await base44.asServiceRole.entities.RentalAgreement.update(agreement_id, { status: 'expired' });
    return Response.json({ error: 'This offer has expired. Please ask the owner to send a new offer.' }, { status: 410 });
  }

  if (action === 'decline') {
    await base44.asServiceRole.entities.RentalAgreement.update(agreement_id, { status: 'declined' });
    // Notify owner
    await base44.asServiceRole.entities.Notification.create({
      user_id: agreement.owner_user_id,
      type: 'system',
      title: 'Rental offer declined',
      body: `The tenant has declined the rental agreement for "${agreement.listing_title}".`,
      link: `/owner-payment-setup`,
      read: false,
    });
    return Response.json({ status: 'declined' });
  }

  // Accept
  if (!signature || signature.trim().length < 2) {
    return Response.json({ error: 'A valid typed signature is required to accept the agreement' }, { status: 400 });
  }

  await base44.asServiceRole.entities.RentalAgreement.update(agreement_id, {
    status: 'accepted',
    tenant_signature: signature.trim(),
    tenant_signed_at: new Date().toISOString(),
  });

  // Notify owner
  const tenantProfiles = await base44.asServiceRole.entities.UserProfile.filter({ user_id: user.email });
  const tenantName = tenantProfiles[0]?.display_name || tenantProfiles[0]?.first_name || user.full_name || user.email;

  await base44.asServiceRole.entities.Notification.create({
    user_id: agreement.owner_user_id,
    type: 'system',
    title: 'Rental agreement signed!',
    body: `${tenantName} has signed and accepted the rental agreement for "${agreement.listing_title}". They can now set up rent payments.`,
    link: `/my-payments`,
    read: false,
  });

  return Response.json({ status: 'accepted', agreement_id });
});