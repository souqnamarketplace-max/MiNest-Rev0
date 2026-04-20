/**
 * Called when a listing's status changes to "active".
 * Matches against SavedSearch (alerts_enabled + is_active, city-first narrow query)
 * and SeekerProfile (geo-first narrow query).
 * Never does full-table scans — always filters by city + country first.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// ── Inline helpers ────────────────────────────────────────────────────────────
const SEEKER_TYPES = new Set(["saved_search_match","new_matching_listing","similar_listing_available","price_drop_on_favorite","favorite_listing_updated","verified_listing_match","strong_profile_match","listing_match"]);

function isAllowedForRole(userRole, type) {
  if (!SEEKER_TYPES.has(type)) return true;
  return userRole === "seeker" || userRole === "both";
}

function isQuebec(region) {
  if (!region) return false;
  const n = region.trim().toLowerCase();
  return n === "quebec" || n === "qc" || n === "québec";
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
    link: link || `/listing/${metadata.listing_id || ""}`, read: false, dedup_key: dedupKey || null, metadata,
  });
  console.log(`[notif] created: user=${userId} type=${type}`);
  return notif;
}
// ─────────────────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    // Entity automations deliver the full entity in body.data
    const listing = body.data || null;
    if (!listing) return Response.json({ skipped: true, reason: "no listing data" });
    if (listing.status !== "active") return Response.json({ skipped: true, reason: "not active" });
    const listingId = listing.id;

    const { city, province_or_state, country, monthly_rent, listing_type, furnishing, parking_available, pets_allowed } = listing;

    // Block Quebec listings
    if (isQuebec(province_or_state)) return Response.json({ skipped: true, reason: "quebec" });

    const notifiedUsers = new Set();
    let notified = 0;

    // ── 1. Match SavedSearch (city-narrowed query) ────────────────────────────
    if (city && country) {
      const savedSearches = await base44.asServiceRole.entities.SavedSearch.filter(
        { alerts_enabled: true, is_active: true, city, country },
        "-created_date",
        100
      );

      for (const ss of savedSearches) {
        if (!ss.user_id || notifiedUsers.has(ss.user_id)) continue;
        if (ss.user_id === listing.owner_user_id) continue;
        if (isQuebec(ss.province_or_state)) continue;

        // Province match
        if (ss.province_or_state && ss.province_or_state !== province_or_state) continue;
        // Price range
        if (ss.min_price && monthly_rent < ss.min_price) continue;
        if (ss.max_price && monthly_rent > ss.max_price) continue;
        // Type
        if (ss.listing_type && ss.listing_type !== listing_type) continue;
        // Furnishing
        if (ss.furnishing && ss.furnishing !== furnishing) continue;
        // Parking
        if (ss.parking && !parking_available) continue;
        // Pets
        if (ss.pets_allowed && !pets_allowed) continue;
        // Student
        if (ss.student_friendly && !listing.student_friendly) continue;

        notifiedUsers.add(ss.user_id);

        // Update last_triggered_at on the saved search
        base44.asServiceRole.entities.SavedSearch.update(ss.id, {
          last_triggered_at: new Date().toISOString(),
        }).catch(() => {});

        const r = await createNotif(base44, ss.user_id, "saved_search_match",
          "New Room Matches Your MiNest Search",
          `"${listing.title}" in ${city} matches your saved search on MiNest: "${ss.name || city}".`,
          {
            metadata: { listing_id: listingId, saved_search_id: ss.id },
            dedupKey: `ss_match_${ss.user_id}_${listingId}_${ss.id}`,
            link: `/listing/${listingId}`,
          }
        );
        if (r) notified++;
      }
    }

    // ── 2. Match SeekerProfile (geo-first) ───────────────────────────────────
    const seekers = await base44.asServiceRole.entities.SeekerProfile.filter(
      { status: "active" }, "-created_date", 200
    );

    for (const seeker of seekers) {
      if (!seeker.owner_user_id || notifiedUsers.has(seeker.owner_user_id)) continue;
      if (seeker.owner_user_id === listing.owner_user_id) continue;

      const cities = seeker.preferred_cities || [];
      if (cities.length > 0 && city) {
        const cityMatch = cities.some((c) => c.toLowerCase() === city.toLowerCase());
        if (!cityMatch) continue;
      }
      if (seeker.preferred_country && seeker.preferred_country !== country) continue;
      if (seeker.max_budget && monthly_rent > seeker.max_budget) continue;
      if (seeker.min_budget && monthly_rent < seeker.min_budget) continue;
      if (seeker.furnished_needed && furnishing !== "furnished") continue;
      if (seeker.parking_needed && !parking_available) continue;

      notifiedUsers.add(seeker.owner_user_id);
      const r = await createNotif(base44, seeker.owner_user_id, "new_matching_listing",
        "New Room on MiNest Fits Your Profile",
        `"${listing.title}" in ${city} matches your MiNest roommate preferences.`,
        {
          metadata: { listing_id: listingId },
          dedupKey: `profile_match_${seeker.owner_user_id}_${listingId}`,
          link: `/listing/${listingId}`,
        }
      );
      if (r) notified++;
    }

    console.log(`[onListingActivated] listing=${listingId} city=${city} notified=${notified}`);
    return Response.json({ ok: true, listing_id: listingId, notified });
  } catch (error) {
    console.error("[onListingActivated] error:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});