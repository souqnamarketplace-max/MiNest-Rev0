/**
 * Conversation system messages — internal "events" rendered as cards in the
 * message thread, distinct from regular text messages.
 *
 * Encoding: a regular `messages` row whose `content` starts with the marker
 * `[[system:<type>:<json>]]`. The MessageThread parses this and renders a
 * styled card instead of a chat bubble. To regular `entities.Message.create`
 * callers it's just text — no schema changes needed.
 *
 * Supported types:
 *   rental_offer_sent       — landlord sent a rental offer (links to agreement)
 *   rental_offer_signed     — tenant signed (links to agreement)
 *   rental_offer_declined   — tenant declined (display only, no link)
 *
 * Payload shape:
 *   { agreement_id, agreement_number?, listing_title? }
 */
import { entities } from "@/api/entities";

export const SYSTEM_MARKER = "[[system:";
const SYSTEM_REGEX = /^\[\[system:([a-z_]+):(.*)\]\]$/s;

/**
 * Detect whether a message is a system message.
 * Cheap — only does a startsWith.
 */
export function isSystemMessage(msg) {
  if (!msg || typeof msg.content !== "string") return false;
  return msg.content.startsWith(SYSTEM_MARKER);
}

/**
 * Parse a system-message content string into { type, payload }.
 * Returns null if not a system message or malformed.
 */
export function parseSystemMessage(msg) {
  if (!isSystemMessage(msg)) return null;
  const m = SYSTEM_REGEX.exec(msg.content);
  if (!m) return null;
  const [, type, jsonStr] = m;
  let payload = {};
  try { payload = JSON.parse(jsonStr); } catch { /* keep empty */ }
  return { type, payload };
}

/**
 * Encode a system event into a string suitable for messages.content.
 */
export function encodeSystemMessage(type, payload) {
  return `${SYSTEM_MARKER}${type}:${JSON.stringify(payload || {})}]]`;
}

/**
 * Insert a system message into a conversation. Best-effort — any failure
 * (e.g. missing conversation_id, RLS) is swallowed so it never blocks the
 * primary action (e.g. sending the offer).
 *
 * Also updates conversation.last_message_text/at so the inbox shows it.
 */
export async function postSystemMessage({ conversationId, senderUserId, type, payload }) {
  if (!conversationId || !senderUserId || !type) return null;
  const content = encodeSystemMessage(type, payload);
  try {
    const created = await entities.Message.create({
      conversation_id: conversationId,
      sender_user_id: senderUserId,
      content,
    });
    // Refresh conversation last_message_at so inbox sorts correctly. Use a
    // friendly preview rather than the raw marker.
    const preview = humanPreview(type, payload);
    try {
      await entities.Conversation.update(conversationId, {
        last_message_text: preview,
        last_message_at: new Date().toISOString(),
      });
    } catch {
      /* non-fatal */
    }
    return created;
  } catch (err) {
    console.warn("[postSystemMessage] failed (non-fatal):", err);
    return null;
  }
}

/**
 * Human-readable preview for inbox display when content is a system marker.
 */
export function humanPreview(type, payload = {}) {
  const num = payload.agreement_number != null
    ? `#${String(payload.agreement_number).padStart(4, "0")}`
    : "";
  switch (type) {
    case "rental_offer_sent":
      return `📄 Rental offer sent ${num}`.trim();
    case "rental_offer_signed":
      return `✅ Rental agreement signed ${num}`.trim();
    case "rental_offer_declined":
      return `❌ Rental offer declined ${num}`.trim();
    case "termination_requested":
      return `⏰ Early termination requested ${num}`.trim();
    case "termination_accepted":
      return `✅ Termination accepted ${num}`.trim();
    case "termination_declined":
      return `↩️ Termination declined ${num}`.trim();
    case "termination_countered":
      return `🔄 Termination counter-offer ${num}`.trim();
    case "agreement_terminated_early":
      return `🏁 Lease terminated early ${num}`.trim();
    default:
      return "System event";
  }
}

/**
 * Find the conversation between two users that's tied to a specific listing.
 * Used so the offer modal can locate the right conversation to post into,
 * even when invoked from a non-conversation entry point (e.g. dashboard).
 */
export async function findConversation({ listingId, userIdA, userIdB }) {
  if (!listingId || !userIdA || !userIdB) return null;
  try {
    const convos = await entities.Conversation.filter(
      { listing_id: listingId, participant_ids: [userIdA] },
      "-updated_at",
      20
    );
    return (convos || []).find(c => (c.participant_ids || []).includes(userIdB)) || null;
  } catch {
    return null;
  }
}
