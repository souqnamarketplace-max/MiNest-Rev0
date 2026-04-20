/**
 * MiNest Notification Service
 * Replaces base44.entities.Notification with entities.Notification
 */
import { entities } from '@/api/entities';

const SEEKER_TYPES = new Set([
  'saved_search_match','new_matching_listing','similar_listing_available',
  'price_drop_on_favorite','favorite_listing_updated','verified_listing_match',
  'strong_profile_match','listing_match',
]);
const LISTER_TYPES = new Set([
  'matching_seeker_available','listing_getting_views_no_messages','listing_expiring_soon',
  'listing_expired','boost_expiring_soon','boost_ended','boost_expired',
  'listing_approved','listing_rejected',
]);
const SHARED_TYPES = new Set([
  'message','new_message','message_request','verification_completed',
  'security_alert','system','viewing_requested','viewing_confirmed',
  'viewing_declined','viewing_canceled','rental_offer_received',
  'rental_offer_accepted','rental_offer_declined','payment_received',
  'payment_failed','payment_due','deposit_refunded',
]);

export async function createNotification({ user_id, type, title, body, data = {}, role_target = 'shared' }) {
  if (!user_id || !type) return null;
  try {
    return await entities.Notification.create({
      user_id,
      type,
      title,
      body,
      data,
      role_target,
      read: false,
    });
  } catch (err) {
    console.error('[notificationService] Failed to create notification:', err);
    return null;
  }
}

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
