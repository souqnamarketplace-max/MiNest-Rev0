import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { event, data, old_data } = await req.json();

    if (!data || !event) {
      return Response.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const appointment = data;
    const oldAppointment = old_data;

    // Determine what changed
    const statusChanged = oldAppointment?.status !== appointment.status;
    const newStatus = appointment.status;
    const oldStatus = oldAppointment?.status;

    if (!statusChanged) {
      return Response.json({ success: true });
    }

    // Fetch related data
    const [listing, viewerProfile, ownerProfile] = await Promise.all([
      base44.asServiceRole.entities.Listing.filter({ id: appointment.listing_id }).then(r => r[0]),
      base44.asServiceRole.entities.UserProfile.filter({ user_id: appointment.viewer_user_id }).then(r => r[0]),
      base44.asServiceRole.entities.UserProfile.filter({ user_id: appointment.listing_owner_user_id }).then(r => r[0]),
    ]);

    const notifications = [];

    // EVENT 1: Viewer requested → notify owner
    if (newStatus === 'requested') {
      notifications.push({
        user_id: appointment.listing_owner_user_id,
        type: 'viewing_request',
        role_target: 'lister',
        title: 'New Viewing Request',
        body: `${viewerProfile?.display_name || 'A seeker'} requested to view ${listing?.title}`,
        link: `/dashboard?tab=requests`,
        metadata: {
          listing_id: appointment.listing_id,
          appointment_id: appointment.id,
          viewer_user_id: appointment.viewer_user_id,
        },
        dedup_key: `viewing_request_${appointment.id}`,
      });
    }

    // EVENT 2: Owner approved → notify viewer
    if (oldStatus === 'requested' && newStatus === 'confirmed') {
      notifications.push({
        user_id: appointment.viewer_user_id,
        type: 'viewing_approved',
        role_target: 'seeker',
        title: 'Viewing Confirmed',
        body: `Your viewing for ${listing?.title} has been confirmed`,
        link: `/listing/${appointment.listing_id}`,
        metadata: {
          listing_id: appointment.listing_id,
          appointment_id: appointment.id,
        },
        dedup_key: `viewing_approved_${appointment.id}`,
      });
    }

    // EVENT 3: Owner declined → notify viewer
    if (newStatus === 'declined' && oldStatus === 'requested') {
      notifications.push({
        user_id: appointment.viewer_user_id,
        type: 'viewing_declined',
        role_target: 'seeker',
        title: 'Viewing Request Declined',
        body: `Your viewing request for ${listing?.title} was declined${appointment.owner_response_message ? ': ' + appointment.owner_response_message : ''}`,
        link: `/listing/${appointment.listing_id}`,
        metadata: {
          listing_id: appointment.listing_id,
          appointment_id: appointment.id,
        },
        dedup_key: `viewing_declined_${appointment.id}`,
      });
    }

    // EVENT 4: Owner proposed new time → notify viewer
    if (newStatus === 'awaiting_viewer_confirmation' && oldStatus === 'requested') {
      notifications.push({
        user_id: appointment.viewer_user_id,
        type: 'viewing_proposal',
        role_target: 'seeker',
        title: 'Alternative Time Proposed',
        body: `${ownerProfile?.display_name || 'The host'} proposed a different time for your viewing of ${listing?.title}`,
        link: `/listing/${appointment.listing_id}`,
        metadata: {
          listing_id: appointment.listing_id,
          appointment_id: appointment.id,
        },
        dedup_key: `viewing_proposal_${appointment.id}`,
      });
    }

    // EVENT 5: Viewer accepted proposal → notify owner
    if (oldStatus === 'awaiting_viewer_confirmation' && newStatus === 'confirmed') {
      notifications.push({
        user_id: appointment.listing_owner_user_id,
        type: 'viewing_accepted',
        role_target: 'lister',
        title: 'Viewing Confirmed',
        body: `${viewerProfile?.display_name || 'A seeker'} confirmed the viewing for ${listing?.title}`,
        link: `/dashboard?tab=requests`,
        metadata: {
          listing_id: appointment.listing_id,
          appointment_id: appointment.id,
          viewer_user_id: appointment.viewer_user_id,
        },
        dedup_key: `viewing_accepted_${appointment.id}`,
      });
    }

    // EVENT 6: Viewer cancelled → notify owner
    if (newStatus === 'cancelled_by_viewer' && (oldStatus === 'confirmed' || oldStatus === 'requested' || oldStatus === 'awaiting_viewer_confirmation')) {
      notifications.push({
        user_id: appointment.listing_owner_user_id,
        type: 'viewing_cancelled',
        role_target: 'lister',
        title: 'Viewing Cancelled',
        body: `${viewerProfile?.display_name || 'A seeker'} cancelled the viewing for ${listing?.title}`,
        link: `/dashboard?tab=requests`,
        metadata: {
          listing_id: appointment.listing_id,
          appointment_id: appointment.id,
        },
        dedup_key: `viewing_cancelled_${appointment.id}`,
      });
    }

    // Create all notifications
    if (notifications.length > 0) {
      for (const notif of notifications) {
        await base44.asServiceRole.entities.Notification.create(notif);
      }
    }

    return Response.json({ success: true, notificationsCreated: notifications.length });
  } catch (error) {
    console.error('Error in onViewingAppointmentChanged:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});