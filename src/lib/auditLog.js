/**
 * Audit log helper — write-only insert into public.audit_log. Reading
 * is admin-RLS-gated; do NOT chain `.select()` after the insert or the
 * call appears to fail with a misleading "RLS violation" error.
 *
 * Schema (public.audit_log):
 *   actor_user_id, actor_email, actor_is_admin,
 *   entity_type, entity_id, action,
 *   metadata, ip_address, user_agent, created_at
 *
 * NOTE: callers pass `targetTable` / `targetId` for legacy-readability
 * reasons; we map those to entity_type / entity_id at insert time.
 */

import { supabase } from "@/lib/supabase";

let cachedActor = null;

async function resolveActor() {
  if (cachedActor) return cachedActor;
  try {
    const { data } = await supabase.auth.getUser();
    const u = data?.user;
    if (!u) return null;
    let isAdmin = false;
    try {
      const { data: prof } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", u.id)
        .maybeSingle();
      isAdmin = !!prof?.is_admin;
    } catch {
      /* non-fatal */
    }
    cachedActor = { id: u.id, email: u.email || null, isAdmin };
    return cachedActor;
  } catch {
    return null;
  }
}

/**
 * Best-effort fetch of the client's public IP. Cached for the session.
 */
let cachedIp = null;
async function getClientIp() {
  if (cachedIp) return cachedIp;
  try {
    const r = await fetch("https://api.ipify.org?format=json");
    const j = await r.json();
    cachedIp = j?.ip || null;
  } catch {
    cachedIp = null;
  }
  return cachedIp;
}

/**
 * Write a single audit event. All inserts are write-only; we never
 * chain .select() because admin-only SELECT RLS will trip.
 */
export async function logAuditEvent({ action, targetTable, targetId, metadata }) {
  if (!action) return;
  try {
    const actor = await resolveActor();
    const ip = await getClientIp();
    const ua =
      typeof navigator !== "undefined"
        ? navigator.userAgent?.slice(0, 500) || null
        : null;
    await supabase.from("audit_log").insert({
      actor_user_id: actor?.id || null,
      actor_email: actor?.email || null,
      actor_is_admin: actor?.isAdmin || false,
      entity_type: targetTable || null,
      entity_id: targetId || null,
      action,
      metadata: metadata || {},
      ip_address: ip,
      user_agent: ua,
    });
  } catch (err) {
    // Never block the parent action because of audit failures.
    console.warn("[auditLog] insert failed (non-fatal):", err);
  }
}

/**
 * Canonical event names. Always reference these constants — typos in
 * action strings make later querying very painful.
 */
export const AuditEvents = Object.freeze({
  // Listings
  LISTING_CREATED:    "listing_created",
  LISTING_UPDATED:    "listing_updated",
  LISTING_DELETED:    "listing_deleted",
  // Documents
  DOCUMENT_UPLOADED:  "document_uploaded",
  DOCUMENT_VIEWED:    "document_viewed",
  DOCUMENT_DELETED:   "document_deleted",
  // Rental agreements (lifecycle)
  AGREEMENT_CREATED:  "agreement_created",
  AGREEMENT_UPDATED:  "agreement_updated",
  AGREEMENT_SIGNED_BY_LANDLORD: "agreement_signed_by_landlord",
  AGREEMENT_SIGNED_BY_TENANT:   "agreement_signed_by_tenant",
  AGREEMENT_DECLINED: "agreement_declined",
  AGREEMENT_CANCELED: "agreement_canceled",
  // Termination
  TERMINATION_REQUESTED: "termination_requested",
  TERMINATION_ACCEPTED:  "termination_accepted",
  TERMINATION_DECLINED:  "termination_declined",
  TERMINATION_COUNTERED: "termination_countered",
  TERMINATION_SIGNED:    "termination_signed",
  TERMINATION_CANCELED:  "termination_canceled",
  AGREEMENT_TERMINATED_EARLY: "agreement_terminated_early",
  // Renewal
  RENEWAL_OFFERED:    "renewal_offered",
  RENEWAL_ACCEPTED:   "renewal_accepted",
  RENEWAL_DECLINED:   "renewal_declined",
  RENEWAL_COUNTERED:  "renewal_countered",
  RENEWAL_CANCELED:   "renewal_canceled",
  RENEWAL_COMPLETED:  "renewal_completed",
  // Legacy compat
  RENEWAL_SENT:       "renewal_sent",
});
