/**
 * POST /api/listings/activated
 * Called when a listing goes active — via Supabase Database Webhook.
 * Matches against SavedSearches and SeekerProfiles.
 *
 * Optimizations:
 * - Paginated queries — handles unlimited seekers/saved searches
 * - DB-level country + budget filtering on seekers
 * - Dedup via notifiedUsers Set
 * - Batch inserts (50 per call)
 * - Skips Quebec
 * - Supports Supabase webhook format AND direct calls
 */
import { getServiceClient } from '../_lib/supabase.js';

function isQuebec(region) {
  if (!region) return false;
  const n = region.trim().toLowerCase();
  return n === 'quebec' || n === 'qc' || n === 'québec';
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    // Support Supabase webhook format: { type, record, old_record }
    // AND direct call format: { listing, old_data }
    const body = req.body;
    const listing = body.record || body.listing || body.data;

    if (!listing) return res.status(200).json({ skipped: true, reason: 'No listing data' });
    if (listing.status !== 'active') return res.status(200).json({ skipped: true, reason: 'Not active' });
    if (isQuebec(listing.province_or_state)) return res.status(200).json({ skipped: true, reason: 'Quebec' });

    // Only trigger when status JUST changed to active
    const oldRecord = body.old_record || body.old_data;
    if (oldRecord && oldRecord.status === 'active') {
      // Send saved search match emails (fire and forget)
    if (notificationsToInsert.length > 0) {
      try {
        const baseUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://minest.ca';
        const listingData = [{ id: listing.id, slug: listing.slug, title: listing.title, city: listing.city, province_or_state: listing.province_or_state, rent_amount: listing.rent_amount, cover_photo_url: listing.cover_photo_url }];

        // Get emails for notified users
        const userIds = [...new Set(notificationsToInsert.map(n => n.user_id))].slice(0, 50);
        const { data: profiles } = await supabase.from('user_profiles').select('user_id, full_name, email').in('user_id', userIds);
        const profileMap = Object.fromEntries((profiles || []).map(p => [p.user_id, p]));

        for (const notif of notificationsToInsert.slice(0, 50)) {
          const profile = profileMap[notif.user_id];
          if (!profile?.email) continue;
          fetch(`${baseUrl}/api/emails/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'saved_search_match',
              to: profile.email,
              data: { recipientName: profile.full_name, searchName: notif.data?.search_name || 'Your saved search', listings: listingData },
            }),
          }).catch(() => {});
        }
      } catch (emailErr) {
        console.warn('[activated] email send failed:', emailErr.message);
      }
    }

    return res.status(200).json({ skipped: true, reason: 'Was already active' });
    }

    const supabase = getServiceClient();
    const { id: listingId, city, country, province_or_state, rent_amount, monthly_rent,
            listing_type, furnishing, pets_allowed, student_friendly, owner_user_id, title } = listing;
    const rent = rent_amount || monthly_rent || 0;
    const notifiedUsers = new Set();
    const notifications = [];

    // ── 1. Match SavedSearches ────────────────────────────────────────────
    if (city && country) {
      let page = 0;
      while (true) {
        const { data: searches } = await supabase
          .from('saved_searches')
          .select('id, user_id, name, filters')
          .eq('alerts_enabled', true)
          .eq('is_active', true)
          .range(page * 200, page * 200 + 199);

        if (!searches?.length) break;

        for (const ss of searches) {
          if (!ss.user_id || notifiedUsers.has(ss.user_id) || ss.user_id === owner_user_id) continue;
          const f = ss.filters || {};
          if (f.city && f.city.toLowerCase() !== city.toLowerCase()) continue;
          if (f.country && f.country !== country) continue;
          if (f.province_or_state && f.province_or_state !== province_or_state) continue;
          if (f.price_min && rent < Number(f.price_min)) continue;
          if (f.price_max && rent > Number(f.price_max)) continue;
          if (f.listing_type && f.listing_type !== listing_type) continue;
          if (f.furnishing && f.furnishing !== furnishing) continue;
          if (f.pets_allowed && !pets_allowed) continue;
          if (f.student_friendly && !student_friendly) continue;

          notifiedUsers.add(ss.user_id);
          supabase.from('saved_searches').update({ last_alerted_at: new Date().toISOString() })
            .eq('id', ss.id).then(() => {}).catch(() => {});

          notifications.push({
            user_id: ss.user_id, type: 'saved_search_match',
            title: 'New Room Matches Your Search',
            body: `"${title}" in ${city} matches your saved search "${ss.name || city}".`,
            read: false, data: { listing_id: listingId, saved_search_id: ss.id },
          });
        }

        if (searches.length < 200) break;
        page++;
      }
    }

    // ── 2. Match SeekerProfiles ───────────────────────────────────────────
    let seekerPage = 0;
    while (true) {
      let query = supabase
        .from('seeker_profiles')
        .select('owner_user_id, preferred_cities, min_budget, max_budget')
        .eq('status', 'active')
        .eq('is_visible', true);

      if (country) query = query.eq('preferred_country', country);

      const { data: seekers } = await query.range(seekerPage * 500, seekerPage * 500 + 499);
      if (!seekers?.length) break;

      for (const seeker of seekers) {
        if (!seeker.owner_user_id || notifiedUsers.has(seeker.owner_user_id) || seeker.owner_user_id === owner_user_id) continue;

        // City match
        const cities = seeker.preferred_cities || [];
        if (cities.length > 0 && city) {
          if (!cities.some(c => c.toLowerCase() === city.toLowerCase())) continue;
        }

        // Budget match
        if (seeker.max_budget && rent > seeker.max_budget) continue;
        if (seeker.min_budget && rent < seeker.min_budget) continue;

        notifiedUsers.add(seeker.owner_user_id);
        notifications.push({
          user_id: seeker.owner_user_id, type: 'new_matching_listing',
          title: 'New Room Fits Your Profile',
          body: `"${title}" in ${city} matches your MiNest roommate preferences.`,
          read: false, data: { listing_id: listingId },
        });
      }

      if (seekers.length < 500) break;
      seekerPage++;
    }

    // ── 3. Batch insert notifications ─────────────────────────────────────
    for (let i = 0; i < notifications.length; i += 50) {
      await supabase.from('notifications').insert(notifications.slice(i, i + 50));
    }

    console.log(`[listings/activated] listing=${listingId} city=${city} notified=${notifiedUsers.size}`);
    // Send saved search match emails (fire and forget)
    if (notificationsToInsert.length > 0) {
      try {
        const baseUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://minest.ca';
        const listingData = [{ id: listing.id, slug: listing.slug, title: listing.title, city: listing.city, province_or_state: listing.province_or_state, rent_amount: listing.rent_amount, cover_photo_url: listing.cover_photo_url }];

        // Get emails for notified users
        const userIds = [...new Set(notificationsToInsert.map(n => n.user_id))].slice(0, 50);
        const { data: profiles } = await supabase.from('user_profiles').select('user_id, full_name, email').in('user_id', userIds);
        const profileMap = Object.fromEntries((profiles || []).map(p => [p.user_id, p]));

        for (const notif of notificationsToInsert.slice(0, 50)) {
          const profile = profileMap[notif.user_id];
          if (!profile?.email) continue;
          fetch(`${baseUrl}/api/emails/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'saved_search_match',
              to: profile.email,
              data: { recipientName: profile.full_name, searchName: notif.data?.search_name || 'Your saved search', listings: listingData },
            }),
          }).catch(() => {});
        }
      } catch (emailErr) {
        console.warn('[activated] email send failed:', emailErr.message);
      }
    }

    return res.status(200).json({ ok: true, listing_id: listingId, notified: notifiedUsers.size });
  } catch (error) {
    console.error('[listings/activated] error:', error.message);
    return res.status(500).json({ error: error.message });
  }
}
