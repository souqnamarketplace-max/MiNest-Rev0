/**
 * Conversation system messages — encodes/decodes structured "system"
 * events that get posted into a conversation as a special message,
 * plus a friendly preview for the inbox.
 *
 * A system message is stored as a JSON-encoded string in
 * messages.content with the marker prefix `__system__:` so it can be
 * round-tripped from a normal text message.
 *
 *   content: `__system__:${JSON.stringify({ type, payload })}`
 *
 * The MessageThread component recognizes this prefix and renders a
 * card variant instead of a chat bubble.
 */

import { entities } from "@/api/entities";

const MARKER = "__system__:";

export function encodeSystemMessage(type, payload = {}) {
  return `${MARKER}${JSON.stringify({ type, payload })}`;
}

export function isSystemMessage(content) {
  return typeof content === "string" && content.startsWith(MARKER);
}

export function parseSystemMessage(content) {
  if (!isSystemMessage(content)) return null;
  try {
    return JSON.parse(content.slice(MARKER.length));
  } catch {
    return null;
  }
}

/**
 * Post a system message into a conversation. Best-effort — wraps the
 * actual create + the conversation last_message bump, swallowing any
 * non-fatal errors (the action that triggered this should never fail
 * on a system-message hiccup).
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
  const num =
    payload.agreement_number != null
      ? `#${String(payload.agreement_number).padStart(4, "0")}`
      : "";
  switch (type) {
    case "rental_offer_sent":
      return `📄 Rental offer sent ${num}`.trim();
    case "rental_offer_signed":
      return `✅ Rental agreement signed ${num}`.trim();
    case "rental_offer_declined":
      return `❌ Rental offer declined ${num}`.trim();
    // Termination
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
    // Renewal
    case "renewal_offered":
      return `🔁 Renewal offered ${num}`.trim();
    case "renewal_accepted":
      return `✅ Renewal accepted ${num}`.trim();
    case "renewal_declined":
      return `↩️ Renewal declined ${num}`.trim();
    case "renewal_countered":
      return `🔄 Renewal counter-offer ${num}`.trim();
    case "renewal_completed":
      return `🎉 Lease renewed ${num}`.trim();
    default:
      return "System event";
  }
}

/**
 * Find the conversation between two users that's tied to a specific listing.
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
