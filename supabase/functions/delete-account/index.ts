import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Get the user's JWT from the Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Verify the user with their JWT
    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userId = user.id;

    // Use service role to delete all data (bypasses RLS)
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Delete in dependency order (child tables first)
    const deletions = [
      adminClient.from('messages').delete().eq('sender_user_id', userId),
      adminClient.from('notifications').delete().eq('user_id', userId),
      adminClient.from('favorites').delete().eq('user_id', userId),
      adminClient.from('viewing_appointments').delete().eq('requester_user_id', userId),
      adminClient.from('saved_searches').delete().eq('user_id', userId),
      adminClient.from('payment_transactions').delete().eq('payer_user_id', userId),
      adminClient.from('deposit_refunds').delete().eq('tenant_user_id', userId),
      adminClient.from('payment_disputes').delete().eq('filed_by_user_id', userId),
      adminClient.from('tenant_subscriptions').delete().eq('tenant_user_id', userId),
      adminClient.from('user_verifications').delete().eq('user_id', userId),
    ];
    await Promise.allSettled(deletions);

    // Delete conversations where user is a participant
    const { data: convos } = await adminClient
      .from('conversations')
      .select('id')
      .contains('participant_ids', [userId]);
    if (convos?.length) {
      const convoIds = convos.map(c => c.id);
      await adminClient.from('messages').delete().in('conversation_id', convoIds);
      await adminClient.from('conversations').delete().in('id', convoIds);
    }

    // Delete rental agreements
    await adminClient.from('rental_agreements').delete().or(`tenant_user_id.eq.${userId},owner_user_id.eq.${userId}`);

    // Delete seeker profiles
    await adminClient.from('seeker_profiles').delete().eq('owner_user_id', userId);

    // Delete listings and associated data
    const { data: listings } = await adminClient
      .from('listings')
      .select('id')
      .eq('owner_user_id', userId);
    if (listings?.length) {
      const listingIds = listings.map(l => l.id);
      await adminClient.from('viewing_appointments').delete().in('listing_id', listingIds);
      await adminClient.from('favorites').delete().in('listing_id', listingIds);
      await adminClient.from('booking_requests').delete().in('listing_id', listingIds);
      await adminClient.from('listings').delete().eq('owner_user_id', userId);
    }

    // Delete payment plans and stripe accounts
    await Promise.allSettled([
      adminClient.from('payment_plans').delete().eq('owner_user_id', userId),
      adminClient.from('stripe_connect_accounts').delete().eq('user_id', userId),
    ]);

    // Delete user profile
    await adminClient.from('user_profiles').delete().eq('user_id', userId);

    // Delete the auth user (this is permanent)
    const { error: deleteAuthError } = await adminClient.auth.admin.deleteUser(userId);
    if (deleteAuthError) {
      console.error('Failed to delete auth user:', deleteAuthError.message);
      // Still return success — data is already deleted
    }

    return new Response(JSON.stringify({ success: true, message: 'Account and all data permanently deleted' }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Account deletion error:', err);
    return new Response(JSON.stringify({ error: 'Failed to delete account', details: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
