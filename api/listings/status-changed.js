/**
 * POST /api/listings/status-changed
 * Notifies listing owner on approve/reject/expire.
 * Notifies favoritors when listing becomes unavailable.
 */
import { getServiceClient } from '../_lib/supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Support both Supabase webhook format { record, old_record }
    // AND direct call format { listing, old_data }
    const body = req.body;
    const listing = body.record || body.listing || body.data;
    const old_data = body.old_record || body.old_data;
    if (!listing || !old_data) {
      return res.status(200).json({ skipped: true, reason: 'Missing data' });
    }

    const { status, owner_user_id, title, id: listingId } = listing;
    const prevStatus = old_data.status;

    if (!owner_user_id) return res.status(200).json({ skipped: true, reason: 'No owner' });
    if (status === prevStatus) {
      return res.status(200).json({ skipped: true, reason: 'Status unchanged' });
    }

    const supabase = getServiceClient();
    const notifications = [];
    const results = [];

    // Owner notifications
    if (status === 'active' && prevStatus === 'pending_review') {
      notifications.push({
        user_id: owner_user_id,
        type: 'listing_approved',
        title: 'Listing Approved on MiNest 🎉',
        body: `"${title}" is now live and visible to seekers.`,
        read: false,
        data: { listing_id: listingId },
      });
      results.push({ event: 'listing_approved' });
    }

    if (status === 'rejected' && prevStatus === 'pending_review') {
      notifications.push({
        user_id: owner_user_id,
        type: 'listing_rejected',
        title: 'Listing Not Approved',
        body: `"${title}" was not approved. Please review our listing guidelines and resubmit.`,
        read: false,
        data: { listing_id: listingId },
      });
      results.push({ event: 'listing_rejected' });
    }

    if (status === 'expired' && prevStatus !== 'expired') {
      notifications.push({
        user_id: owner_user_id,
        type: 'listing_expired',
        title: 'Listing Expired',
        body: `"${title}" has expired. Renew it to keep it visible.`,
        read: false,
        data: { listing_id: listingId },
      });
      results.push({ event: 'listing_expired' });
    }

    // Notify favoritors when listing becomes unavailable
    const unavailableStatuses = ['expired', 'removed', 'rejected'];
    if (unavailableStatuses.includes(status) && !unavailableStatuses.includes(prevStatus)) {
      const { data: favorites } = await supabase
        .from('favorites')
        .select('user_id')
        .eq('listing_id', listingId)
        .neq('user_id', owner_user_id);

      for (const fav of (favorites || [])) {
        notifications.push({
          user_id: fav.user_id,
          type: 'favorite_listing_updated',
          title: 'A Saved Room is No Longer Available',
          body: `"${title}" has been ${status}.`,
          read: false,
          data: { listing_id: listingId },
        });
      }
      results.push({ event: 'favoritors_notified', count: favorites?.length || 0 });
    }

    // Batch insert
    if (notifications.length > 0) {
      for (let i = 0; i < notifications.length; i += 50) {
        await supabase.from('notifications').insert(notifications.slice(i, i + 50));
      }
    }

    return res.status(200).json({ ok: true, results });
  } catch (error) {
    console.error('[listings/status-changed] error:', error.message);
    return res.status(500).json({ error: error.message });
  }
}
