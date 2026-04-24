import { supabase } from '@/lib/supabase';

export async function enrichConversations(rawConversations, currentUserId) {
  if (!rawConversations.length) return [];

  // Batch fetch: collect ALL unique other-user IDs and listing IDs upfront
  const otherUserIds = new Set();
  const listingIds = new Set();

  for (const convo of rawConversations) {
    const otherId = (convo.participant_ids || []).find(id => id !== currentUserId);
    if (otherId) otherUserIds.add(otherId);
    if (convo.listing_id) listingIds.add(convo.listing_id);
  }

  // Fetch all profiles and listings in parallel — 2 queries total instead of N
  // IMPORTANT: only request columns that actually exist on public.listings.
  // Previously had 'unit_number', 'address', 'parking_included' which don't exist —
  // PostgREST rejected the whole SELECT, breaking conversation enrichment.
  const [profilesResult, listingsResult] = await Promise.all([
    otherUserIds.size > 0
      ? supabase
          .from('user_profiles')
          .select('user_id, display_name, full_name, avatar_url, verification_badges')
          .in('user_id', [...otherUserIds])
      : { data: [] },
    listingIds.size > 0
      ? supabase
          .from('listings')
          .select('id, title, city, province_or_state, country, owner_user_id, rent_amount, pets_allowed, parking_type, listing_type, street_address')
          .in('id', [...listingIds])
      : { data: [] },
  ]);

  // Build lookup maps
  const profileMap = {};
  for (const p of (profilesResult.data || [])) {
    profileMap[p.user_id] = p;
  }
  const listingMap = {};
  for (const l of (listingsResult.data || [])) {
    listingMap[l.id] = l;
  }

  // Enrich each conversation using the maps — zero extra queries
  return rawConversations.map(convo => {
    const otherId = (convo.participant_ids || []).find(id => id !== currentUserId);
    const profile = otherId ? profileMap[otherId] : null;
    const listing = convo.listing_id ? listingMap[convo.listing_id] : null;

    const context = {
      source_type: listing ? 'listing' : null,
      source_id: convo.listing_id || null,
      primary_title: listing?.title || profile?.display_name || profile?.full_name || 'Conversation',
      secondary_title: listing ? [listing.city, listing.province_or_state].filter(Boolean).join(', ') : '',
      other_user_display_name: profile?.display_name || profile?.full_name || 'User',
      other_user_id: otherId || null,
      other_user_avatar: profile?.avatar_url || null,
      other_user_verified: (profile?.verification_badges || []).length > 0,
      // NEW: expose listing owner so ConversationHeader's isOwner check can work.
      listing_owner_id: listing?.owner_user_id || null,
      // NEW: expose the full listing object so RentalOfferModal can pre-fill.
      listing: listing || null,
    };

    return { ...convo, ...context };
  });
}

// Keep backward compat for any code using buildConversationContext
export async function buildConversationContext(conversation, currentUserId) {
  const enriched = await enrichConversations([conversation], currentUserId);
  return enriched[0];
}
