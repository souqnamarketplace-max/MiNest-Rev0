import { supabase } from "@/lib/supabase";

const STORAGE_KEY = "minest:impersonating";

/**
 * Admin impersonation — lets admins "view as" another user for support.
 *
 * IMPORTANT: This is a VIEW-ONLY simulation. The admin is still logged in as
 * themselves; we just store the target user's ID in localStorage and filter UI.
 * We DO NOT issue a new JWT for the target user (that would be a security risk
 * and requires server-side support). So impersonation shows them what the user
 * sees, but admin actions still happen as the admin.
 *
 * If full impersonation with JWT swap is needed, that requires a dedicated Edge
 * Function with proper safeguards.
 */

/**
 * Get the currently impersonated user (or null if not impersonating).
 */
export function getImpersonation() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Start impersonating a user. Logs to audit log.
 */
export async function startImpersonation(targetUserId, targetEmail, reason = "") {
  const payload = {
    user_id: targetUserId,
    email: targetEmail,
    started_at: new Date().toISOString(),
    reason,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));

  try {
    await supabase.rpc("log_audit", {
      p_entity_type: "user_profile",
      p_entity_id: targetUserId,
      p_action: "impersonate_start",
      p_metadata: { target_email: targetEmail, reason },
    });
  } catch (err) {
    console.warn("Failed to log impersonation start:", err);
  }

  return payload;
}

/**
 * Stop impersonating. Logs to audit log.
 */
export async function stopImpersonation() {
  const current = getImpersonation();
  localStorage.removeItem(STORAGE_KEY);

  if (current) {
    try {
      await supabase.rpc("log_audit", {
        p_entity_type: "user_profile",
        p_entity_id: current.user_id,
        p_action: "impersonate_end",
        p_metadata: { target_email: current.email, duration_ms: Date.now() - new Date(current.started_at).getTime() },
      });
    } catch (err) {
      console.warn("Failed to log impersonation end:", err);
    }
  }
}

/**
 * React hook to listen for impersonation changes.
 */
export function useImpersonation() {
  const [impersonation, setImpersonation] = React.useState(() => getImpersonation());

  React.useEffect(() => {
    const onStorage = () => setImpersonation(getImpersonation());
    window.addEventListener("storage", onStorage);
    // Also poll every second for same-tab changes (localStorage doesn't fire for same tab)
    const interval = setInterval(() => {
      const current = getImpersonation();
      setImpersonation((prev) => {
        if (JSON.stringify(prev) !== JSON.stringify(current)) return current;
        return prev;
      });
    }, 1000);
    return () => {
      window.removeEventListener("storage", onStorage);
      clearInterval(interval);
    };
  }, []);

  return impersonation;
}

// React import for hook
import React from "react";
