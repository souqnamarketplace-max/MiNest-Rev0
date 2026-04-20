import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';
import Stripe from 'npm:stripe@16.10.0';

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY"));
const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const signature = req.headers.get("stripe-signature");
    const body = await req.text();

    const event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      webhookSecret
    );

    const base44 = createClientFromRequest(req);

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const { listing_id, days } = session.metadata;

      if (!listing_id || !days) {
        return Response.json({ error: "Missing metadata" }, { status: 400 });
      }

      const listings = await base44.asServiceRole.entities.Listing.filter({ id: listing_id });

      if (!listings.length) {
        return Response.json({ error: "Listing not found" }, { status: 404 });
      }

      const listing = listings[0];
      const now = new Date();
      const numDays = parseInt(days, 10);
      const durationMs = numDays * 24 * 60 * 60 * 1000;

      const updateData = {
        is_boosted: true,
        is_featured: true,
        featured_rank: 1,
        boost_end_at: new Date(now.getTime() + durationMs).toISOString(),
      };

      await base44.asServiceRole.entities.Listing.update(listing_id, updateData);

      await base44.asServiceRole.entities.AuditLog.create({
        admin_user_id: session.customer_email,
        action_type: "listing_featured",
        target_type: "listing",
        target_id: listing_id,
        target_title: listing.title,
        reason: "Payment processed via Stripe"
      });
    }

    return Response.json({ received: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return Response.json({ error: error.message }, { status: 400 });
  }
});