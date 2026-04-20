/**
 * Triggered by entity automation: Listing → update
 * Notifies users who favorited a listing when price drops or key fields change.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// ── Inline notification helper ────────────────────────────────────────────────
const SEEKER_TYPES = new Set(["saved_search_match","new_matching_listing","similar_listing_available","price_drop_on_favorite","favorite_listing_updated","favorite_listing_unavailable","verified_listing_match","strong_profile_match","listing_match"]);

function isAllowedForRole(userRole, type) {
  if (!SEEKER_TYPES.has(type)) return true;
  return userRole === "seeker" || userRole === "both";
}

async function createNotif(base44, userId, type, title, body, { metadata = {}, dedupKey, link } = {}) {
  const profiles = await base44.asServiceRole.entities.UserProfile.filter({ user_id: userId });
  const userRole = profiles[0]?.user_type_intent || "seeker";
  if (!isAllowedForRole(userRole, type)) return null;

  const prefResults = await base44.asServiceRole.entities.NotificationPreference.filter({ user_id: userId });
  const prefs = prefResults[0] || { seeker_alerts_enabled: true };
  if (!prefs.seeker_alerts_enabled) return null;

  if (dedupKey) {
    const existing = await base44.asServiceRole.entities.Notification.filter({ user_id: userId, dedup_key: dedupKey });
    if (existing.length > 0) { console.log(`[notif] dedup skip: ${dedupKey}`); return existing[0]; }
  }

  const notif = await base44.asServiceRole.entities.Notification.create({
    user_id: userId, type, role_target: "seeker", title, body,
    link: link || "/favorites", read: false, dedup_key: dedupKey || null, metadata,
  });
  console.log(`[notif] created: user=${userId} type=${type} id=${notif.id}`);
  return notif;
}
// ─────────────────────────────────────────────────────────────────────────────

const MAJOR_FIELDS = ["monthly_rent", "available_from", "furnishing", "status"];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const listing = body.data;
    const oldListing = body.old_data;
    const changedFields = body.changed_fields || [];

    if (!listing || !oldListing) return Response.json({ skipped: true, reason: "missing data" });

    const relevantChange = changedFields.some((f) => MAJOR_FIELDS.includes(f));
    if (!relevantChange) return Response.json({ skipped: true, reason: "no relevant field change" });

    const listingId = listing.id;
    const listingTitle = listing.title || "A saved room";

    const favorites = await base44.asServiceRole.entities.Favorite.filter({ listing_id: listingId });
    if (favorites.length === 0) return Response.json({ skipped: true, reason: "no favorites" });

    let notified = 0;

    for (const fav of favorites) {
      const userId = fav.user_id;
      if (userId === listing.owner_user_id) continue;

      if (changedFields.includes("monthly_rent") && listing.monthly_rent < oldListing.monthly_rent) {
        const drop = oldListing.monthly_rent - listing.monthly_rent;
        const r = await createNotif(base44, userId, "price_drop_on_favorite",
          "Price Drop on a Saved Room 🏷️",
          `"${listingTitle}" dropped by $${drop}/mo — now $${listing.monthly_rent}/mo.`,
          { metadata: { listing_id: listingId }, dedupKey: `price_drop_${userId}_${listingId}_${listing.monthly_rent}`, link: `/listing/${listingId}` }
        );
        if (r) notified++;
        continue;
      }

      const r = await createNotif(base44, userId, "favorite_listing_updated",
        "A Saved Room Was Updated",
        `"${listingTitle}" has been updated — check the latest details.`,
        { metadata: { listing_id: listingId }, dedupKey: `fav_updated_${userId}_${listingId}_${listing.updated_date}`, link: `/listing/${listingId}` }
      );
      if (r) notified++;
    }

    console.log(`[onFavoriteListingUpdated] listing=${listingId} notified=${notified}`);
    return Response.json({ ok: true, listing_id: listingId, notified });
  } catch (error) {
    console.error("[onFavoriteListingUpdated] error:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});