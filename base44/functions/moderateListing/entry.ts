import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    // Admin-only access
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { listing_id, action, reason } = await req.json();

    // Validate action
    const validActions = ['approve', 'reject', 'pause', 'resume', 'feature', 'remove'];
    if (!validActions.includes(action)) {
      return Response.json({ error: 'Invalid action' }, { status: 400 });
    }

    // Fetch listing
    const listings = await base44.asServiceRole.entities.Listing.filter({ id: listing_id });
    if (!listings.length) {
      return Response.json({ error: 'Listing not found' }, { status: 404 });
    }

    const listing = listings[0];
    const previousStatus = listing.status;
    let newStatus = previousStatus;
    let updateData = {};

    // Apply action
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
        newStatus = listing.status;
        break;
      case 'remove':
        newStatus = 'removed';
        updateData = { status: 'removed', moderation_status: 'removed' };
        break;
    }

    // Update listing
    await base44.asServiceRole.entities.Listing.update(listing_id, updateData);

    // Create audit log
    await base44.asServiceRole.entities.AuditLog.create({
      admin_user_id: user.email,
      action_type: `listing_${action === 'feature' ? 'featured' : action}`,
      target_type: 'listing',
      target_id: listing_id,
      target_title: listing.title,
      reason: reason || '',
      previous_status: previousStatus,
      new_status: newStatus,
      metadata: { listing_city: listing.city, listing_price: listing.monthly_rent }
    });

    return Response.json({
      success: true,
      listing_id,
      action,
      new_status
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});