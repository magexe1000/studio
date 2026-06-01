/**
 * Per-app sync key. Lives in its own tiny module so it can be imported
 * by both `sync.ts` and any future helper without creating a cycle.
 */
export type SyncAppKey = 'chordex' | 'drumex' | 'drumexUI' | 'stagex' | 'vocalex-takes' | 'vocalex-lab' | 'profile' | 'profile-cover';
