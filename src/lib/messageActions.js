/**
 * messageActions.js — soft-delete helpers for messages and conversations.
 *
 * Behavior: a user "deleting" only hides the item from their own UI.
 * The other party still sees it (Facebook/Instagram style).
 * If either party sends a new message, the conversation reappears for both.
 */
import { supabase } from "@/lib/supabase";

/**
 * Soft-delete a single message for the current user.
 * Appends user.id to messages.deleted_for_users.
 */
export async function softDeleteMessage(messageId, userId) {
  if (!messageId || !userId) return { error: "missing args" };

  // Read current array, then append (Postgres array_append on UPDATE)
  const { data: row, error: readErr } = await supabase
    .from("messages")
    .select("deleted_for_users")
    .eq("id", messageId)
    .single();
  if (readErr) return { error: readErr };

  const current = row?.deleted_for_users || [];
  if (current.includes(userId)) return { data: row };  // already deleted for this user
  const next = [...current, userId];

  const { data, error } = await supabase
    .from("messages")
    .update({ deleted_for_users: next })
    .eq("id", messageId)
    .select()
    .single();
  return { data, error };
}

/**
 * Soft-delete an entire conversation for the current user.
 * Appends user.id to conversations.deleted_for_users.
 * Note: the trigger automatically clears this array when a new message is inserted.
 */
export async function softDeleteConversation(conversationId, userId) {
  if (!conversationId || !userId) return { error: "missing args" };

  const { data: row, error: readErr } = await supabase
    .from("conversations")
    .select("deleted_for_users")
    .eq("id", conversationId)
    .single();
  if (readErr) return { error: readErr };

  const current = row?.deleted_for_users || [];
  if (current.includes(userId)) return { data: row };
  const next = [...current, userId];

  const { data, error } = await supabase
    .from("conversations")
    .update({ deleted_for_users: next })
    .eq("id", conversationId)
    .select()
    .single();
  return { data, error };
}

/**
 * Filter helpers: remove soft-deleted items from a list for the given user.
 */
export function filterVisibleMessages(messages, userId) {
  if (!messages || !userId) return messages || [];
  return messages.filter(m => !(m.deleted_for_users || []).includes(userId));
}

export function filterVisibleConversations(conversations, userId) {
  if (!conversations || !userId) return conversations || [];
  return conversations.filter(c => !(c.deleted_for_users || []).includes(userId));
}
