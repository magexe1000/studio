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

let supabaseUrlHost = 'N/A';
try {
  if (supabaseUrl) {
    supabaseUrlHost = new URL(supabaseUrl).host;
  }
} catch (e) {}

let supabaseInitError = 'None';
let supabaseInstance: any = null;

try {
  if (isSupabaseConfigured) {
    supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
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
    });
  } else {
    supabaseInitError = 'Supabase URL/anon key missing';
  }
} catch (e: any) {
  supabaseInitError = e.message || String(e);
}

export const supabase = supabaseInstance;

export function getSupabaseConfigDetails() {
  const anonKeyPrefix = supabaseAnonKey ? supabaseAnonKey.substring(0, 8) : 'N/A';
  const anonKeyLength = supabaseAnonKey ? supabaseAnonKey.length : 0;
  return {
    supabaseUrlConfigured: Boolean(supabaseUrl),
    supabaseUrlHost,
    supabaseAnonKeyConfigured: Boolean(supabaseAnonKey),
    supabaseAnonKeyPrefix: anonKeyPrefix,
    supabaseAnonKeyLength: anonKeyLength,
    supabaseClientReady: Boolean(supabaseInstance),
    supabaseInitError,
    firebaseAuthBridgeReady: Boolean(currentFirebaseToken),
  };
}
