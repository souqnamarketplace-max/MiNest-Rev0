/**
 * Triggered by entity automation: Listing → update
 * Handles: listing_approved, listing_rejected, listing_expired
 * Also notifies favoritors when a listing becomes unavailable.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// ── Inline notification helper ────────────────────────────────────────────────
const LISTER_TYPES = new Set(["matching_seeker_available","listing_getting_views_no_messages","listing_expiring_soon","listing_expired","boost_expiring_soon","boost_ended","boost_expired","listing_approved","listing_rejected"]);
const SEEKER_TYPES = new Set(["saved_search_match","new_matching_listing","similar_listing_available","price_drop_on_favorite","favorite_listing_updated","favorite_listing_unavailable","verified_listing_match","strong_profile_match","listing_match"]);

function getRoleTarget(type) {
  if (SEEKER_TYPES.has(type)) return "seeker";
  if (LISTER_TYPES.has(type)) return "lister";
  return "shared";
}
function isAllowedForRole(userRole, type) {
  const t = getRoleTarget(type);
  if (t === "shared") return true;
  if (userRole === "both") return true;
  return userRole === t;
}

async function createNotif(base44, userId, type, title, body, { metadata = {}, dedupKey, link } = {}) {
  const profiles = await base44.asServiceRole.entities.UserProfile.filter({ user_id: userId });
  const userRole = profiles[0]?.user_type_intent || "seeker";
  if (!isAllowedForRole(userRole, type)) return null;

  const prefResults = await base44.asServiceRole.entities.NotificationPreference.filter({ user_id: userId });
  const prefs = prefResults[0] || { lister_alerts_enabled: true, seeker_alerts_enabled: true, system_alerts_enabled: true };
  const roleTarget = getRoleTarget(type);
  if (roleTarget === "lister" && !prefs.lister_alerts_enabled) return null;
  if (roleTarget === "seeker" && !prefs.seeker_alerts_enabled) return null;

  if (dedupKey) {
    const existing = await base44.asServiceRole.entities.Notification.filter({ user_id: userId, dedup_key: dedupKey });
    if (existing.length > 0) { console.log(`[notif] dedup skip: ${dedupKey}`); return existing[0]; }
  }

  const resolvedLink = link || "/dashboard";
  const notif = await base44.asServiceRole.entities.Notification.create({
    user_id: userId, type, role_target: roleTarget, title, body,
    link: resolvedLink, read: false, dedup_key: dedupKey || null, metadata,
  });
  console.log(`[notif] created: user=${userId} type=${type} id=${notif.id}`);
  return notif;
}
// ─────────────────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();

    const listing = body.data;
    const oldListing = body.old_data;
    if (!listing || !oldListing) return Response.json({ skipped: true, reason: "missing data" });

    const { status, owner_user_id: ownerId, title: listingTitle, id: listingId } = listing;
    const prevStatus = oldListing.status;

    if (status === prevStatus) return Response.json({ skipped: true, reason: "status unchanged" });

    const results = [];

    if (status === "active" && prevStatus === "pending_review") {
      const r = await createNotif(base44, ownerId, "listing_approved",
        "Listing Approved on MiNest 🎉",
        `"${listingTitle}" is now live and visible to seekers on MiNest.`,
        { metadata: { listing_id: listingId }, dedupKey: `listing_approved_${listingId}`, link: `/listing/${listingId}` }
      );
      results.push({ event: "listing_approved", created: !!r });
    }

    if (status === "rejected" && prevStatus === "pending_review") {
      const r = await createNotif(base44, ownerId, "listing_rejected",
        "Listing Rejected",
        `"${listingTitle}" was not approved by MiNest. Please review our listing guidelines and resubmit.`,
        { metadata: { listing_id: listingId }, dedupKey: `listing_rejected_${listingId}`, link: "/dashboard" }
      );
      results.push({ event: "listing_rejected", created: !!r });
    }

    if (status === "expired" && prevStatus !== "expired") {
      const r = await createNotif(base44, ownerId, "listing_expired",
        "Listing Expired",
        `"${listingTitle}" has expired. Renew it to keep it visible.`,
        { metadata: { listing_id: listingId }, dedupKey: `listing_expired_${listingId}`, link: "/dashboard" }
      );
      results.push({ event: "listing_expired", created: !!r });
    }

    // Notify favoritors when listing becomes unavailable
    if (["expired","removed","rejected"].includes(status) && !["expired","removed","rejected"].includes(prevStatus)) {
      const favorites = await base44.asServiceRole.entities.Favorite.filter({ listing_id: listingId });
      for (const fav of favorites) {
        if (fav.user_id === ownerId) continue;
        await createNotif(base44, fav.user_id, "favorite_listing_updated",
          "A Saved Room is No Longer Available",
          `"${listingTitle}" has been ${status}.`,
          { metadata: { listing_id: listingId }, dedupKey: `fav_unavailable_${fav.user_id}_${listingId}`, link: "/favorites" }
        );
      }
      results.push({ event: "favoritors_notified", count: favorites.length });
    }

    return Response.json({ ok: true, results });
  } catch (error) {
    console.error("[onListingStatusChanged] error:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});