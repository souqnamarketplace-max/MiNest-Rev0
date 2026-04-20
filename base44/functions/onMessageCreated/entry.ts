/**
 * Triggered by entity automation: Message → create
 * Notifies the other conversation participant of a new message.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// ── Inline notification helper ────────────────────────────────────────────────
const SEEKER_TYPES = new Set(["saved_search_match","new_matching_listing","similar_listing_available","price_drop_on_favorite","favorite_listing_updated","favorite_listing_unavailable","verified_listing_match","strong_profile_match","listing_match"]);
const LISTER_TYPES = new Set(["matching_seeker_available","listing_getting_views_no_messages","listing_expiring_soon","listing_expired","boost_expiring_soon","boost_ended","boost_expired","listing_approved","listing_rejected"]);

function getRoleTarget(type) {
  if (SEEKER_TYPES.has(type)) return "seeker";
  if (LISTER_TYPES.has(type)) return "lister";
  return "shared";
}
function isAllowedForRole(userRole, type) {
  const t = getRoleTarget(type);
  if (t === "shared") return true;
  if (userRole === "both") return true;
  return userRole === t;
}

async function createNotif(base44, userId, type, title, body, { metadata = {}, dedupKey, link } = {}) {
  const profiles = await base44.asServiceRole.entities.UserProfile.filter({ user_id: userId });
  const userRole = profiles[0]?.user_type_intent || "seeker";
  if (!isAllowedForRole(userRole, type)) return null;

  const prefResults = await base44.asServiceRole.entities.NotificationPreference.filter({ user_id: userId });
  const prefs = prefResults[0] || { message_alerts_enabled: true, seeker_alerts_enabled: true, lister_alerts_enabled: true, system_alerts_enabled: true };
  if (["message","new_message","message_request"].includes(type) && !prefs.message_alerts_enabled) return null;

  if (dedupKey) {
    const existing = await base44.asServiceRole.entities.Notification.filter({ user_id: userId, dedup_key: dedupKey });
    if (existing.length > 0) { console.log(`[notif] dedup skip: ${dedupKey}`); return existing[0]; }
  }

  const roleTarget = getRoleTarget(type);
  const resolvedLink = link || (metadata.conversation_id ? `/messages?id=${metadata.conversation_id}` : "/messages");
  const notif = await base44.asServiceRole.entities.Notification.create({
    user_id: userId, type, role_target: roleTarget, title, body,
    link: resolvedLink, read: false, dedup_key: dedupKey || null, metadata,
  });
  console.log(`[notif] created: user=${userId} type=${type} id=${notif.id}`);
  return notif;
}
// ─────────────────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const message = body.data;
    if (!message) return Response.json({ skipped: true, reason: "no message data" });

    const { conversation_id, sender_id, sender_name, text } = message;
    if (!conversation_id || !sender_id) return Response.json({ skipped: true, reason: "missing fields" });

    const convos = await base44.asServiceRole.entities.Conversation.filter({ id: conversation_id });
    const convo = convos[0];
    if (!convo) return Response.json({ skipped: true, reason: "conversation not found" });

    const recipients = (convo.participant_ids || []).filter((p) => p !== sender_id);
    const results = [];

    for (const recipientId of recipients) {
      const r = await createNotif(base44, recipientId, "new_message",
        `New message from ${sender_name || sender_id} on MiNest`,
        convo.listing_title ? `Re: ${convo.listing_title}` : (text?.slice(0, 80) || "You have a new message on MiNest"),
        {
          metadata: { conversation_id, listing_id: convo.listing_id },
          dedupKey: `msg_${conversation_id}_${sender_id}_unread`,
          link: `/messages?id=${conversation_id}`,
        }
      );
      results.push({ recipientId, created: !!r });
    }

    return Response.json({ ok: true, results });
  } catch (error) {
    console.error("[onMessageCreated] error:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});