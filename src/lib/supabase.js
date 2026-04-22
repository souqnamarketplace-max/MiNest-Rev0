import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase env vars. Check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local');
}

// Safari / Incognito fallback: use in-memory storage if localStorage is blocked
const memoryStorage = {};
const safeStorage = {
  getItem: (key) => {
    try { return localStorage.getItem(key); }
    catch { return memoryStorage[key] ?? null; }
  },
  setItem: (key, value) => {
    try { localStorage.setItem(key, value); }
    catch { memoryStorage[key] = value; }
  },
  removeItem: (key) => {
    try { localStorage.removeItem(key); }
    catch { delete memoryStorage[key]; }
  },
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'minest-auth-token',
    storage: safeStorage,
    // Use implicit flow for broader Safari/Incognito compatibility
    // PKCE requires localStorage for code_verifier which can fail in restricted environments
    flowType: 'implicit',
    lock: async (name, acquireTimeout, fn) => {
      return await fn();
    },
  },
});
