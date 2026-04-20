import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * Validates and returns available viewing slots for a listing
 * Also checks for conflicts and validates new booking requests
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { listing_id, requested_start, requested_end, appointment_id } = body;

    if (!listing_id || !requested_start || !requested_end) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Fetch listing
    const listings = await base44.asServiceRole.entities.Listing.filter({ id: listing_id });
    const listing = listings[0];

    if (!listing) {
      return Response.json({ error: 'Listing not found' }, { status: 404 });
    }

    // Fetch all viewing appointments for this listing
    const appointments = await base44.asServiceRole.entities.ViewingAppointment.filter({
      listing_id: listing_id,
    });

    const startTime = new Date(requested_start);
    const endTime = new Date(requested_end);
    const now = new Date();

    // Validate: not in past
    if (startTime <= now) {
      return Response.json({ 
        error: 'Viewing cannot be in the past',
        available: false 
      }, { status: 400 });
    }

    // Validate: meets minimum notice requirement
    const minimumNoticeHours = listing.minimum_notice_hours || 24;
    const minAllowedTime = new Date(now.getTime() + minimumNoticeHours * 60 * 60 * 1000);

    if (startTime < minAllowedTime) {
      return Response.json({ 
        error: `Viewing must be requested at least ${minimumNoticeHours} hours in advance`,
        available: false 
      }, { status: 400 });
    }

    // Check for overlaps with OTHER users' viewing appointments
    // Exclude current appointment if updating
    const conflictingAppointments = appointments.filter(appt => {
      // Skip if it's the current appointment being updated
      if (appointment_id && appt.id === appointment_id) {
        return false;
      }

      // Only check confirmed/approved/awaiting appointments (not declined/cancelled)
      const activeStatuses = ['requested', 'approved', 'confirmed', 'reschedule_proposed', 'awaiting_viewer_confirmation'];
      if (!activeStatuses.includes(appt.status)) {
        return false;
      }

      // Different user
      if (appt.viewer_user_id === user.email) {
        return false;
      }

      const apptStart = new Date(appt.requested_start_at || appt.confirmed_start_at);
      const apptEnd = new Date(appt.requested_end_at || appt.confirmed_end_at);

      // Check for overlap
      return !(endTime <= apptStart || startTime >= apptEnd);
    });

    if (conflictingAppointments.length > 0) {
      return Response.json({ 
        error: 'This time slot is not available. Another user has already booked it.',
        available: false,
        conflicts: conflictingAppointments.map(a => ({
          start: a.requested_start_at || a.confirmed_start_at,
          end: a.requested_end_at || a.confirmed_end_at
        }))
      }, { status: 409 });
    }

    // Check if user already has an active viewing for this listing
    const userAppointments = appointments.filter(appt => {
      return appt.viewer_user_id === user.email && 
             ['requested', 'approved', 'confirmed', 'reschedule_proposed', 'awaiting_viewer_confirmation'].includes(appt.status) &&
             (!appointment_id || appt.id !== appointment_id);
    });

    if (userAppointments.length > 0) {
      return Response.json({ 
        error: 'You already have an active viewing request for this listing. Update your existing request instead.',
        available: false,
        existingAppointment: userAppointments[0]
      }, { status: 409 });
    }

    // Success - slot is available
    return Response.json({ 
      available: true,
      message: 'Slot is available for booking'
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});