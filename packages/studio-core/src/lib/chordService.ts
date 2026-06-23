import { type SongChart, type SongChartSection, type ChordMarker } from '../data/songs';
import { AUTHORIZED_CHORD_CHARTS } from '../data/authorizedChords';
import { getChordByName } from '../data/chords';
import { fetchLyricsOnline, type LyricsResult } from './lyricsService';

export interface NormalizedChordMarker {
  chord: string;
  offset: number;          // character offset in lyrics line
  timestamp?: number;      // absolute start time in ms
}

export interface NormalizedLyricsLine {
  lyrics: string;
  chords: NormalizedChordMarker[];
  lineIndex: number;
  timestamp?: number;      // start time in ms
  duration?: number;       // duration in ms
}

export interface NormalizedSection {
  name: string;
  lines: NormalizedLyricsLine[];
}

export interface NormalizedChordChart {
  songId: string;
  title: string;
  artist: string;
  key: string;
  capo?: number;
  tuning?: string;
  sections: NormalizedSection[];
  source: string;          // e.g. 'builtin', 'user', 'lrclib'
  licenseInfo?: string;
  confidence: number;      // 0.0 to 1.0
  chartStatus: 'verified' | 'user' | 'provider' | 'unavailable';
}

export interface ChordChartProvider {
  id: string;
  name: string;
  enabled: boolean;
  priority: number;
  licenseInfo?: string;
  searchChart(song: SongChart): Promise<NormalizedChordChart | null>;
}

// ── BUILT-IN CHORD PROVIDER ───────────────────────────────────
export class BuiltInChordProvider implements ChordChartProvider {
  id = 'builtin';
  name = 'Built-in Verified Charts';
  enabled = true;
  priority = 2;
  licenseInfo = 'Authorized / Public Domain';

  async searchChart(song: SongChart): Promise<NormalizedChordChart | null> {
    const sections = AUTHORIZED_CHORD_CHARTS[song.id];
    if (!sections) return null;

    let lineCounter = 0;
    const normalizedSections: NormalizedSection[] = sections.map(sec => ({
      name: sec.name,
      lines: sec.lines.map(line => ({
        lyrics: line.lyrics,
        lineIndex: lineCounter++,
        timestamp: line.timestamp,
        duration: line.duration,
        chords: (line.chords || []).map(c => ({
          chord: c.chord,
          offset: c.offset,
          timestamp: c.timestamp
        }))
      }))
    }));

    return {
      songId: song.id,
      title: song.title,
      artist: song.artist,
      key: song.key,
      capo: song.capo,
      sections: normalizedSections,
      source: this.id,
      licenseInfo: this.licenseInfo,
      confidence: 1.0,
      chartStatus: 'verified'
    };
  }
}

// ── USER IMPORTED CHORD PROVIDER ───────────────────────────────
export class UserImportedChordProvider implements ChordChartProvider {
  id = 'user';
  name = 'User Custom Charts';
  enabled = true;
  priority = 1;
  licenseInfo = 'User Provided';

  async searchChart(song: SongChart): Promise<NormalizedChordChart | null> {
    const saved = localStorage.getItem(`chordex:practice:custom_chart:${song.id}`);
    if (!saved) return null;

    try {
      const parsedSections: SongChartSection[] = JSON.parse(saved);
      let lineCounter = 0;
      const normalizedSections: NormalizedSection[] = parsedSections.map(sec => ({
        name: sec.name,
        lines: sec.lines.map(line => ({
          lyrics: line.lyrics,
          lineIndex: lineCounter++,
          timestamp: line.timestamp,
          duration: line.duration,
          chords: (line.chords || []).map(c => ({
            chord: c.chord,
            offset: c.offset,
            timestamp: c.timestamp
          }))
        }))
      }));

      return {
        songId: song.id,
        title: song.title,
        artist: song.artist,
        key: song.key,
        capo: song.capo,
        sections: normalizedSections,
        source: this.id,
        licenseInfo: this.licenseInfo,
        confidence: 1.0,
        chartStatus: 'user'
      };
    } catch (_) {
      return null;
    }
  }
}

// Helper to convert plain/synced lyrics from LRCLIB into normalized lyrics lines
function mapLyricsResultToSections(result: LyricsResult): NormalizedSection[] {
  let lineCounter = 0;
  if (result.syncedLines && result.syncedLines.length > 0) {
    const lines = result.syncedLines.map((line: any) => ({
      lyrics: line.text || ' ',
      chords: [],
      lineIndex: lineCounter++,
      timestamp: line.timestamp,
      duration: line.duration
    }));
    return [{ name: 'Lyrics (Synced)', lines }];
  } else if (result.plainLyrics) {
    const lines = result.plainLyrics.split('\n').map((lineText: string) => ({
      lyrics: lineText.trim() || ' ',
      chords: [],
      lineIndex: lineCounter++
    }));
    return [{ name: 'Lyrics', lines }];
  }
  return [];
}

// ── OPEN CHORD PRO API PROVIDER (SEARCH ADAPTER STUB) ─────────
export class OpenChordProApiProvider implements ChordChartProvider {
  id = 'openchordpro';
  name = 'OpenChordPro Repository';
  enabled = true;
  priority = 3;
  licenseInfo = 'Creative Commons / Public Domain';

  async searchChart(song: SongChart): Promise<NormalizedChordChart | null> {
    // Stub search for CC / PD ChordPro repositories online
    return null;
  }
}

// ── OPEN CHORD CHARTS PROVIDER (LRCLIB & METADATA ADAPTER) ──────
export class OpenChordChartsProvider implements ChordChartProvider {
  id = 'openchords';
  name = 'Open Chords Adapter';
  enabled = true;
  priority = 4;
  licenseInfo = 'LRCLIB Terms Compatible';

  async searchChart(song: SongChart): Promise<NormalizedChordChart | null> {
    const enabledProviders = ['lrclib'];
    const preferSynced = true;
    
    const result = await fetchLyricsOnline(song.title, song.artist, {
      preferSynced,
      enabledProviders
    });

    if (!result) return null;

    const sections = mapLyricsResultToSections(result);
    return {
      songId: song.id,
      title: song.title,
      artist: song.artist,
      key: song.key,
      capo: song.capo,
      sections,
      source: result.provider,
      licenseInfo: this.licenseInfo,
      confidence: result.confidence,
      chartStatus: 'unavailable' // No chords in LRCLIB lyrics, marks as unavailable
    };
  }
}

// ── REGISTRY & SEARCH STRATEGY ──────────────────────────────────
export const CHORD_PROVIDERS: ChordChartProvider[] = [
  new UserImportedChordProvider(),
  new BuiltInChordProvider(),
  new OpenChordProApiProvider(),
  new OpenChordChartsProvider()
];

// Clean a chord name to look up in the library
export function cleanChordLookupName(name: string): string {
  if (!name || name === '—') return '';
  let clean = name.trim();
  const slashIdx = clean.indexOf('/');
  if (slashIdx !== -1) {
    clean = clean.substring(0, slashIdx);
  }
  clean = clean.replace(/[()\[\]]/g, '');
  return clean.trim();
}

// Validate that a chord name exists in the Chordex chord database
export function validateChord(chordName: string): boolean {
  const clean = cleanChordLookupName(chordName);
  if (!clean) return false;
  try {
    const chordObj = getChordByName(clean);
    return !!chordObj;
  } catch (_) {
    return false;
  }
}

// Coordinates the provider search strategy, validates and caches results
export async function getChordChart(song: SongChart, forceRefresh = false): Promise<NormalizedChordChart | null> {
  // 1. Check User-Imported Provider first (highest priority)
  const userProvider = new UserImportedChordProvider();
  const userChart = await userProvider.searchChart(song);
  if (userChart) {
    validateChartChords(userChart);
    return userChart;
  }

  // 2. Check Built-in Verified Provider second
  const builtinProvider = new BuiltInChordProvider();
  const builtinChart = await builtinProvider.searchChart(song);
  if (builtinChart) {
    validateChartChords(builtinChart);
    return builtinChart;
  }

  // 3. Check Cached Provider Result third (if not forceRefresh)
  const cacheKey = `chordex:chords:cache:${song.id}`;
  if (!forceRefresh) {
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      if (cached === 'none') return null;
      try {
        const cachedChart: NormalizedChordChart = JSON.parse(cached);
        validateChartChords(cachedChart);
        return cachedChart;
      } catch (_) {}
    }
  }

  // 4. Query remaining providers (OpenChordPro, OpenChords)
  const openProProvider = new OpenChordProApiProvider();
  const openProChart = await openProProvider.searchChart(song);
  if (openProChart) {
    validateChartChords(openProChart);
    localStorage.setItem(cacheKey, JSON.stringify(openProChart));
    return openProChart;
  }

  const openProvider = new OpenChordChartsProvider();
  try {
    const chart = await openProvider.searchChart(song);
    if (chart) {
      validateChartChords(chart);
      localStorage.setItem(cacheKey, JSON.stringify(chart));
      return chart;
    } else {
      localStorage.setItem(cacheKey, 'none');
    }
  } catch (e) {
    console.error('[ChordService] Failed to query open provider:', e);
  }

  return null;
}

// Helper to sanitize and validate chord names in a chart
function validateChartChords(chart: NormalizedChordChart): void {
  chart.sections.forEach(sec => {
    sec.lines.forEach(line => {
      line.chords.forEach(c => {
        c.chord = c.chord.trim();
        if (!validateChord(c.chord)) {
          console.warn(`[ChordService] Invalid/Unknown chord: ${c.chord} in song ${chart.title}`);
        }
      });
    });
  });
}
