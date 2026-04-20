import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';
import Stripe from 'npm:stripe@16.10.0';

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY"));

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { listing_id, days, currency: requestedCurrency } = await req.json();

    if (!listing_id || !days || days < 1) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Verify listing ownership
    const listings = await base44.entities.Listing.filter({ id: listing_id });
    if (!listings.length || listings[0].owner_user_id !== user.email) {
      return Response.json({ error: 'Listing not found or unauthorized' }, { status: 403 });
    }
    const listing = listings[0];

    // Fetch admin boost settings
    const boostSettingsList = await base44.asServiceRole.entities.BoostSettings.list();
    if (!boostSettingsList.length) {
      return Response.json({ error: 'Boost pricing not configured. Please contact support.' }, { status: 503 });
    }

    const boostSettings = boostSettingsList[0];

    if (!boostSettings.is_active) {
      return Response.json({ error: 'Boosting is currently unavailable.' }, { status: 503 });
    }

    const numDays = Math.max(boostSettings.min_days ?? 1, Math.min(boostSettings.max_days ?? 30, Number(days)));

    // Use listing's currency to pick correct per-day price
    const currency = ((requestedCurrency || listing.currency_code || 'CAD')).toUpperCase();
    const pricePerDay = currency === 'USD'
      ? (boostSettings.price_per_day_usd ?? boostSettings.price_per_day ?? 0)
      : (boostSettings.price_per_day_cad ?? boostSettings.price_per_day ?? 0);

    if (!pricePerDay || pricePerDay <= 0) {
      return Response.json({ error: `Boost pricing not configured for ${currency}. Please contact support.` }, { status: 503 });
    }

    const totalCents = Math.round(pricePerDay * numDays * 100);

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      customer_email: user.email,
      line_items: [{
        price_data: {
          currency: currency.toLowerCase(),
          product_data: {
            name: `Boost Listing (${numDays} days)`,
            description: `${listing.title} - ${listing.city}, ${listing.province_or_state}`
          },
          unit_amount: totalCents
        },
        quantity: 1
      }],
      success_url: "https://www.minest.ca/dashboard?boost_success=true",
      cancel_url: "https://www.minest.ca/dashboard?boost_canceled=true",
      metadata: {
        listing_id,
        days: String(numDays),
        user_email: user.email
      }
    });

    return Response.json({
      sessionId: session.id,
      checkoutUrl: session.url
    });
  } catch (error) {
    console.error('Checkout error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});