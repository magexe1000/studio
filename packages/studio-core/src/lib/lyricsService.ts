import { type SongChartSection, type LyricsLine } from '../data/songs';

export interface SyncedLine {
  text: string;
  timestamp: number; // in ms
  duration?: number;  // in ms
}

export interface LyricsResult {
  provider: string;
  sourceId: string;
  title: string;
  artist: string;
  plainLyrics: string;
  syncedLines: SyncedLine[];
  language?: string;
  duration?: number;
  confidence: number;
  sourceMetadata?: any;
  fetchedAt: number;
}

export interface LyricsProvider {
  id: string;
  name: string;
  enabled: boolean;
  priority: number;
  supportsPlainLyrics: boolean;
  supportsSyncedLyrics: boolean;
  searchLyrics(title: string, artist: string, duration?: number): Promise<LyricsResult[]>;
}

// ── SIMILARITY HELPERS ───────────────────────────────────────
function cleanString(str: string): string {
  return (str || '').toLowerCase().replace(/[^\w\s]/g, '').trim();
}

export function getSimilarity(s1: string, s2: string): number {
  const clean1 = cleanString(s1);
  const clean2 = cleanString(s2);
  if (!clean1 && !clean2) return 1;
  if (!clean1 || !clean2) return 0;
  if (clean1 === clean2) return 1;
  
  const w1 = new Set(clean1.split(/\s+/));
  const w2 = new Set(clean2.split(/\s+/));
  let intersection = 0;
  w1.forEach(w => {
    if (w2.has(w)) intersection++;
  });
  const union = w1.size + w2.size - intersection;
  return union > 0 ? intersection / union : 0;
}

export function parseLRC(lrcText: string): SyncedLine[] {
  const lines = (lrcText || '').split('\n');
  const result: SyncedLine[] = [];
  const timeRegex = /\[(\d{2}):(\d{2})(?:\.(\d{2,3}))?\]/g;
  
  for (const line of lines) {
    timeRegex.lastIndex = 0;
    const matches: { time: number }[] = [];
    let match;
    let lastIndex = 0;
    
    while ((match = timeRegex.exec(line)) !== null) {
      const min = parseInt(match[1], 10);
      const sec = parseInt(match[2], 10);
      const msStr = match[3] || '00';
      const ms = parseInt(msStr.padEnd(3, '0').substring(0, 3), 10);
      const timestamp = (min * 60 + sec) * 1000 + ms;
      matches.push({ time: timestamp });
      lastIndex = timeRegex.lastIndex;
    }
    
    if (matches.length > 0) {
      const text = line.substring(lastIndex).trim();
      for (const m of matches) {
        result.push({ text, timestamp: m.time });
      }
    }
  }
  
  result.sort((a, b) => a.timestamp - b.timestamp);
  
  for (let i = 0; i < result.length; i++) {
    const next = result[i + 1];
    if (next) {
      result[i].duration = next.timestamp - result[i].timestamp;
    } else {
      result[i].duration = 4000;
    }
  }
  
  return result;
}

// ── LRCLIB PROVIDER ──────────────────────────────────────────
export class LrcLibProvider implements LyricsProvider {
  id = 'lrclib';
  name = 'LRCLIB';
  enabled = true;
  priority = 1;
  supportsPlainLyrics = true;
  supportsSyncedLyrics = true;

  async searchLyrics(title: string, artist: string, duration?: number): Promise<LyricsResult[]> {
    try {
      // Try exact get first
      const getUrl = `https://lrclib.net/api/get?artist_name=${encodeURIComponent(artist)}&track_name=${encodeURIComponent(title)}`;
      const getRes = await fetch(getUrl);
      if (getRes.ok) {
        const item = await getRes.json();
        if (item.plainLyrics || item.syncedLyrics) {
          const confidence = 1.0;
          return [this.normalizeItem(item, title, artist, confidence)];
        }
      }
    } catch (e) {
      console.warn('[LRCLIB] Exact get failed, falling back to search:', e);
    }

    // Fallback to search
    const searchUrl = `https://lrclib.net/api/search?track_name=${encodeURIComponent(title)}&artist_name=${encodeURIComponent(artist)}`;
    const res = await fetch(searchUrl);
    if (!res.ok) throw new Error(`LRCLIB search returned ${res.status}`);
    const list = await res.json();
    if (!Array.isArray(list)) return [];

    return list.map(item => {
      const titleSim = getSimilarity(title, item.trackName || item.name);
      const artistSim = getSimilarity(artist, item.artistName);
      const hasSynced = !!item.syncedLyrics;
      
      let confidence = titleSim * 0.5 + artistSim * 0.4;
      if (hasSynced) confidence += 0.1;
      
      return this.normalizeItem(item, title, artist, confidence);
    });
  }

  private normalizeItem(item: any, targetTitle: string, targetArtist: string, confidence: number): LyricsResult {
    const syncedLines = item.syncedLyrics ? parseLRC(item.syncedLyrics) : [];
    return {
      provider: this.id,
      sourceId: String(item.id || ''),
      title: item.trackName || item.name || targetTitle,
      artist: item.artistName || targetArtist,
      plainLyrics: item.plainLyrics || '',
      syncedLines,
      duration: item.duration || undefined,
      confidence,
      fetchedAt: Date.now(),
      sourceMetadata: { album: item.albumName }
    };
  }
}

// ── KUGOU PROVIDER ───────────────────────────────────────────
export class KuGouProvider implements LyricsProvider {
  id = 'kugou';
  name = 'KuGou (Signature Restricted)';
  enabled = false; // Disabled by default due to signature restrictions
  priority = 2;
  supportsPlainLyrics = true;
  supportsSyncedLyrics = true;

  async searchLyrics(title: string, artist: string): Promise<LyricsResult[]> {
    // This provider requires signature keys on its complexsearch endpoint,
    // so it fails closed by default in this client unless active keys are present.
    throw new Error('KuGou API signature verification required');
  }
}

// ── YOUTUBE MUSIC PROVIDER ───────────────────────────────────
export class YouTubeMusicProvider implements LyricsProvider {
  id = 'ytmusic';
  name = 'YouTube Music (Mock/Stub)';
  enabled = false;
  priority = 3;
  supportsPlainLyrics = true;
  supportsSyncedLyrics = false;

  async searchLyrics(title: string, artist: string): Promise<LyricsResult[]> {
    // YouTube Music does not expose a public, unauthenticated lyrics API.
    return [];
  }
}

// ── LYRICSPLUS / KPOE PROVIDER ───────────────────────────────
export class LyricsPlusProvider implements LyricsProvider {
  id = 'lyricsplus';
  name = 'LyricsPlus (Mock/Stub)';
  enabled = false;
  priority = 4;
  supportsPlainLyrics = true;
  supportsSyncedLyrics = true;

  async searchLyrics(): Promise<LyricsResult[]> {
    return [];
  }
}

// ── MUSIXMATCH ADAPTER ───────────────────────────────────────
export class MusixmatchAdapter implements LyricsProvider {
  id = 'musixmatch';
  name = 'Musixmatch (Licensed)';
  enabled = false;
  priority = 5;
  supportsPlainLyrics = true;
  supportsSyncedLyrics = true;

  async searchLyrics(): Promise<LyricsResult[]> {
    // Licensed credentials required.
    return [];
  }
}

// ── LYRICFIND ADAPTER ────────────────────────────────────────
export class LyricFindAdapter implements LyricsProvider {
  id = 'lyricfind';
  name = 'LyricFind (Licensed)';
  enabled = false;
  priority = 6;
  supportsPlainLyrics = true;
  supportsSyncedLyrics = false;

  async searchLyrics(): Promise<LyricsResult[]> {
    // Licensed credentials required.
    return [];
  }
}

// ── REGISTRY & DISPATCHER ────────────────────────────────────
export const PROVIDERS: LyricsProvider[] = [
  new LrcLibProvider(),
  new KuGouProvider(),
  new YouTubeMusicProvider(),
  new LyricsPlusProvider(),
  new MusixmatchAdapter(),
  new LyricFindAdapter()
];

export interface FetchOptions {
  preferSynced?: boolean;
  enabledProviders?: string[]; // array of provider ids
}

export async function fetchLyricsOnline(title: string, artist: string, options: FetchOptions = {}): Promise<LyricsResult | null> {
  const preferSynced = options.preferSynced !== false;
  const enabledIds = options.enabledProviders || ['lrclib']; // default to lrclib
  
  const activeProviders = PROVIDERS.filter(p => p.enabled && enabledIds.includes(p.id))
    .sort((a, b) => a.priority - b.priority);

  for (const provider of activeProviders) {
    try {
      console.log(`[LyricsService] Querying provider: ${provider.name} for "${artist} - ${title}"`);
      const results = await provider.searchLyrics(title, artist);
      if (results && results.length > 0) {
        // Find best result above 0.5 confidence
        let best: LyricsResult | null = null;
        for (const res of results) {
          if (res.confidence >= 0.5) {
            if (!best) {
              best = res;
            } else {
              // Compare
              const bestHasSynced = best.syncedLines.length > 0;
              const resHasSynced = res.syncedLines.length > 0;
              
              if (preferSynced && resHasSynced && !bestHasSynced) {
                best = res;
              } else if (res.confidence > best.confidence) {
                best = res;
              }
            }
          }
        }
        if (best) {
          console.log(`[LyricsService] Match found via ${provider.name} (confidence: ${best.confidence})`);
          return best;
        }
      }
    } catch (e) {
      console.warn(`[LyricsService] Provider ${provider.name} failed:`, e);
    }
  }

  return null;
}
