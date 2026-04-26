/**
 * useProfileCompletion — small hook used by ProfileSetupGuard
 * to detect whether a freshly-signed-in user needs to fill out
 * their profile.
 *
 * "Needs setup" is defined as: the user has no user_profiles row,
 * OR their full_name is empty/whitespace. Other onboarding flags
 * (user_type_intent, etc.) are NOT used here on purpose — they're
 * collected later in onboarding flows. The trigger is just
 * "first sign-in, profile is blank" → redirect to /profile.
 *
 * Returns:
 *   - loading: true until the row has been fetched once
 *   - needsSetup: boolean
 *
 * Caches the answer per session via a module-level Set so we don't
 * re-fetch on every render. The cache busts when the user changes.
 */
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";

// Module-level cache: user_id → boolean (needsSetup).
// Cleared on logout via the user-change effect below.
const completionCache = new Map();

export function useProfileCompletion() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      if (!user?.id) {
        setLoading(false);
        setNeedsSetup(false);
        return;
      }

      // Return cached answer if we've already computed it for this user.
      if (completionCache.has(user.id)) {
        if (!cancelled) {
          setNeedsSetup(completionCache.get(user.id));
          setLoading(false);
        }
        return;
      }

      try {
        const { data, error } = await supabase
          .from("user_profiles")
          .select("full_name")
          .eq("user_id", user.id)
          .maybeSingle();

        if (cancelled) return;

        // No row OR no full_name (or whitespace-only) → needs setup.
        const incomplete = !data || !data.full_name || !data.full_name.trim();
        completionCache.set(user.id, incomplete);
        setNeedsSetup(incomplete);
      } catch (err) {
        // Fail-open: don't trap a user in a redirect loop on a DB blip.
        console.warn("[useProfileCompletion] error (fail-open):", err?.message || err);
        if (!cancelled) setNeedsSetup(false);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    check();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  return { loading, needsSetup };
}

/**
 * Mark a user's profile as "no longer needs setup" without
 * waiting for the next page navigation. Call this from the
 * Profile page when the user successfully saves their profile —
 * it updates the cache so the guard doesn't redirect them again.
 */
export function markProfileSetupComplete(userId) {
  if (!userId) return;
  completionCache.set(userId, false);
}
