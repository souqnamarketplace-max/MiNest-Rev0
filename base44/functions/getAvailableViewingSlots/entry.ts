import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * Returns available viewing slots for a listing based on owner preferences
 * and existing bookings
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { listing_id, requested_date } = await req.json();

    if (!listing_id || !requested_date) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Fetch listing
    const listings = await base44.asServiceRole.entities.Listing.filter({ id: listing_id });
    const listing = listings[0];

    if (!listing) {
      return Response.json({ error: 'Listing not found' }, { status: 404 });
    }

    // Fetch all appointments for this listing on the requested date
    const allAppointments = await base44.asServiceRole.entities.ViewingAppointment.filter({
      listing_id: listing_id,
    });

    const dateStart = new Date(requested_date);
    dateStart.setHours(0, 0, 0, 0);
    const dateEnd = new Date(requested_date);
    dateEnd.setHours(23, 59, 59, 999);

    // Filter appointments for this date (exclude own, cancelled, declined)
    const bookedSlots = allAppointments
      .filter(appt => {
        const apptTime = new Date(appt.requested_start_at || appt.confirmed_start_at);
        const activeStatuses = ['requested', 'approved', 'confirmed', 'reschedule_proposed', 'awaiting_viewer_confirmation'];
        return apptTime >= dateStart && apptTime <= dateEnd && activeStatuses.includes(appt.status);
      })
      .map(appt => ({
        start: new Date(appt.requested_start_at || appt.confirmed_start_at),
        end: new Date(appt.requested_end_at || appt.confirmed_end_at)
      }));

    // Generate time slots (9 AM to 5 PM in 30-min intervals)
    const duration = listing.viewing_duration_minutes || 30;
    const buffer = listing.viewing_buffer_minutes || 15;
    const slots = [];

    const now = new Date();
    const minimumNoticeHours = listing.minimum_notice_hours || 2;
    const minAllowedTime = new Date(now.getTime() + minimumNoticeHours * 60 * 60 * 1000);

    // If date is today, start from current time + minimum notice, otherwise start at 9 AM
    let currentTime = new Date(dateStart);
    
    const isToday = dateStart.toDateString() === now.toDateString();
    if (isToday) {
      // Round current time up to next 30-minute interval
      currentTime = new Date(Math.max(now.getTime(), minAllowedTime.getTime()));
      const minutes = currentTime.getMinutes();
      const remainder = minutes % 30;
      if (remainder !== 0) {
        currentTime.setMinutes(minutes + (30 - remainder));
      }
      currentTime.setSeconds(0);
      currentTime.setMilliseconds(0);
    } else {
      currentTime.setHours(9, 0, 0, 0);
    }

    const slotEnd = new Date(dateStart);
    slotEnd.setHours(23, 59, 59, 999);

    while (currentTime < slotEnd) {
      const slotStartTime = new Date(currentTime);
      const slotEndTime = new Date(slotStartTime.getTime() + duration * 60 * 1000);
      const slotWithBuffer = new Date(slotEndTime.getTime() + buffer * 60 * 1000);

      // Check if slot is in past
      if (slotStartTime <= now) {
        currentTime = new Date(currentTime.getTime() + 30 * 60 * 1000);
        continue;
      }

      // For same-day requests, ensure minimum notice from now; for future dates, just ensure it's 9 AM or later
      if (isToday && slotStartTime.getTime() - now.getTime() < minimumNoticeHours * 60 * 60 * 1000) {
        currentTime = new Date(currentTime.getTime() + 30 * 60 * 1000);
        continue;
      }

      // Check if slot overlaps with any booked slots
      const isBooked = bookedSlots.some(booked => {
        return !(slotEndTime <= booked.start || slotStartTime >= booked.end);
      });

      if (!isBooked) {
        slots.push({
          start: slotStartTime.toISOString(),
          end: slotEndTime.toISOString(),
          available: true
        });
      }

      currentTime = new Date(currentTime.getTime() + 30 * 60 * 1000);
    }

    return Response.json({
      date: requested_date,
      slots: slots,
      listing_timezone: listing.viewing_timezone || 'UTC',
      total_available: slots.length
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});