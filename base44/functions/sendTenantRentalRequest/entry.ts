/**
 * Tenant submits a rental application.
 * Stores all legally required tenant information for the rental agreement.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const {
    listing_id, listing_title, owner_user_id,
    move_in_date, lease_length_months,
    tenant_legal_name, tenant_email, tenant_phone,
    tenant_date_of_birth, tenant_employer,
    tenant_current_address,
    tenant_emergency_contact_name, tenant_emergency_contact_phone,
    tenant_id_documents,
    existing_request_id,
  } = await req.json();

  if (!listing_id || !owner_user_id) {
    return Response.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const tenantProfiles = await base44.asServiceRole.entities.UserProfile.filter({ user_id: user.email });
  const tenantProfile = tenantProfiles[0];
  const tenantName = tenantProfile?.display_name || tenantProfile?.first_name || user.full_name || user.email;

  const leaseEndDate = new Date(move_in_date);
  leaseEndDate.setMonth(leaseEndDate.getMonth() + parseInt(lease_length_months || 12));

  const tenantData = {
    lease_start_date: move_in_date,
    lease_end_date: leaseEndDate.toISOString().split('T')[0],
    tenant_legal_name: tenant_legal_name || '',
    tenant_email: tenant_email || user.email,
    tenant_phone: tenant_phone || '',
    tenant_date_of_birth: tenant_date_of_birth || '',
    tenant_employer: tenant_employer || '',
    tenant_current_address: tenant_current_address || '',
    tenant_emergency_contact_name: tenant_emergency_contact_name || '',
    tenant_emergency_contact_phone: tenant_emergency_contact_phone || '',
    tenant_id_documents: tenant_id_documents || [],
  };

  if (existing_request_id) {
    await base44.asServiceRole.entities.RentalAgreement.update(existing_request_id, tenantData);
  } else {
    await base44.asServiceRole.entities.RentalAgreement.create({
      listing_id,
      listing_title,
      owner_user_id,
      tenant_user_id: user.email,
      rent_amount: 0,
      currency: 'cad',
      status: 'pending_tenant',
      ...tenantData,
    });
  }

  const notificationBody = `${tenantName} submitted a rental application for "${listing_title}"${move_in_date ? ` — move-in ${new Date(move_in_date).toLocaleDateString()}` : ''}. Open your dashboard to review and send a rental agreement.`;

  await base44.asServiceRole.entities.Notification.create({
    user_id: owner_user_id,
    type: 'matching_seeker_available',
    role_target: 'lister',
    title: `Rental Application from ${tenantName}`,
    body: notificationBody,
    link: `/dashboard?tab=rental_requests`,
    metadata: { listing_id, tenant_user_id: user.email, move_in_date, lease_length_months },
  });

  return Response.json({ success: true });
});