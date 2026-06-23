import { type SongChart, type SongChartSection, type ChordMarker } from '../data/songs';
import { AUTHORIZED_CHORD_CHARTS } from '../data/authorizedChords';
import { getChordByName } from '../data/chords';
import { fetchLyricsOnline, type LyricsResult } from './lyricsService';
import { Capacitor, CapacitorHttp } from '@capacitor/core';

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

// ── URL IMPORT PARSER ARCHITECTURE ──────────────────────────────

export interface ChartUrlImporter {
  id: string;
  name: string;
  supportedHosts: string[];
  canHandle(url: string): boolean;
  importFromUrl(url: string, song: SongChart): Promise<NormalizedChordChart>;
}

async function fetchHtmlContent(url: string): Promise<string> {
  if (Capacitor.isNativePlatform()) {
    try {
      const response = await CapacitorHttp.get({
        url,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
        }
      });
      return response.data;
    } catch (err: any) {
      throw new Error(`Native fetch failed: ${err.message || err}`);
    }
  } else {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    if (!response.ok) {
      throw new Error(`HTTP fetch failed with status ${response.status}`);
    }
    return await response.text();
  }
}

function decodeHtmlEntities(str: string): string {
  if (!str) return '';
  let decoded = str
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
  decoded = decoded.replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(Number(dec)));
  decoded = decoded.replace(/&#x([0-9a-fA-F]+);/g, (match, hex) => String.fromCharCode(parseInt(hex, 16)));
  return decoded;
}

function parseCifraClubChordsFromLine(lineText: string): NormalizedChordMarker[] {
  const chords: NormalizedChordMarker[] = [];
  let visualIndex = 0;
  let inTag = false;
  let chordStartVisualIndex = 0;

  for (let i = 0; i < lineText.length; i++) {
    const char = lineText[i];
    if (char === '<') {
      inTag = true;
      if (lineText.substring(i, i + 3) === '<b>') {
        chordStartVisualIndex = visualIndex;
      }
      continue;
    }
    if (char === '>') {
      inTag = false;
      continue;
    }
    if (inTag) {
      continue;
    }
    
    if (i >= 3 && lineText.substring(i - 3, i) === '<b>') {
      let chordText = '';
      let j = i;
      while (j < lineText.length && lineText[j] !== '<') {
        chordText += lineText[j];
        j++;
      }
      chords.push({
        chord: decodeHtmlEntities(chordText.trim()),
        offset: visualIndex
      });
      i = j - 1;
      visualIndex += chordText.length;
    } else {
      visualIndex++;
    }
  }

  return chords;
}

export class CifraClubImporter implements ChartUrlImporter {
  id = 'cifraclub';
  name = 'Cifra Club Parser';
  supportedHosts = ['cifraclub.com.br', 'www.cifraclub.com.br', 'cifraclub.com', 'www.cifraclub.com'];

  canHandle(url: string): boolean {
    try {
      const hostname = new URL(url).hostname.toLowerCase();
      return this.supportedHosts.some(h => hostname === h || hostname.endsWith('.' + h));
    } catch (_) {
      return false;
    }
  }

  async importFromUrl(url: string, song: SongChart): Promise<NormalizedChordChart> {
    const html = await fetchHtmlContent(url);
    
    let title = song.title;
    const titleMatch = html.match(/<h1 class="t1">([\s\S]+?)<\/h1>/) || html.match(/<title>([\s\S]+?) - Cifra Club<\/title>/);
    if (titleMatch) {
      title = decodeHtmlEntities(titleMatch[1].split(' - ')[0].trim());
    }

    let artist = song.artist;
    const artistMatch = html.match(/<a class="t3"[\s\S]*?>([\s\S]+?)<\/a>/) || html.match(/<title>[\s\S]+? - ([\s\S]+?) - Cifra Club<\/title>/);
    if (artistMatch) {
      artist = decodeHtmlEntities(artistMatch[1].trim());
    }

    let key = song.key || 'C';
    const keyMatch = html.match(/Tom:\s*<b>([^<]+)<\/b>/) || html.match(/id="cifra_tom"[\s\S]*?>[\s\S]*?<b>([^<]+)<\/b>/);
    if (keyMatch) {
      key = keyMatch[1].trim();
    }

    let capo: number | undefined = undefined;
    const capoMatch = html.match(/Capo:\s*<b>(?:sem|no|na)?\s*(\d+)/i) || html.match(/class="cifra-capo"[\s\S]*?>[\s\S]*?<b>([^<]+)<\/b>/);
    if (capoMatch) {
      const parsed = parseInt(capoMatch[1] || capoMatch[2] || '', 10);
      if (!isNaN(parsed)) capo = parsed;
    }

    const preMatch = html.match(/<pre>([\s\S]+?)<\/pre>/);
    if (!preMatch) {
      throw new Error('No preformatted chord chart block found on Cifra Club page.');
    }

    const preContent = preMatch[1];
    
    let cleanContent = preContent;
    let prevLength;
    do {
      prevLength = cleanContent.length;
      cleanContent = cleanContent.replace(/<span class="tablatura">([\s\S]*?)<\/span>/gi, '');
    } while (cleanContent.length !== prevLength);

    const rawLines = cleanContent.split('\n');
    const sections: NormalizedSection[] = [];
    let currentSection: NormalizedSection = { name: 'Intro/Verse', lines: [] };
    let lineCounter = 0;

    for (let i = 0; i < rawLines.length; i++) {
      const lineText = rawLines[i];
      
      const sectionMatch = lineText.match(/^\[([^\]]+)\]/);
      if (sectionMatch) {
        if (currentSection.lines.length > 0) {
          sections.push(currentSection);
        }
        let sectionName = sectionMatch[1].trim();
        if (sectionName.toLowerCase() === 'refrão' || sectionName.toLowerCase() === 'coro') {
          sectionName = 'Chorus';
        } else if (sectionName.toLowerCase() === 'ponte') {
          sectionName = 'Bridge';
        } else if (sectionName.toLowerCase() === 'primeira parte') {
          sectionName = 'Verse 1';
        } else if (sectionName.toLowerCase() === 'segunda parte') {
          sectionName = 'Verse 2';
        }
        currentSection = { name: sectionName, lines: [] };
        continue;
      }

      const hasBoldChords = lineText.includes('<b>');
      if (hasBoldChords) {
        const nextLineText = rawLines[i + 1] !== undefined ? rawLines[i + 1] : '';
        const isNextLineSectionOrChords = nextLineText.match(/^\[([^\]]+)\]/) || nextLineText.includes('<b>');
        
        if (isNextLineSectionOrChords || nextLineText.trim() === '') {
          const chords = parseCifraClubChordsFromLine(lineText);
          currentSection.lines.push({
            lyrics: ' ',
            chords,
            lineIndex: lineCounter++
          });
        } else {
          const chords = parseCifraClubChordsFromLine(lineText);
          const cleanLyrics = decodeHtmlEntities(nextLineText.replace(/<[^>]*>/g, '').trimEnd());
          currentSection.lines.push({
            lyrics: cleanLyrics || ' ',
            chords,
            lineIndex: lineCounter++
          });
          i++;
        }
      } else {
        const cleanLyrics = decodeHtmlEntities(lineText.replace(/<[^>]*>/g, '').trim());
        if (cleanLyrics && !cleanLyrics.startsWith('E|') && !cleanLyrics.startsWith('B|') && !cleanLyrics.startsWith('G|') && !cleanLyrics.startsWith('D|') && !cleanLyrics.startsWith('A|')) {
          currentSection.lines.push({
            lyrics: cleanLyrics,
            chords: [],
            lineIndex: lineCounter++
          });
        }
      }
    }

    if (currentSection.lines.length > 0) {
      sections.push(currentSection);
    }

    return {
      songId: song.id,
      title,
      artist,
      key,
      capo,
      sections,
      source: 'cifraclub',
      licenseInfo: 'User-imported from Cifra Club',
      confidence: 0.95,
      chartStatus: 'user'
    };
  }
}

export class GenericPreformattedImporter implements ChartUrlImporter {
  id = 'generic';
  name = 'Generic Chords Parser';
  supportedHosts = ['*'];

  canHandle(url: string): boolean {
    return true;
  }

  async importFromUrl(url: string, song: SongChart): Promise<NormalizedChordChart> {
    const text = await fetchHtmlContent(url);
    return parsePlainChart(text, song);
  }
}

function isChordProFormat(text: string): boolean {
  const matches = text.match(/\[[A-G][b#]?(?:maj|min|m|dim|aug|sus)?\d*(?:\/[A-G][b#]?)?\]/g);
  return matches !== null && matches.length > 5;
}

function parseChordProLine(lineText: string): { lyrics: string; chords: NormalizedChordMarker[] } {
  let lyrics = '';
  const chords: NormalizedChordMarker[] = [];
  let i = 0;
  
  while (i < lineText.length) {
    const char = lineText[i];
    if (char === '[') {
      const closeIdx = lineText.indexOf(']', i);
      if (closeIdx !== -1) {
        const chordName = lineText.substring(i + 1, closeIdx).trim();
        if (chordName && validateChord(chordName)) {
          chords.push({
            chord: chordName,
            offset: lyrics.length
          });
        }
        i = closeIdx + 1;
        continue;
      }
    }
    lyrics += char;
    i++;
  }
  return { lyrics, chords };
}

function isChordsLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  if (trimmed.match(/^[a-gA-G]?\|/)) return false;
  
  const tokens = trimmed.split(/\s+/);
  if (tokens.length === 0) return false;
  
  let validChords = 0;
  for (const tok of tokens) {
    const cleanTok = tok.replace(/[()\[\]]/g, '').trim();
    if (!cleanTok) continue;
    if (validateChord(cleanTok) || cleanTok === '—' || cleanTok.match(/^[I|V|i|v|x|v]+$/) || ['intro', 'verse', 'chorus', 'bridge', 'solo', 'outro', 'refrão'].includes(cleanTok.toLowerCase())) {
      validChords++;
    }
  }
  return validChords / tokens.length >= 0.7;
}

function parseChordsFromLine(lineText: string): NormalizedChordMarker[] {
  const chords: NormalizedChordMarker[] = [];
  const regex = /\S+/g;
  let match;
  while ((match = regex.exec(lineText)) !== null) {
    const chordName = match[0].replace(/[()\[\]]/g, '').trim();
    if (chordName && validateChord(chordName)) {
      chords.push({
        chord: chordName,
        offset: match.index
      });
    }
  }
  return chords;
}

function cleanHtmlToPlainText(html: string): string {
  if (!html) return '';
  let text = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/tr>/gi, '\n');
  
  const preMatch = html.match(/<pre>([\s\S]+?)<\/pre>/i);
  if (preMatch) {
    text = preMatch[1];
  }
  
  text = text.replace(/<[^>]*>/g, '');
  return decodeHtmlEntities(text);
}

export function parsePlainChart(text: string, song: SongChart): NormalizedChordChart {
  const cleanText = cleanHtmlToPlainText(text);
  const rawLines = cleanText.split('\n');
  const sections: NormalizedSection[] = [];
  let currentSection: NormalizedSection = { name: 'Intro/Verse', lines: [] };
  let lineCounter = 0;
  
  let title = song.title;
  let artist = song.artist;
  let key = song.key || 'C';
  let capo: number | undefined = undefined;

  if (isChordProFormat(cleanText)) {
    for (const rawLine of rawLines) {
      const trimmed = rawLine.trim();
      if (!trimmed) continue;
      
      if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
        const content = trimmed.substring(1, trimmed.length - 1).trim();
        const colonIdx = content.indexOf(':');
        if (colonIdx !== -1) {
          const directive = content.substring(0, colonIdx).trim().toLowerCase();
          const val = content.substring(colonIdx + 1).trim();
          if (directive === 'title' || directive === 't') title = val;
          else if (directive === 'artist' || directive === 'a') artist = val;
          else if (directive === 'key' || directive === 'k') key = val;
          else if (directive === 'capo') {
            const parsed = parseInt(val, 10);
            if (!isNaN(parsed)) capo = parsed;
          }
        }
        continue;
      }
      
      if (trimmed.startsWith('{start_of_chorus}') || trimmed.startsWith('{soc}')) {
        if (currentSection.lines.length > 0) sections.push(currentSection);
        currentSection = { name: 'Chorus', lines: [] };
        continue;
      }
      if (trimmed.startsWith('{end_of_chorus}') || trimmed.startsWith('{eoc}')) {
        continue;
      }
      
      const { lyrics, chords } = parseChordProLine(rawLine);
      currentSection.lines.push({
        lyrics: lyrics || ' ',
        chords,
        lineIndex: lineCounter++
      });
    }
  } else {
    for (let i = 0; i < rawLines.length; i++) {
      const lineText = rawLines[i];
      const trimmed = lineText.trim();
      if (!trimmed) continue;

      const sectionMatch = trimmed.match(/^\[([^\]]+)\]/);
      if (sectionMatch) {
        if (currentSection.lines.length > 0) {
          sections.push(currentSection);
        }
        currentSection = { name: sectionMatch[1].trim(), lines: [] };
        continue;
      }

      if (isChordsLine(lineText)) {
        const nextLineText = rawLines[i + 1] !== undefined ? rawLines[i + 1] : '';
        const isNextLineSectionOrChords = nextLineText.trim().match(/^\[([^\]]+)\]/) || isChordsLine(nextLineText);
        
        if (isNextLineSectionOrChords || nextLineText.trim() === '') {
          const chords = parseChordsFromLine(lineText);
          currentSection.lines.push({
            lyrics: ' ',
            chords,
            lineIndex: lineCounter++
          });
        } else {
          const chords = parseChordsFromLine(lineText);
          currentSection.lines.push({
            lyrics: nextLineText.trimEnd() || ' ',
            chords,
            lineIndex: lineCounter++
          });
          i++;
        }
      } else {
        if (!trimmed.startsWith('E|') && !trimmed.startsWith('B|') && !trimmed.startsWith('G|') && !trimmed.startsWith('D|') && !trimmed.startsWith('A|')) {
          currentSection.lines.push({
            lyrics: lineText.trimEnd() || ' ',
            chords: [],
            lineIndex: lineCounter++
          });
        }
      }
    }
  }

  if (currentSection.lines.length > 0) {
    sections.push(currentSection);
  }

  return {
    songId: song.id,
    title,
    artist,
    key,
    capo,
    sections,
    source: 'imported',
    licenseInfo: 'User imported raw text / ChordPro',
    confidence: 0.8,
    chartStatus: 'user'
  };
}

export const URL_IMPORTERS: ChartUrlImporter[] = [
  new CifraClubImporter(),
  new GenericPreformattedImporter()
];

export async function importChartFromUrl(url: string, song: SongChart): Promise<NormalizedChordChart> {
  try {
    new URL(url);
  } catch (_) {
    throw new Error('Invalid URL format. Please paste a valid web address.');
  }

  const lowerUrl = url.toLowerCase();
  if (lowerUrl.includes('ultimate-guitar.com')) {
    throw new Error('Ultimate Guitar is not supported for automatic import due to Cloudflare anti-bot blocks. Please copy and paste the chart manually.');
  }
  if (lowerUrl.includes('songsterr.com')) {
    throw new Error('Songsterr is not supported because it uses tablature playback tracks instead of text chords and lyrics. Please copy and paste the chart manually.');
  }
  if (lowerUrl.includes('chordify.net') || lowerUrl.includes('chordu.com')) {
    throw new Error('Chordify/ChordU are not supported because they only provide timing grids rather than aligned lyrics. Please copy and paste the chart manually.');
  }

  const parser = URL_IMPORTERS.find(p => p.canHandle(url));
  if (!parser) {
    throw new Error('No compatible importer found for this website.');
  }

  return await parser.importFromUrl(url, song);
}
