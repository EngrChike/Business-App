import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Missing Supabase URL or Anon Key. Check your .env file!");
}

// 1. Primary Client (For regular app workflows, tracking the active Admin session)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// 2. 🚀 PERMANENT FIX CLIENT (Strictly for provisioning new staff profiles)
// This engine is completely blind to browser storage and will never overwrite your Admin session.
export const staffCreationClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
    storage: {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
    }
  }
});