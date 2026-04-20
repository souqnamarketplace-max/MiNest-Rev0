/**
 * Owner sends a formal rental agreement to a tenant.
 * Stores all legally required fields per Canadian/US residential tenancy standards.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    let user;
    try { user = await base44.auth.me(); } catch (_) {}
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    let body = {};
    try { body = await req.json(); } catch (_) {}

    const {
      listing_id, tenant_user_id,
      owner_legal_name, owner_email, owner_phone, owner_mailing_address, owner_corporation_name,
      unit_number, property_type, governing_province_or_state, country,
      parking_included, parking_space, storage_included, utilities_included, appliances_included,
      lease_start_date, lease_end_date, lease_type,
      deposit_amount, deposit_held_by, last_month_rent_collected,
      rent_due_day, payment_method, late_fee_amount, late_fee_grace_days,
      smoking_permitted, pets_permitted, pet_details, subletting_permitted,
      house_rules, guest_policy, quiet_hours_start, quiet_hours_end, special_terms,
    } = body;

    if (!listing_id || !tenant_user_id || !lease_start_date || !lease_end_date) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Verify ownership
    const listings = await base44.entities.Listing.filter({ id: listing_id });
    const listing = listings[0];
    if (!listing || listing.owner_user_id !== user.email) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get active payment plan (optional)
    const plans = await base44.asServiceRole.entities.PaymentPlan.filter({ listing_id, status: 'active' });
    const plan = plans[0] || null;

    // Expire any existing pending offers
    const existing = await base44.asServiceRole.entities.RentalAgreement.filter({
      listing_id, tenant_user_id, status: 'pending_tenant',
    });
    for (const old of existing) {
      await base44.asServiceRole.entities.RentalAgreement.update(old.id, { status: 'expired' });
    }

    const offerExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    // Build deposit/late fee clause
    const depositCents = deposit_amount || 0;
    const depositCurrency = (plan?.currency || listing.currency_code || 'CAD').toUpperCase();
    let depositClause = '';
    if (depositCents > 0) {
      depositClause = `\n\nSECURITY DEPOSIT:\nA security deposit of ${depositCurrency} $${(depositCents / 100).toFixed(2)} is due with the first payment. The deposit will be refunded within 30 days of lease end, subject to property condition and outstanding charges.`;
    }
    if (late_fee_amount > 0) {
      depositClause += `\n\nLATE PAYMENT FEE:\nA late fee of ${depositCurrency} $${(late_fee_amount / 100).toFixed(2)} will be charged if rent is not received within ${late_fee_grace_days || 5} days of the due date.`;
    }
    const finalSpecialTerms = (special_terms || '') + depositClause;

    const rentAmount = plan ? plan.amount : Math.round((listing.rent_amount || 0) * 100);
    const currency = plan ? plan.currency : (listing.currency_code || 'cad').toLowerCase();
    const interval = plan ? plan.interval : (listing.rent_period === 'weekly' ? 'week' : 'month');

    const propertyAddress = [listing.street_address, unit_number ? `Unit ${unit_number}` : null, listing.city, listing.province_or_state, listing.postal_or_zip, country === 'US' ? 'USA' : 'Canada'].filter(Boolean).join(', ');

    const agreement = await base44.entities.RentalAgreement.create({
      listing_id,
      listing_title: listing.title,
      owner_user_id: user.email,
      owner_legal_name: owner_legal_name || user.full_name,
      owner_email: owner_email || user.email,
      owner_phone: owner_phone || '',
      owner_mailing_address: owner_mailing_address || '',
      owner_corporation_name: owner_corporation_name || '',
      tenant_user_id,
      payment_plan_id: plan?.id || null,
      rent_amount: rentAmount,
      currency,
      interval,
      rent_due_day: rent_due_day || 1,
      payment_method: payment_method || 'in_app',
      late_fee_amount: late_fee_amount || 0,
      late_fee_grace_days: late_fee_grace_days || 5,
      lease_start_date,
      lease_end_date,
      lease_type: lease_type || 'fixed_term',
      deposit_amount: depositCents,
      deposit_held_by: deposit_held_by || owner_legal_name || user.full_name,
      last_month_rent_collected: last_month_rent_collected || false,
      property_address: propertyAddress,
      unit_number: unit_number || '',
      property_type: property_type || listing.listing_type,
      parking_included: parking_included || false,
      parking_space: parking_space || '',
      storage_included: storage_included || false,
      utilities_included: utilities_included || [],
      appliances_included: appliances_included || [],
      governing_province_or_state: governing_province_or_state || listing.province_or_state || '',
      country: country || 'CA',
      smoking_permitted: smoking_permitted || false,
      pets_permitted: pets_permitted || false,
      pet_details: pet_details || '',
      subletting_permitted: subletting_permitted || false,
      house_rules: house_rules || '',
      guest_policy: guest_policy || '',
      quiet_hours_start: quiet_hours_start || '22:00',
      quiet_hours_end: quiet_hours_end || '08:00',
      special_terms: finalSpecialTerms,
      status: 'pending_tenant',
      owner_signature: owner_legal_name || user.full_name,
      owner_signed_at: new Date().toISOString(),
      offer_expires_at: offerExpiresAt,
    });

    await base44.asServiceRole.entities.Notification.create({
      user_id: tenant_user_id,
      type: 'system',
      title: 'You received a rental agreement!',
      body: `${owner_legal_name || user.full_name} has sent you a rental agreement for "${listing.title}". Review and sign to proceed.`,
      link: `/my-payments?agreement=${agreement.id}`,
      read: false,
    });

    return Response.json({ agreement });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});