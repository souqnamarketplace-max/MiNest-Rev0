/**
 * POST /api/listings/moderate
 * Admin-only: approve, reject, pause, resume, feature, or remove a listing.
 */
import { getServiceClient, getAuthUser } from '../_lib/supabase.js';

const VALID_ACTIONS = ['approve', 'reject', 'pause', 'resume', 'feature', 'remove'];

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Verify admin
    const user = await getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const supabase = getServiceClient();

    // Check admin status
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('is_admin')
      .eq('user_id', user.id)
      .single();

    if (!profile || !profile.is_admin) {
      return res.status(403).json({ error: 'Forbidden: Admin access required' });
    }

    const { listing_id, action, reason } = req.body;
    if (!listing_id) return res.status(400).json({ error: 'Missing listing_id' });

    if (!VALID_ACTIONS.includes(action)) {
      return res.status(400).json({ error: `Invalid action. Must be one of: ${VALID_ACTIONS.join(', ')}` });
    }

    // Fetch listing
    const { data: listing } = await supabase
      .from('listings')
      .select('*')
      .eq('id', listing_id)
      .single();

    if (!listing) return res.status(404).json({ error: 'Listing not found' });

    const previousStatus = listing.status;
    let updateData = {};
    let newStatus = previousStatus;

    switch (action) {
      case 'approve':
        newStatus = 'active';
        updateData = { status: 'active', moderation_status: 'approved' };
        break;
      case 'reject':
        newStatus = 'rejected';
        updateData = { status: 'rejected', moderation_status: 'rejected' };
        break;
      case 'pause':
        newStatus = 'paused';
        updateData = { status: 'paused' };
        break;
      case 'resume':
        newStatus = 'active';
        updateData = { status: 'active' };
        break;
      case 'feature':
        updateData = { is_featured: true, featured_rank: 1 };
        break;
      case 'remove':
        newStatus = 'removed';
        updateData = { status: 'removed', moderation_status: 'removed' };
        break;
    }

    // Update listing
    await supabase.from('listings').update(updateData).eq('id', listing_id);

    // Notify owner if status changed
    if (newStatus !== previousStatus) {
      let notifTitle = '';
      let notifBody = '';

      if (action === 'approve') {
        notifTitle = 'Listing Approved on MiNest 🎉';
        notifBody = `"${listing.title}" is now live and visible to seekers.`;
      } else if (action === 'reject') {
        notifTitle = 'Listing Not Approved';
        notifBody = `"${listing.title}" was not approved. ${reason ? `Reason: ${reason}` : 'Please review our listing guidelines.'}`;
      } else if (action === 'remove') {
        notifTitle = 'Listing Removed';
        notifBody = `"${listing.title}" has been removed by an admin. ${reason ? `Reason: ${reason}` : ''}`;
      }

      if (notifTitle) {
        await supabase.from('notifications').insert({
          user_id: listing.owner_user_id,
          type: action === 'approve' ? 'listing_approved' : action === 'reject' ? 'listing_rejected' : 'listing_removed',
          title: notifTitle,
          body: notifBody,
          read: false,
          data: { listing_id, reason, link: `/listing/${listing.slug || listing_id}` },
        });

        // Send transactional email
        try {
          const { data: ownerProfile } = await supabase
            .from('user_profiles')
            .select('full_name, email')
            .eq('user_id', listing.owner_user_id)
            .single();

          if (ownerProfile?.email) {
            const baseUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://minest.ca';
            const emailType = action === 'approve' ? 'listing_approved' : 'listing_rejected';
            const emailData = action === 'approve'
              ? { name: ownerProfile.full_name, listingTitle: listing.title, listingCity: listing.city, listingSlug: listing.slug, listingId: listing_id, rentAmount: listing.rent_amount ? `$${listing.rent_amount}` : null }
              : { name: ownerProfile.full_name, listingTitle: listing.title, reason };

            await fetch(`${baseUrl}/api/emails/send`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ type: emailType, to: ownerProfile.email, data: emailData }),
            });
          }
        } catch (emailErr) {
          console.warn('[moderate] email send failed:', emailErr.message);
        }
      }
    }

    return res.status(200).json({ success: true, listing_id, action, new_status: newStatus });
  } catch (error) {
    console.error('[moderate] error:', error.message);
    return res.status(500).json({ error: error.message });
  }
}
