import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';
import Stripe from 'npm:stripe@14.0.0';

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY"));

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { verificationType, amount } = await req.json();

    if (!verificationType || !amount) {
      return Response.json({ error: 'Missing parameters' }, { status: 400 });
    }

    // Create Stripe session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'cad',
            product_data: {
              name: `${verificationType.charAt(0).toUpperCase() + verificationType.slice(1)} Verification`,
              description: 'MiNest Verification Badge',
            },
            unit_amount: Math.round(amount * 100),
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${new URL(req.url).origin}/verification-flow?type=${verificationType}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${new URL(req.url).origin}/verification-flow?type=${verificationType}`,
      customer_email: user.email,
      metadata: {
        userId: user.email,
        verificationType,
      },
    });

    // Create verification record
    const existingVerifs = await base44.asServiceRole.entities.UserVerification.filter({
      user_id: user.email,
      verification_type: verificationType,
    });

    if (existingVerifs.length === 0) {
      await base44.asServiceRole.entities.UserVerification.create({
        user_id: user.email,
        verification_type: verificationType,
        payment_session_id: session.id,
        payment_status: 'pending',
        status: 'pending',
      });
    }

    return Response.json({ sessionId: session.id });
  } catch (error) {
    console.error('Checkout error:', error);
    return Response.json(
      { error: error.message || 'Failed to create checkout session' },
      { status: 500 }
    );
  }
});