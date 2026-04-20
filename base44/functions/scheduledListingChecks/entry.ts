/**
 * Scheduled job — runs daily at 8am MT.
 * 1. Listings expiring within 3 days → listing_expiring_soon
 * 2. Active listings past expires_at → mark expired + notify
 * 3. Boosts expiring within 1 day → boost_expiring_soon
 * 4. Boosts past boost_end_at → clear boost + notify boost_ended
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// ── Inline notification helper ────────────────────────────────────────────────
const LISTER_TYPES = new Set(["matching_seeker_available","listing_getting_views_no_messages","listing_expiring_soon","listing_expired","boost_expiring_soon","boost_ended","boost_expired","listing_approved","listing_rejected"]);

function isAllowedForRole(userRole, type) {
  if (!LISTER_TYPES.has(type)) return true;
  return userRole === "lister" || userRole === "both";
}

async function createNotif(base44, userId, type, title, body, { metadata = {}, dedupKey, link } = {}) {
  const profiles = await base44.asServiceRole.entities.UserProfile.filter({ user_id: userId });
  const userRole = profiles[0]?.user_type_intent || "lister";
  if (!isAllowedForRole(userRole, type)) return null;

  const prefResults = await base44.asServiceRole.entities.NotificationPreference.filter({ user_id: userId });
  const prefs = prefResults[0] || { lister_alerts_enabled: true };
  if (!prefs.lister_alerts_enabled) return null;

  if (dedupKey) {
    const existing = await base44.asServiceRole.entities.Notification.filter({ user_id: userId, dedup_key: dedupKey });
    if (existing.length > 0) { console.log(`[notif] dedup skip: ${dedupKey}`); return existing[0]; }
  }

  const notif = await base44.asServiceRole.entities.Notification.create({
    user_id: userId, type, role_target: "lister", title, body,
    link: link || "/dashboard", read: false, dedup_key: dedupKey || null, metadata,
  });
  console.log(`[notif] created: user=${userId} type=${type} id=${notif.id}`);
  return notif;
}
// ─────────────────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const now = new Date();
    const in3Days = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    const in1Day = new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000);
    const stats = { expiring_soon: 0, expired: 0, boost_expiring: 0, boost_ended: 0 };

    const activeListings = await base44.asServiceRole.entities.Listing.filter(
      { status: "active" }, "-expires_at", 200
    );

    // Listing expiry checks
    for (const listing of activeListings) {
      if (!listing.expires_at) continue;
      const expiresAt = new Date(listing.expires_at);

      if (expiresAt <= now) {
        // Mark expired
        await base44.asServiceRole.entities.Listing.update(listing.id, { status: "expired" });
        const r = await createNotif(base44, listing.owner_user_id, "listing_expired",
          "Listing Expired",
          `"${listing.title}" has expired. Renew it to keep it visible.`,
          { metadata: { listing_id: listing.id }, dedupKey: `listing_expired_${listing.id}`, link: "/dashboard" }
        );
        if (r) stats.expired++;
      } else if (expiresAt <= in3Days) {
        const dayStr = expiresAt.toLocaleDateString("en-CA");
        const r = await createNotif(base44, listing.owner_user_id, "listing_expiring_soon",
          "Your Listing is Expiring Soon ⏰",
          `"${listing.title}" expires on ${dayStr}. Renew to stay visible.`,
          { metadata: { listing_id: listing.id }, dedupKey: `expiring_soon_${listing.id}_${dayStr}`, link: "/dashboard" }
        );
        if (r) stats.expiring_soon++;
      }
    }

    // Boost checks
    const boostedListings = await base44.asServiceRole.entities.Listing.filter(
      { is_boosted: true, status: "active" }, "-boost_end_at", 100
    );

    for (const listing of boostedListings) {
      if (!listing.boost_end_at) continue;
      const boostEnd = new Date(listing.boost_end_at);

      if (boostEnd <= now) {
        await base44.asServiceRole.entities.Listing.update(listing.id, { is_boosted: false, boost_end_at: null });
        const r = await createNotif(base44, listing.owner_user_id, "boost_ended",
          "Listing Boost Ended",
          `The boost on "${listing.title}" has ended. Renew to maintain top placement.`,
          { metadata: { listing_id: listing.id }, dedupKey: `boost_ended_${listing.id}_${listing.boost_end_at}`, link: "/dashboard" }
        );
        if (r) stats.boost_ended++;
      } else if (boostEnd <= in1Day) {
        const r = await createNotif(base44, listing.owner_user_id, "boost_expiring_soon",
          "Your Boost is Ending Soon",
          `The boost on "${listing.title}" expires tomorrow. Renew to keep priority placement.`,
          { metadata: { listing_id: listing.id }, dedupKey: `boost_expiring_${listing.id}_${boostEnd.toISOString().slice(0,10)}`, link: "/dashboard" }
        );
        if (r) stats.boost_expiring++;
      }
    }

    console.log("[scheduledListingChecks] done:", JSON.stringify(stats));
    return Response.json({ ok: true, stats });
  } catch (error) {
    console.error("[scheduledListingChecks] error:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});