import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim();
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

let currentFirebaseToken: string | null = null;

export function setFirebaseIdToken(token: string | null) {
  currentFirebaseToken = token;
}

export function getFirebaseIdToken() {
  return currentFirebaseToken;
}

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      global: {
        headers: {
          get Authorization() {
            return currentFirebaseToken ? `Bearer ${currentFirebaseToken}` : '';
          },
        },
      },
    })
  : null;

export function getSupabaseConfigDetails() {
  return {
    supabaseUrlConfigured: Boolean(supabaseUrl),
    supabaseAnonKeyConfigured: Boolean(supabaseAnonKey),
    supabaseClientReady: Boolean(supabase),
    firebaseAuthBridgeReady: Boolean(currentFirebaseToken),
  };
}
