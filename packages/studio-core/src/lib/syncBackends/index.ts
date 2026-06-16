import { SyncBackendProvider } from './types';
import { FirebaseFirestoreLegacyProvider } from './firebaseLegacy';
import { SupabaseRealtimeProvider } from './supabaseRealtime';
import { useChordStore } from '../../store/useChordStore';

const providers: Record<string, SyncBackendProvider> = {
  'firebase-firestore-legacy': new FirebaseFirestoreLegacyProvider(),
  'supabase-realtime': new SupabaseRealtimeProvider(),
};

export function getActiveSyncProvider(): SyncBackendProvider {
  const providerKey = useChordStore.getState().settings.syncBackendProvider || 'supabase-realtime';
  return providers[providerKey] || providers['supabase-realtime'];
}

export function getSyncProviderByKey(key: string): SyncBackendProvider {
  return providers[key] || providers['supabase-realtime'];
}

export async function initSyncBackends() {
  for (const p of Object.values(providers)) {
    await p.init().catch(err => console.error(`Failed to init provider ${p.providerName}:`, err));
  }
}

export async function disposeSyncBackends() {
  for (const p of Object.values(providers)) {
    await p.dispose().catch(err => console.error(`Failed to dispose provider ${p.providerName}:`, err));
  }
}
