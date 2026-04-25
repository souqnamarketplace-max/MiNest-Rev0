/**
 * Audit log helper.
 *
 * Writes to the existing public.audit_log table whose deployed schema is:
 *   id, actor_user_id, actor_email, actor_is_admin,
 *   entity_type, entity_id, action, metadata, ip_address, user_agent, created_at
 *
 * The same table is populated by DB-level triggers for listing events
 * (status_change, delete, etc.). This helper covers the application-layer
 * events that triggers can't see (agreement viewed, document opened, etc.).
 *
 * Best-effort logging — every call is wrapped in try/catch so that a logging
 * failure NEVER blocks the user-facing action that triggered it.
 *
 * Public API is intentionally stable across schemas:
 *   logAuditEvent({ action, targetTable, targetId, metadata })
 *
 * Internally we map targetTable -> entity_type and targetId -> entity_id
 * to match the deployed schema. Callers don't need to know about the
 * column rename.
 *
 * Action naming convention: lowercase snake_case. e.g. agreement_signed.
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

// Cache the actor profile (email + is_admin) for the session so we don't
// re-fetch on every audit event. Keyed by user id; reset on auth change is
// not needed because page reloads on logout flush the module.
let _actorCache = null;
async function getActor() {
  if (_actorCache) return _actorCache;
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.id) return null;
    let isAdmin = false;
    try {
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("is_admin")
        .eq("user_id", user.id)
        .maybeSingle();
      isAdmin = !!profile?.is_admin;
    } catch {
      // Non-fatal — leave is_admin as false
    }
    _actorCache = {
      id: user.id,
      email: user.email || null,
      is_admin: isAdmin,
    };
    return _actorCache;
  } catch {
    return null;
  }
}

/**
 * Insert one audit log row. Returns the created row, or null on failure.
 * NEVER throws — caller doesn't need to wrap it.
 *
 * @param {object} args
 * @param {string} args.action       — e.g. 'agreement_signed'
 * @param {string} args.targetTable  — e.g. 'rental_agreements' (mapped to entity_type)
 * @param {string|null} args.targetId — e.g. uuid string (mapped to entity_id)
 * @param {object} args.metadata     — arbitrary JSON
 */
export async function logAuditEvent({ action, targetTable, targetId = null, metadata = {} }) {
  if (!action || !targetTable) {
    if (typeof console !== "undefined") {
      console.warn("[auditLog] missing required fields", { action, targetTable });
    }
    return null;
  }
  try {
    const actor = await getActor();
    if (!actor?.id) return null;
    const ip = await getIp();
    const ua = (typeof navigator !== "undefined" ? navigator.userAgent : null)?.slice(0, 500) || null;
    const { data, error } = await supabase
      .from("audit_log")
      .insert({
        actor_user_id: actor.id,
        actor_email: actor.email,
        actor_is_admin: actor.is_admin,
        entity_type: targetTable,
        // entity_id is text in the deployed schema (not uuid) — coerce to string
        entity_id: targetId != null ? String(targetId) : null,
        action,
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
 * Fetch audit events for a specific target. Maps targetTable/targetId back to
 * entity_type/entity_id for the query. RLS limits visibility.
 */
export async function fetchAuditEventsForTarget({ targetTable, targetId, limit = 200 }) {
  if (!targetTable || !targetId) return [];
  try {
    const { data, error } = await supabase
      .from("audit_log")
      .select("*")
      .eq("entity_type", targetTable)
      .eq("entity_id", String(targetId))
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

// Canonical event names — use these constants so we catch typos at lint time
// and have a single place to rename later.
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
