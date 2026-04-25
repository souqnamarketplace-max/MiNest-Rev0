/**
 * Audit log helper.
 *
 * Best-effort logging — every call is wrapped in try/catch so that a logging
 * failure NEVER blocks the user-facing action that triggered it. We keep the
 * surface tiny on purpose so callers can sprinkle log() calls anywhere.
 *
 * Usage:
 *   await logAuditEvent({
 *     action: 'agreement_signed',
 *     targetTable: 'rental_agreements',
 *     targetId: agreement.id,
 *     metadata: { role: 'tenant', agreement_number: 1 },
 *   });
 *
 * The actor (auth.uid) is set automatically from the active session.
 * IP address is fetched best-effort from the same endpoint we use for
 * signature audit (httpbin / ipify); failure leaves it null.
 *
 * Action naming convention: lowercase snake_case, past-tense verb for things
 * that happened (agreement_signed) and present-tense for things that are
 * happening as the user performs them (document_viewed). Consistency over
 * time matters more than perfect grammar.
 */
import { supabase } from "@/lib/supabase";

let _ipCache = null;
async function getIp() {
  if (_ipCache) return _ipCache;
  try {
    const res = await fetch("https://api.ipify.org?format=json", { cache: "no-store" });
    if (!res.ok) return null;
    const data = await res.json();
    _ipCache = data?.ip || null;
    return _ipCache;
  } catch {
    return null;
  }
}

/**
 * Insert one audit log row. Returns the created row, or null on failure.
 * NEVER throws — caller doesn't need to wrap it.
 */
export async function logAuditEvent({ action, targetTable, targetId = null, metadata = {} }) {
  if (!action || !targetTable) {
    if (typeof console !== "undefined") {
      console.warn("[auditLog] missing required fields", { action, targetTable });
    }
    return null;
  }
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.id) return null;
    const ip = await getIp();
    const ua = (typeof navigator !== "undefined" ? navigator.userAgent : null)?.slice(0, 500) || null;
    const { data, error } = await supabase
      .from("audit_log")
      .insert({
        actor_user_id: user.id,
        action,
        target_table: targetTable,
        target_id: targetId,
        metadata: metadata || {},
        ip_address: ip,
        user_agent: ua,
      })
      .select()
      .single();
    if (error) {
      console.warn("[auditLog] insert failed (non-fatal):", error.message);
      return null;
    }
    return data;
  } catch (err) {
    console.warn("[auditLog] threw (non-fatal):", err?.message || err);
    return null;
  }
}

/**
 * Fetch audit events for a specific target (e.g. an agreement). Returns up to
 * `limit` rows, newest first. RLS will filter to events the caller is allowed
 * to see (admin, actor, or party to the agreement).
 */
export async function fetchAuditEventsForTarget({ targetTable, targetId, limit = 200 }) {
  if (!targetTable || !targetId) return [];
  try {
    const { data, error } = await supabase
      .from("audit_log")
      .select("*")
      .eq("target_table", targetTable)
      .eq("target_id", targetId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) {
      console.warn("[auditLog] fetch failed:", error.message);
      return [];
    }
    return data || [];
  } catch (err) {
    console.warn("[auditLog] fetch threw:", err?.message || err);
    return [];
  }
}

// Canonical event names — use these constants, not raw strings, so we catch
// typos at lint time and have a single place to rename later.
export const AuditEvents = Object.freeze({
  AGREEMENT_CREATED:  "agreement_created",
  AGREEMENT_SIGNED:   "agreement_signed",
  AGREEMENT_DECLINED: "agreement_declined",
  AGREEMENT_VIEWED:   "agreement_viewed",
  DOCUMENT_UPLOADED:  "document_uploaded",
  DOCUMENT_VIEWED:    "document_viewed",
  DOCUMENT_APPROVED:  "document_approved",
  DOCUMENT_REJECTED:  "document_rejected",
  TERMINATION_REQUESTED: "termination_requested",
  TERMINATION_ACCEPTED:  "termination_accepted",
  RENEWAL_SENT:       "renewal_sent",
});
