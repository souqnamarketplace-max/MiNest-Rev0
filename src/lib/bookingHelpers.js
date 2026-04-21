/**
 * Booking helpers for daily rental system
 * Handles availability checking, overlap prevention, and price calculation
 */

import { supabase } from '@/lib/supabase';

/**
 * Check if dates are available for a listing
 * Returns { available: boolean, conflicts: [] }
 */
export async function checkAvailability(listingId, checkinDate, checkoutDate) {
  // Check for overlapping confirmed or pending bookings
  const { data: conflicts, error } = await supabase
    .from('bookings')
    .select('id, checkin_date, checkout_date, status')
    .eq('listing_id', listingId)
    .in('status', ['confirmed', 'pending'])
    .lt('checkin_date', checkoutDate)
    .gt('checkout_date', checkinDate);

  if (error) {
    console.error('Availability check error:', error);
    return { available: false, conflicts: [], error: error.message };
  }

  return {
    available: !conflicts || conflicts.length === 0,
    conflicts: conflicts || [],
  };
}

/**
 * Check if any dates fall on blocked dates
 */
export function hasBlockedDates(blockedDates, checkinDate, checkoutDate) {
  if (!blockedDates || !Array.isArray(blockedDates) || blockedDates.length === 0) {
    return { blocked: false, blockedDays: [] };
  }

  const checkin = new Date(checkinDate);
  const checkout = new Date(checkoutDate);
  const blockedSet = new Set(blockedDates);
  const blockedDays = [];

  const current = new Date(checkin);
  while (current < checkout) {
    const dateStr = current.toISOString().split('T')[0];
    if (blockedSet.has(dateStr)) {
      blockedDays.push(dateStr);
    }
    current.setDate(current.getDate() + 1);
  }

  return {
    blocked: blockedDays.length > 0,
    blockedDays,
  };
}

/**
 * Calculate booking total
 */
export function calculateBookingTotal(nightlyRate, nights, cleaningFee = 0) {
  const subtotal = nightlyRate * nights;
  const total = subtotal + (cleaningFee || 0);
  return {
    nightlyRate,
    nights,
    subtotal,
    cleaningFee: cleaningFee || 0,
    total,
  };
}

/**
 * Calculate number of nights between two dates
 */
export function calculateNights(checkinDate, checkoutDate) {
  const checkin = new Date(checkinDate);
  const checkout = new Date(checkoutDate);
  const diffMs = checkout.getTime() - checkin.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Validate booking dates
 */
export function validateBookingDates(checkinDate, checkoutDate, listing) {
  const errors = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const checkin = new Date(checkinDate);
  const checkout = new Date(checkoutDate);

  if (checkin < today) {
    errors.push('Check-in date cannot be in the past');
  }

  if (checkout <= checkin) {
    errors.push('Check-out date must be after check-in date');
  }

  const nights = calculateNights(checkinDate, checkoutDate);

  if (listing.minimum_stay_months && nights < listing.minimum_stay_months) {
    errors.push(`Minimum stay is ${listing.minimum_stay_months} night${listing.minimum_stay_months !== 1 ? 's' : ''}`);
  }

  if (listing.maximum_stay_months && listing.maximum_stay_months > 0 && nights > listing.maximum_stay_months) {
    errors.push(`Maximum stay is ${listing.maximum_stay_months} night${listing.maximum_stay_months !== 1 ? 's' : ''}`);
  }

  if (listing.available_from && checkin < new Date(listing.available_from)) {
    errors.push(`Property is available from ${listing.available_from}`);
  }

  if (listing.available_until && checkout > new Date(listing.available_until)) {
    errors.push(`Property is available until ${listing.available_until}`);
  }

  // Check blocked dates
  const { blocked, blockedDays } = hasBlockedDates(
    listing.blocked_dates,
    checkinDate,
    checkoutDate
  );

  if (blocked) {
    errors.push(`Some dates are unavailable: ${blockedDays.join(', ')}`);
  }

  return { valid: errors.length === 0, errors, nights };
}

/**
 * Get all booked dates for a listing (for calendar display)
 * Returns array of date strings that are booked or blocked
 */
export async function getUnavailableDates(listingId, blockedDates = []) {
  const { data: bookings } = await supabase
    .from('bookings')
    .select('checkin_date, checkout_date, status')
    .eq('listing_id', listingId)
    .in('status', ['confirmed', 'pending']);

  const unavailable = new Set(blockedDates || []);

  if (bookings) {
    for (const booking of bookings) {
      const current = new Date(booking.checkin_date);
      const end = new Date(booking.checkout_date);
      while (current < end) {
        unavailable.add(current.toISOString().split('T')[0]);
        current.setDate(current.getDate() + 1);
      }
    }
  }

  return Array.from(unavailable).sort();
}

/**
 * Get booking status display info
 */
export function getBookingStatusInfo(status) {
  const statusMap = {
    pending: { label: 'Pending', color: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400', icon: '⏳' },
    confirmed: { label: 'Confirmed', color: 'bg-accent/10 text-accent', icon: '✓' },
    declined: { label: 'Declined', color: 'bg-destructive/10 text-destructive', icon: '✕' },
    cancelled: { label: 'Cancelled', color: 'bg-muted text-muted-foreground', icon: '⊘' },
    completed: { label: 'Completed', color: 'bg-blue-500/10 text-blue-700 dark:text-blue-400', icon: '★' },
    no_show: { label: 'No Show', color: 'bg-destructive/10 text-destructive', icon: '!' },
  };
  return statusMap[status] || statusMap.pending;
}

/**
 * Get cancellation policy display text
 */
export function getCancellationPolicyText(policy) {
  const policyMap = {
    flexible: 'Full refund if cancelled 24 hours before check-in',
    moderate: 'Full refund if cancelled 5 days before check-in',
    strict: '50% refund if cancelled 7 days before check-in',
  };
  return policyMap[policy] || 'Contact host for cancellation terms';
}

/**
 * Format check-in/out time for display
 */
export function formatTime(time24) {
  if (!time24) return '';
  const [h, m] = time24.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${m.toString().padStart(2, '0')} ${ampm}`;
}
