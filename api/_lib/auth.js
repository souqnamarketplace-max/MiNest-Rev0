/**
 * api/_lib/auth.js — extract and verify the calling user from the
 * Authorization header.
 *
 * The frontend sends `Authorization: Bearer <supabase access_token>`.
 * We validate the token by calling supabase.auth.getUser(token) — if
 * it returns a user, the token is valid. Otherwise, return null.
 *
 * Returns { user, error }. Endpoints should:
 *   - call requireUser(req) at the top
 *   - return 401 if user is null
 *   - use user.id for any DB writes (NEVER trust client-provided user_id)
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;

// Use the anon-key client for token verification — service_role would
// bypass auth checks entirely. The anon client validates tokens against
// Supabase Auth.
const authClient = url && anonKey
  ? createClient(url, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null;

/**
 * @param {Request|{headers:any}} req — Vercel request object
 * @returns {Promise<{user: object|null, error: string|null}>}
 */
export async function requireUser(req) {
  if (!authClient) {
    return { user: null, error: "Auth client not configured (missing SUPABASE_URL / SUPABASE_ANON_KEY)" };
  }

  const authHeader =
    typeof req.headers.get === "function"
      ? req.headers.get("authorization")
      : req.headers.authorization || req.headers.Authorization;

  if (!authHeader) {
    return { user: null, error: "Missing Authorization header" };
  }

  const match = /^Bearer\s+(.+)$/i.exec(authHeader);
  if (!match) {
    return { user: null, error: "Authorization header must be 'Bearer <token>'" };
  }

  const token = match[1];
  const { data, error } = await authClient.auth.getUser(token);

  if (error || !data?.user) {
    return { user: null, error: error?.message || "Invalid or expired token" };
  }

  return { user: data.user, error: null };
}

/**
 * Helper to send a JSON response. Works with both Vercel Edge and
 * Node runtime (we use Node here for Stripe SDK compatibility).
 */
export function json(res, status, body) {
  if (typeof res.status === "function") {
    return res.status(status).json(body);
  }
  // Edge runtime fallback
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
