import { createClient } from '@supabase/supabase-js';

// Server-side Supabase client — bypasses RLS
// Requires SUPABASE_SERVICE_ROLE_KEY in Vercel env vars (never expose to browser)
export function getServiceClient() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || key === 'your-service-role-key-here') {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY not configured. Set it in Vercel environment variables.');
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

// Verify user JWT from Authorization header
export async function getAuthUser(req) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return null;
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  const supabase = createClient(url, anonKey, { auth: { persistSession: false } });
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error) return null;
  return user ?? null;
}
