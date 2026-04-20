import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';
import Stripe from 'npm:stripe@16.10.0';

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY"));

// Stripe standard fee: 2.9% + 30¢ per transaction
function calculateStripeFee(amountCents) {
  return Math.round(amountCents * 0.029) + 30;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { limit = 100 } = await req.json().catch(() => ({}));

    // Fetch completed checkout sessions (up to 100)
    const sessions = await stripe.checkout.sessions.list({
      limit,
      status: 'complete',
    });

    const boostSessions = sessions.data.filter(
      s => s.metadata?.listing_id && s.metadata?.days
    );

    let totalGrossCAD = 0;
    let totalGrossUSD = 0;
    let totalFeeCAD = 0;
    let totalFeeUSD = 0;
    let totalBoostsCAD = 0;
    let totalBoostsUSD = 0;

    const transactions = boostSessions.map(s => {
      const amountCents = s.amount_total || 0;
      const currency = (s.currency || 'cad').toUpperCase();
      const stripeFee = calculateStripeFee(amountCents);
      const netCents = amountCents - stripeFee;

      if (currency === 'USD') {
        totalGrossUSD += amountCents;
        totalFeeUSD += stripeFee;
        totalBoostsUSD++;
      } else {
        totalGrossCAD += amountCents;
        totalFeeCAD += stripeFee;
        totalBoostsCAD++;
      }

      return {
        id: s.id,
        listing_id: s.metadata?.listing_id,
        days: s.metadata?.days,
        user_email: s.customer_email,
        currency,
        gross_cents: amountCents,
        stripe_fee_cents: stripeFee,
        net_cents: netCents,
        created_at: new Date(s.created * 1000).toISOString(),
      };
    });

    // Fetch all currently boosted listings from DB for reference
    const boostedListings = await base44.asServiceRole.entities.Listing.filter({ is_boosted: true });

    // Build a set of listing IDs already covered by Stripe transactions
    const stripeListingIds = new Set(transactions.map(t => t.listing_id));

    // Manual boosts: boosted listings NOT found in Stripe sessions
    const manualBoosts = boostedListings
      .filter(l => !stripeListingIds.has(l.id) && l.boost_end_at)
      .map(l => ({
        id: `manual_${l.id}`,
        listing_id: l.id,
        listing_title: l.title,
        days: null,
        user_email: l.owner_user_id,
        currency: (l.currency_code || 'CAD').toUpperCase(),
        gross_cents: null,
        stripe_fee_cents: null,
        net_cents: null,
        created_at: l.updated_date || l.created_date,
        boost_end_at: l.boost_end_at,
        is_manual: true,
      }));

    return Response.json({
      transactions,
      manual_boosts: manualBoosts,
      summary: {
        cad: {
          gross_cents: totalGrossCAD,
          fee_cents: totalFeeCAD,
          net_cents: totalGrossCAD - totalFeeCAD,
          count: totalBoostsCAD,
        },
        usd: {
          gross_cents: totalGrossUSD,
          fee_cents: totalFeeUSD,
          net_cents: totalGrossUSD - totalFeeUSD,
          count: totalBoostsUSD,
        },
        total_boosts: boostSessions.length,
        manual_boosts_count: manualBoosts.length,
      },
    });
  } catch (error) {
    console.error('Earnings error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});