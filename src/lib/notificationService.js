/**
 * MiNest Notification Service
 * Centralized notification helpers for all app events.
 * All functions are fire-and-forget — they never throw or block the caller.
 */
import { entities } from '@/api/entities';
import { supabase } from '@/lib/supabase';

// ─── Core create function ───────────────────────────────────────────────────

export async function createNotification({ user_id, type, title, body, data = {}, role_target = 'shared' }) {
  if (!user_id || !type) return null;
  try {
    return await entities.Notification.create({
      user_id, type, title, body, data, role_target, read: false,
    });
  } catch (err) {
    console.error('[notificationService] Failed to create notification:', err);
    return null;
  }
}

// ─── Admin notification helper ──────────────────────────────────────────────
// Sends a notification to ALL admin users (fire-and-forget)

async function getAdminUserIds() {
  try {
    const { data } = await supabase
      .from('user_profiles')
      .select('user_id')
      .eq('is_admin', true);
    return (data || []).map(d => d.user_id);
  } catch {
    return [];
  }
}

async function notifyAdmins({ type, title, body, data = {} }) {
  const adminIds = await getAdminUserIds();
  for (const adminId of adminIds) {
    createNotification({ user_id: adminId, type, title, body, data, role_target: 'admin' });
  }
}

// ─── Mark read helpers ──────────────────────────────────────────────────────

export async function markNotificationRead(notificationId) {
  try {
    return await entities.Notification.update(notificationId, { read: true });
  } catch (err) {
    console.error('[notificationService] Failed to mark read:', err);
  }
}

export async function markAllRead(userId) {
  try {
    const unread = await entities.Notification.filter({ user_id: userId, read: false });
    await Promise.all(unread.map(n => entities.Notification.update(n.id, { read: true })));
  } catch (err) {
    console.error('[notificationService] Failed to mark all read:', err);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// LISTING NOTIFICATIONS
// ═══════════════════════════════════════════════════════════════════════════

/** New listing created — notify admin for moderation */
export function notifyListingCreated({ listingTitle, listingId, ownerName }) {
  notifyAdmins({
    type: 'new_listing_pending',
    title: '📋 New Listing Pending Review',
    body: `"${listingTitle}" posted by ${ownerName || 'a user'} needs review.`,
    data: { link: '/admin?tab=moderation', listing_id: listingId },
  });
}

/** Listing approved by admin — notify owner */
export function notifyListingApproved({ ownerId, listingTitle, listingSlug }) {
  createNotification({
    user_id: ownerId,
    type: 'listing_approved',
    title: '✅ Listing Approved',
    body: `Your listing "${listingTitle}" is now live and visible to renters.`,
    data: { link: `/listing/${listingSlug}` },
    role_target: 'lister',
  });
}

/** Listing rejected by admin — notify owner */
export function notifyListingRejected({ ownerId, listingTitle, reason }) {
  createNotification({
    user_id: ownerId,
    type: 'listing_rejected',
    title: '❌ Listing Not Approved',
    body: `Your listing "${listingTitle}" was not approved. ${reason || 'Please review our guidelines.'}`,
    data: { link: '/dashboard' },
    role_target: 'lister',
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// MESSAGE NOTIFICATIONS
// ═══════════════════════════════════════════════════════════════════════════

/** New message received */
export function notifyNewMessage({ recipientId, senderName, messagePreview, conversationId }) {
  createNotification({
    user_id: recipientId,
    type: 'new_message',
    title: `💬 New message from ${senderName || 'someone'}`,
    body: messagePreview ? messagePreview.slice(0, 100) : 'You have a new message.',
    data: { link: `/messages?conversation=${conversationId}`, conversation_id: conversationId },
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// VIEWING NOTIFICATIONS
// ═══════════════════════════════════════════════════════════════════════════

/** Viewing requested — notify listing owner */
export function notifyViewingRequested({ ownerId, viewerName, listingTitle, listingSlug, date }) {
  createNotification({
    user_id: ownerId,
    type: 'viewing_requested',
    title: '👀 Viewing Request',
    body: `${viewerName || 'Someone'} wants to view "${listingTitle}" on ${date || 'a requested date'}.`,
    data: { link: '/dashboard?tab=viewings' },
    role_target: 'lister',
  });
}

/** Viewing confirmed — notify viewer */
export function notifyViewingConfirmed({ viewerId, listingTitle, date }) {
  createNotification({
    user_id: viewerId,
    type: 'viewing_confirmed',
    title: '✅ Viewing Confirmed',
    body: `Your viewing for "${listingTitle}" on ${date || 'the requested date'} has been confirmed.`,
    data: { link: '/my-viewings' },
  });
}

/** Viewing declined — notify viewer */
export function notifyViewingDeclined({ viewerId, listingTitle, reason }) {
  createNotification({
    user_id: viewerId,
    type: 'viewing_declined',
    title: '❌ Viewing Declined',
    body: `Your viewing request for "${listingTitle}" was declined. ${reason || ''}`.trim(),
    data: { link: '/my-viewings' },
  });
}

/** Viewing cancelled — notify the other party */
export function notifyViewingCancelled({ recipientId, cancelledBy, listingTitle }) {
  createNotification({
    user_id: recipientId,
    type: 'viewing_canceled',
    title: '🚫 Viewing Cancelled',
    body: `${cancelledBy || 'The other party'} cancelled the viewing for "${listingTitle}".`,
    data: { link: '/my-viewings' },
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// BOOKING NOTIFICATIONS (daily rentals)
// ═══════════════════════════════════════════════════════════════════════════

/** Booking requested — notify listing owner */
export function notifyBookingRequested({ ownerId, guestName, listingTitle, checkIn, checkOut }) {
  createNotification({
    user_id: ownerId,
    type: 'booking_requested',
    title: '📅 New Booking Request',
    body: `${guestName || 'A guest'} wants to book "${listingTitle}" from ${checkIn} to ${checkOut}.`,
    data: { link: '/dashboard?tab=bookings' },
    role_target: 'lister',
  });
}

/** Booking confirmed — notify guest */
export function notifyBookingConfirmed({ guestId, listingTitle, checkIn }) {
  createNotification({
    user_id: guestId,
    type: 'booking_confirmed',
    title: '✅ Booking Confirmed',
    body: `Your booking for "${listingTitle}" starting ${checkIn} has been confirmed!`,
    data: { link: '/my-bookings' },
  });
}

/** Booking declined — notify guest */
export function notifyBookingDeclined({ guestId, listingTitle }) {
  createNotification({
    user_id: guestId,
    type: 'booking_declined',
    title: '❌ Booking Declined',
    body: `Your booking request for "${listingTitle}" was not accepted.`,
    data: { link: '/my-bookings' },
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// REPORT NOTIFICATIONS
// ═══════════════════════════════════════════════════════════════════════════

/** Report filed — notify admin */
export function notifyReportFiled({ reporterName, targetType, reason }) {
  notifyAdmins({
    type: 'new_report',
    title: '🚩 New Report Filed',
    body: `${reporterName || 'A user'} reported a ${targetType || 'content'}: ${reason || 'No reason given'}.`,
    data: { link: '/admin?tab=reports' },
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// VERIFICATION NOTIFICATIONS
// ═══════════════════════════════════════════════════════════════════════════

/** Verification submitted — notify admin */
export function notifyVerificationSubmitted({ userName, verificationType }) {
  notifyAdmins({
    type: 'verification_submitted',
    title: '🔍 New Verification Pending',
    body: `${userName || 'A user'} submitted ${verificationType || 'identity'} verification for review.`,
    data: { link: '/admin?tab=verification' },
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// RENTAL AGREEMENT NOTIFICATIONS
// ═══════════════════════════════════════════════════════════════════════════

/** Rental request sent — notify listing owner (already exists, keeping for reference) */
export function notifyRentalRequest({ ownerId, tenantName, listingTitle }) {
  createNotification({
    user_id: ownerId,
    type: 'rental_request',
    title: '📋 New Rental Request',
    body: `${tenantName || 'A tenant'} has sent a rental request for "${listingTitle}".`,
    data: { link: '/dashboard?tab=rentals' },
    role_target: 'lister',
  });
}

/** Rental offer sent — notify tenant (already exists, keeping for reference) */
export function notifyRentalOffer({ tenantId, listingTitle }) {
  createNotification({
    user_id: tenantId,
    type: 'rental_offer',
    title: '🏠 New Rental Offer',
    body: `You have received a rental offer for "${listingTitle}".`,
    data: { link: '/my-payments' },
  });
}

/** Rental agreement signed — notify owner */
export function notifyAgreementSigned({ ownerId, listingTitle }) {
  createNotification({
    user_id: ownerId,
    type: 'agreement_signed',
    title: '✍️ Agreement Signed',
    body: `The rental agreement for "${listingTitle}" has been signed by the tenant.`,
    data: { link: '/dashboard?tab=rentals' },
    role_target: 'lister',
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// PAYMENT NOTIFICATIONS
// ═══════════════════════════════════════════════════════════════════════════

/** Payment dispute opened — notify admin */
export function notifyDisputeOpened({ disputeId, userName, amount }) {
  notifyAdmins({
    type: 'payment_dispute',
    title: '⚠️ Payment Dispute Opened',
    body: `${userName || 'A user'} opened a dispute${amount ? ` for $${amount}` : ''}.`,
    data: { link: '/admin?tab=payments', dispute_id: disputeId },
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// CONTACT/SUPPORT NOTIFICATIONS
// ═══════════════════════════════════════════════════════════════════════════

/** Contact form submitted — notify admin */
export function notifyContactSubmitted({ senderName, subject }) {
  notifyAdmins({
    type: 'support_request',
    title: '📩 New Support Request',
    body: `${senderName || 'A user'} submitted: "${subject || 'No subject'}"`,
    data: { link: '/admin?tab=support' },
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// FAVORITE NOTIFICATIONS
// ═══════════════════════════════════════════════════════════════════════════

/** Someone favorited your listing — notify owner */
export function notifyListingFavorited({ ownerId, listingTitle }) {
  createNotification({
    user_id: ownerId,
    type: 'listing_favorited',
    title: '❤️ Someone saved your listing',
    body: `Your listing "${listingTitle}" was saved to someone's favorites.`,
    data: { link: '/dashboard' },
    role_target: 'lister',
  });
}
