/**
 * api/_lib/supabaseAdmin.js — server-side Supabase client.
 *
 * Uses SUPABASE_SERVICE_ROLE_KEY which bypasses RLS. ONLY for use
 * server-side. Never import this from any file in /src/. The
 * service_role key must never reach the browser.
 *
 * Vercel env vars required:
 *   SUPABASE_URL                 https://<project>.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY    eyJ...
 *
 * (The browser-side anon key is VITE_SUPABASE_ANON_KEY and lives in
 * src/lib/supabase.js — do not confuse the two.)
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error(
    "[api/_lib/supabaseAdmin] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing. " +
    "Server-side endpoints that write to the DB will fail."
  );
}

export const supabaseAdmin = url && serviceKey
  ? createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null;
