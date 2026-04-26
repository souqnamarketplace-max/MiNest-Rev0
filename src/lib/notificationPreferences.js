/**
 * notificationPreferences.js — gate for in-app + push notifications.
 *
 * Used by every site that calls `entities.Notification.create(...)`:
 *   if (await shouldNotify(userId, type)) { ...insert notification... }
 *
 * Design:
 * - Maps notification type strings → a preference column on
 *   public.notification_preferences (push_messages, push_rentals,
 *   push_listings, push_saved_searches, push_marketing).
 * - CRITICAL types are never gated: account security, signed legal
 *   documents, payment events, admin alerts. These always send.
 * - Respects quiet_hours: when enabled and we're inside the window,
 *   suppress non-critical types. (Critical types still go through.)
 * - Fail-open: if the DB read fails, return true. Better to deliver
 *   a notification than silently lose one. A user can always toggle.
 *
 * No external dependencies beyond the supabase client. Pure helper.
 */
import { supabase } from "@/lib/supabase";

// ─── Type → preference column mapping ─────────────────────────────
//
// Anything NOT mapped here that isn't in CRITICAL_TYPES is treated
// as critical and sent. Better to send an unmapped notification
// than to silently drop it.

const MESSAGE_TYPES = new Set([
  "new_message",
  "message_request",
]);

const RENTAL_TYPES = new Set([
  "rental_offer",
  "renewal_offered",
  "renewal_countered",
  "renewal_declined",
  "renewal_canceled",
  "termination_requested",
  "termination_countered",
  "termination_declined",
  "termination_canceled",
  "termination_signed_one_side",
  // NOTE: renewal_accepted, termination_accepted, agreement_terminated_early,
  // agreement_signed are CRITICAL — see below. Not in this set.
]);

const LISTING_TYPES = new Set([
  "new_inquiry",
  "viewing_request",
  "viewing_confirmed",
  "viewing_canceled",
  "booking_request",
  "booking_declined",
  // Listing approved/rejected are admin actions on the user's content
  // — important enough that we treat them as listing-class but still
  // suppressible. Admins still get THEIR notifications via
  // new_listing_pending which is critical (admin-bound).
  "listing_approved",
  "listing_rejected",
  "listing_expiring_soon",
  "favorite_listing_updated",
  "similar_listing_available",
]);

const SAVED_SEARCH_TYPES = new Set([
  "saved_search_match",
]);

const MARKETING_TYPES = new Set([
  "marketing_promo",
  "promo",
  "newsletter",
]);

// ─── Critical types — never gated, never suppressed by quiet hours ─
//
// These are events the user MUST see regardless of preferences:
// completed legal/financial actions, account security, admin alerts.

const CRITICAL_TYPES = new Set([
  // Completed rental events — money/legal consequences
  "renewal_accepted",
  "termination_accepted",
  "agreement_signed",
  "agreement_countersigned",
  "agreement_terminated_early",

  // Payment events — money matters
  "payment_received",
  "payment_failed",
  "payment_due",
  "payment_overdue",
  "refund_issued",

  // Account security — must always reach the user
  "account_security",
  "password_changed",
  "login_alert",
  "verification_completed",
  "email_changed",

  // Admin-bound notifications (the user_id IS an admin)
  "new_listing_pending",
  "support_request",
  "new_report",
  "signup_admin_alert",
]);

/**
 * Map a notification type to its preference column, or null if the
 * type is critical / unrecognized (in which case it always sends).
 */
function prefColumnFor(type) {
  if (CRITICAL_TYPES.has(type)) return null;
  if (MESSAGE_TYPES.has(type)) return "push_messages";
  if (RENTAL_TYPES.has(type)) return "push_rentals";
  if (LISTING_TYPES.has(type)) return "push_listings";
  if (SAVED_SEARCH_TYPES.has(type)) return "push_saved_searches";
  if (MARKETING_TYPES.has(type)) return "push_marketing";
  // Unmapped types — be conservative and always send.
  return null;
}

/**
 * Quiet-hours bypass list: types so urgent that even quiet hours
 * cannot suppress them. Roughly equivalent to CRITICAL_TYPES, plus
 * by definition all critical types bypass anyway since they're never
 * gated. Listed here for clarity.
 */
function bypassesQuietHours(type) {
  return CRITICAL_TYPES.has(type);
}

/**
 * Is the current local time within the user's quiet-hours window?
 * Window may wrap midnight (e.g. 22:00 → 08:00).
 *
 * NOTE: We use the BROWSER's local time, which is the user's local
 * time when the notification is being decided server-side... except
 * we're calling this client-side from the actor's browser, not the
 * recipient's. This is a known limitation: quiet hours are evaluated
 * against the ACTOR's clock, not the RECIPIENT's. For a real fix,
 * push the gating into a server-side notify endpoint that evaluates
 * against the recipient's stored timezone. For now, "good enough"
 * given most users are in nearby timezones.
 */
function withinQuietHours(prefs) {
  if (!prefs?.quiet_hours_enabled) return false;
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const cur = `${hh}:${mm}:00`;
  const start = (prefs.quiet_hours_start || "22:00").slice(0, 8).padEnd(8, ":00");
  const end = (prefs.quiet_hours_end || "08:00").slice(0, 8).padEnd(8, ":00");
  if (start <= end) {
    // same-day window, e.g. 13:00 → 18:00
    return cur >= start && cur < end;
  }
  // wrap-around window, e.g. 22:00 → 08:00
  return cur >= start || cur < end;
}

/**
 * Should we deliver an in-app notification of this type to this user?
 *
 * @param {string} userId — recipient
 * @param {string} type   — notification type string
 * @returns {Promise<boolean>}
 */
export async function shouldNotify(userId, type) {
  if (!userId || !type) return true; // fail-open

  const column = prefColumnFor(type);

  // Critical or unmapped → always send.
  if (column === null) return true;

  let prefs;
  try {
    const { data, error } = await supabase
      .from("notification_preferences")
      .select(
        "push_messages, push_rentals, push_listings, push_saved_searches, push_marketing, quiet_hours_enabled, quiet_hours_start, quiet_hours_end"
      )
      .eq("user_id", userId)
      .maybeSingle();
    if (error) {
      console.warn("[shouldNotify] DB error (fail-open):", error.message);
      return true;
    }
    prefs = data;
  } catch (err) {
    console.warn("[shouldNotify] exception (fail-open):", err?.message || err);
    return true;
  }

  // Row should exist via the auth.users trigger, but if a user predates
  // the trigger and somehow missed the backfill, fail open.
  if (!prefs) return true;

  // Category toggle off → suppress.
  if (prefs[column] === false) return false;

  // Quiet hours → suppress non-critical types.
  if (!bypassesQuietHours(type) && withinQuietHours(prefs)) return false;

  return true;
}

/**
 * Read the full preferences object for the current user.
 * Used by the settings UI on mount.
 */
export async function getMyPreferences(userId) {
  if (!userId) return null;
  const { data, error } = await supabase
    .from("notification_preferences")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    console.warn("[getMyPreferences] error:", error.message);
    return null;
  }
  return data;
}

/**
 * Write a partial update to the current user's preferences.
 *
 * @param {string} userId
 * @param {object} patch — subset of columns to update
 * @returns {Promise<object|null>} updated row, or null on failure
 */
export async function updateMyPreferences(userId, patch) {
  if (!userId || !patch) return null;

  // Whitelist columns the UI is allowed to touch.
  const allowed = [
    "push_messages",
    "push_rentals",
    "push_listings",
    "push_saved_searches",
    "push_marketing",
    "quiet_hours_enabled",
    "quiet_hours_start",
    "quiet_hours_end",
  ];
  const safe = {};
  for (const key of allowed) {
    if (key in patch) safe[key] = patch[key];
  }
  if (Object.keys(safe).length === 0) return null;

  const { data, error } = await supabase
    .from("notification_preferences")
    .update(safe)
    .eq("user_id", userId)
    .select()
    .maybeSingle();
  if (error) {
    console.error("[updateMyPreferences] error:", error.message);
    return null;
  }
  return data;
}
