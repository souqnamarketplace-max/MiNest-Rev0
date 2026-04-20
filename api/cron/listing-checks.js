/**
 * GET /api/cron/listing-checks
 * Runs daily via Vercel Cron (configured in vercel.json).
 * 1. Listings expiring in ≤3 days → listing_expiring_soon notification
 * 2. Listings past expires_at → mark expired + notify owner
 * 3. Boosts expiring in ≤1 day → boost_expiring_soon notification
 * 4. Boosts past boost_end_at → clear boost flags + notify owner
 *
 * Optimized: uses targeted DB queries, no full table scans.
 */
import { getServiceClient } from '../_lib/supabase.js';

export default async function handler(req, res) {
  // Vercel cron sends GET requests
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify cron secret to prevent unauthorized calls
  const authHeader = req.headers.authorization;
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const supabase = getServiceClient();
    const now = new Date();
    const in3Days = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    const in1Day = new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000);
    const stats = { expiring_soon: 0, expired: 0, boost_expiring: 0, boost_ended: 0 };
    const notifications = [];

    // ── 1 & 2: Listing expiry checks ─────────────────────────────────────
    // Only fetch active listings that have an expires_at set
    const { data: expiringListings } = await supabase
      .from('listings')
      .select('id, title, owner_user_id, expires_at')
      .eq('status', 'active')
      .not('expires_at', 'is', null)
      .lte('expires_at', in3Days.toISOString())
      .limit(200);

    const expiredIds = [];

    for (const listing of (expiringListings || [])) {
      const expiresAt = new Date(listing.expires_at);

      if (expiresAt <= now) {
        // Mark as expired
        expiredIds.push(listing.id);
        notifications.push({
          user_id: listing.owner_user_id,
          type: 'listing_expired',
          title: 'Listing Expired',
          body: `"${listing.title}" has expired. Renew it to keep it visible.`,
          read: false,
          data: { listing_id: listing.id },
        });
        stats.expired++;
      } else {
        // Expiring soon — only notify once (dedup by date + listing_id)
        const dayStr = expiresAt.toLocaleDateString('en-CA');
        const dedupKey = `expiring_soon_${listing.id}_${dayStr}`;
        let existing = null;
        try {
          const { data } = await supabase
            .from('notifications')
            .select('id')
            .eq('user_id', listing.owner_user_id)
            .eq('dedup_key', dedupKey)
            .maybeSingle();
          existing = data;
        } catch { /* dedup_key column may not exist yet */ }
        if (!existing) {
          notifications.push({
            user_id: listing.owner_user_id,
            type: 'listing_expiring_soon',
            title: 'Your Listing is Expiring Soon ⏰',
            body: `"${listing.title}" expires on ${dayStr}. Renew to stay visible.`,
            read: false,
            dedup_key: dedupKey,
            data: { listing_id: listing.id },
          });
          stats.expiring_soon++;
        }
      }
    }

    // Batch update expired listings
    if (expiredIds.length > 0) {
      await supabase
        .from('listings')
        .update({ status: 'expired' })
        .in('id', expiredIds);
    }

    // ── 3 & 4: Boost expiry checks ────────────────────────────────────────
    const { data: boostedListings } = await supabase
      .from('listings')
      .select('id, title, owner_user_id, boost_end_at')
      .eq('is_boosted', true)
      .eq('status', 'active')
      .not('boost_end_at', 'is', null)
      .lte('boost_end_at', in1Day.toISOString())
      .limit(100);

    const boostEndedIds = [];

    for (const listing of (boostedListings || [])) {
      const boostEnd = new Date(listing.boost_end_at);

      if (boostEnd <= now) {
        boostEndedIds.push(listing.id);
        notifications.push({
          user_id: listing.owner_user_id,
          type: 'boost_ended',
          title: 'Listing Boost Ended',
          body: `The boost on "${listing.title}" has ended. Renew to maintain top placement.`,
          read: false,
          data: { listing_id: listing.id },
        });
        stats.boost_ended++;
      } else {
        // Dedup boost expiring notification
        const boostDedupKey = `boost_expiring_${listing.id}_${boostEnd.toISOString().slice(0,10)}`;
        let boostExisting = null;
        try {
          const { data } = await supabase
            .from('notifications')
            .select('id')
            .eq('user_id', listing.owner_user_id)
            .eq('dedup_key', boostDedupKey)
            .maybeSingle();
          boostExisting = data;
        } catch { /* dedup_key column may not exist yet */ }
        if (!boostExisting) {
          notifications.push({
            user_id: listing.owner_user_id,
            type: 'boost_expiring_soon',
            title: 'Your Boost is Ending Soon',
            body: `The boost on "${listing.title}" expires tomorrow. Renew to keep priority placement.`,
            read: false,
            dedup_key: boostDedupKey,
            data: { listing_id: listing.id },
          });
          stats.boost_expiring++;
        }
      }
    }

    // Clear boost flags for ended boosts
    if (boostEndedIds.length > 0) {
      await supabase
        .from('listings')
        .update({ is_boosted: false, boost_end_at: null })
        .in('id', boostEndedIds);
    }

    // Batch insert all notifications
    if (notifications.length > 0) {
      for (let i = 0; i < notifications.length; i += 50) {
        await supabase.from('notifications').insert(notifications.slice(i, i + 50));
      }
    }

    // Send expiry emails for expired and expiring-soon listings
    try {
      const baseUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://minest.ca';
      const emailNotifs = notifications.filter(n => ['listing_expired', 'listing_expiring_soon'].includes(n.type));

      if (emailNotifs.length > 0) {
        // Get owner profiles for email
        const ownerIds = [...new Set(emailNotifs.map(n => n.user_id))];
        const { data: profiles } = await supabase
          .from('user_profiles')
          .select('user_id, full_name, email')
          .in('user_id', ownerIds);
        const profileMap = Object.fromEntries((profiles || []).map(p => [p.user_id, p]));

        for (const notif of emailNotifs) {
          const profile = profileMap[notif.user_id];
          if (!profile?.email) continue;
          // Use the existing deliver endpoint which respects preferences
          fetch(`${baseUrl}/api/notifications/deliver`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.CRON_SECRET}` },
            body: JSON.stringify({ type: notif.type, to: profile.email, title: notif.title, body: notif.body, data: notif.data }),
          }).catch(() => {});
        }
      }
    } catch (emailErr) {
      console.warn('[cron/listing-checks] email error:', emailErr.message);
    }

    console.log('[cron/listing-checks] done:', JSON.stringify(stats));
    return res.status(200).json({ ok: true, stats });
  } catch (error) {
    console.error('[cron/listing-checks] error:', error.message);
    return res.status(500).json({ error: error.message });
  }
}
