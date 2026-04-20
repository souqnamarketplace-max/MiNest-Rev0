/**
 * Triggered by entity automation: SeekerProfile → create | update
 * Notifies listers with active listings in matching cities.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// ── Inline notification helper ────────────────────────────────────────────────
const LISTER_TYPES = new Set(["matching_seeker_available","listing_getting_views_no_messages","listing_expiring_soon","listing_expired","boost_expiring_soon","boost_ended","boost_expired","listing_approved","listing_rejected"]);

function isListerType(type) { return LISTER_TYPES.has(type); }
function isAllowedForRole(userRole, type) {
  if (!isListerType(type)) return true;
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
    const body = await req.json();
    const seeker = body.data;
    if (!seeker?.owner_user_id) return Response.json({ skipped: true, reason: "no seeker data" });
    if (seeker.status !== "active") return Response.json({ skipped: true, reason: "seeker not active" });

    const { owner_user_id, preferred_cities = [], preferred_country, max_budget, min_budget, furnished_needed, parking_needed } = seeker;
    if (preferred_cities.length === 0) return Response.json({ skipped: true, reason: "no preferred cities" });

    let notified = 0;

    for (const city of preferred_cities.slice(0, 3)) {
      const query = { status: "active" };
      if (city) query.city = city;
      if (preferred_country) query.country = preferred_country;

      const listings = await base44.asServiceRole.entities.Listing.filter(query, "-created_date", 50);

      for (const listing of listings) {
        const listerId = listing.owner_user_id;
        if (!listerId || listerId === owner_user_id) continue;
        if (max_budget && listing.monthly_rent > max_budget) continue;
        if (min_budget && listing.monthly_rent < min_budget) continue;
        if (furnished_needed && listing.furnishing !== "furnished") continue;
        if (parking_needed && !listing.parking_available) continue;

        const r = await createNotif(base44, listerId, "matching_seeker_available",
          "A Seeker is Looking in Your Area",
          `Someone is looking for a room in ${city}${max_budget ? ` with a budget up to $${max_budget}` : ""}.`,
          { metadata: { seeker_id: owner_user_id, listing_id: listing.id }, dedupKey: `seeker_match_${listerId}_${owner_user_id}_${listing.id}`, link: "/dashboard" }
        );
        if (r) notified++;
      }
    }

    console.log(`[onSeekerProfileChanged] seeker=${owner_user_id} notified=${notified}`);
    return Response.json({ ok: true, notified });
  } catch (error) {
    console.error("[onSeekerProfileChanged] error:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});