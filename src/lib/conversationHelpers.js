import { entities } from '@/api/entities';

export async function buildConversationContext(conversation, currentUserId) {
  const { participant_ids = [], listing_id } = conversation;
  let context = {
    source_type: null,
    source_id: null,
    primary_title: 'Conversation',
    secondary_title: '',
    other_user_display_name: null,
    other_user_id: null,
    other_user_avatar: null,
    other_user_verified: false,
  };

  const otherUserId = participant_ids.find((id) => id !== currentUserId);
  context.other_user_id = otherUserId;

  if (otherUserId) {
    try {
      const profiles = await entities.UserProfile.filter({ user_id: otherUserId });
      if (profiles.length > 0) {
        const p = profiles[0];
        context.other_user_display_name = p.display_name || p.full_name || 'User';
        context.other_user_avatar = p.avatar_url;
        context.other_user_verified = (p.verification_badges || []).length > 0;
      }
    } catch {}
  }

  if (listing_id) {
    try {
      const listing = await entities.Listing.get(listing_id);
      if (listing) {
        context.source_type = 'listing';
        context.source_id = listing_id;
        context.primary_title = listing.title || 'Listing';
        context.secondary_title = [listing.city, listing.province_or_state].filter(Boolean).join(', ');
      }
    } catch {}
  }

  if (!context.primary_title || context.primary_title === 'Conversation') {
    context.primary_title = context.other_user_display_name || 'Conversation';
  }
  return context;
}

export async function enrichConversations(rawConversations, currentUserId) {
  return Promise.all(
    rawConversations.map(async (convo) => {
      try {
        const context = await buildConversationContext(convo, currentUserId);
        return { ...convo, ...context };
      } catch {
        return convo;
      }
    })
  );
}
