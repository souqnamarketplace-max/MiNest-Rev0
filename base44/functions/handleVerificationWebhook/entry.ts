import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';
import Stripe from 'npm:stripe@14.0.0';

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY"));
const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

Deno.serve(async (req) => {
  try {
    const body = await req.text();
    const signature = req.headers.get("stripe-signature");

    if (!signature) {
      return Response.json({ error: "No signature" }, { status: 400 });
    }

    let event;
    try {
      event = await stripe.webhooks.constructEventAsync(
        body,
        signature,
        webhookSecret
      );
    } catch (err) {
      console.error("Webhook signature verification failed:", err);
      return Response.json({ error: "Invalid signature" }, { status: 400 });
    }

    const base44 = createClientFromRequest(req);

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const { userId, verificationType } = session.metadata;

      // Update verification record
      const verifications = await base44.asServiceRole.entities.UserVerification.filter({
        user_id: userId,
        verification_type: verificationType,
      });

      if (verifications.length > 0) {
        await base44.asServiceRole.entities.UserVerification.update(
          verifications[0].id,
          {
            payment_status: "completed",
            stripe_payment_intent_id: session.payment_intent,
            status: "pending",
          }
        );
      }
    }

    return Response.json({ received: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return Response.json(
      { error: error.message || "Webhook processing failed" },
      { status: 500 }
    );
  }
});