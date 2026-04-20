import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  // Delete all user data
  const [profiles, listings, seekerProfiles, conversations, favorites, notifications, savedSearches] = await Promise.all([
    base44.asServiceRole.entities.UserProfile.filter({ user_id: user.email }),
    base44.asServiceRole.entities.Listing.filter({ owner_user_id: user.email }),
    base44.asServiceRole.entities.SeekerProfile.filter({ owner_user_id: user.email }),
    base44.asServiceRole.entities.Conversation.filter({ participant_ids: user.email }),
    base44.asServiceRole.entities.Favorite.filter({ user_id: user.email }),
    base44.asServiceRole.entities.Notification.filter({ user_id: user.email }),
    base44.asServiceRole.entities.SavedSearch.filter({ user_id: user.email }),
  ]);

  await Promise.all([
    ...profiles.map(r => base44.asServiceRole.entities.UserProfile.delete(r.id)),
    ...listings.map(r => base44.asServiceRole.entities.Listing.delete(r.id)),
    ...seekerProfiles.map(r => base44.asServiceRole.entities.SeekerProfile.delete(r.id)),
    ...conversations.map(r => base44.asServiceRole.entities.Conversation.delete(r.id)),
    ...favorites.map(r => base44.asServiceRole.entities.Favorite.delete(r.id)),
    ...notifications.map(r => base44.asServiceRole.entities.Notification.delete(r.id)),
    ...savedSearches.map(r => base44.asServiceRole.entities.SavedSearch.delete(r.id)),
  ]);

  return Response.json({ success: true });
});