import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import AnimatedActionButton from '../components/animata/container/animated-border-trail';
import { Capacitor } from '@capacitor/core';
import SuccessLottie from '../components/lottie/SuccessLottie';
import MusicNotesLottie from '../components/lottie/MusicNotesLottie';
import { getAllChords, getChordById, type Chord, type ChordType, type GuitarChordData } from '../data/chords';
import { useChordStore, ACCENT_COLORS, type SongPreset, type SongSection, type CustomChord } from '../store/useChordStore';
import { transposeChordId, transposeKeyString, formatOffset } from '../lib/transpose';
import { isChordOutOfKey } from '../lib/chordAssistant';
import LiveMode from '../components/LiveMode';
import CustomChordBuilder, { CustomMiniDiagram } from '../components/CustomChordBuilder';
import ChordDiagram from '../components/ChordDiagram';
import { useScrollHide, setNavHidden } from '../lib/navScroll';
import { useT } from '../lib/useT';
import { setBackHandler } from '../lib/backStack';
import { AppModeMenuLogo } from '../components/AppModeMenuLogo';
import { useIsWebDesktop } from '../hooks/useIsWebDesktop';
import { AnimatedAppHeader, StaggeredReveal } from '../components/AppAnimationSystem';
import { logActivity } from '../lib/activityLogger';

/* ──────────────────── PDF EXPORT CONFIG ──────────────────── */
export interface ExportConfig {
  includeTitle:   boolean;
  includeArtist:  boolean;
  includeBPM:     boolean;
  includeKey:     boolean;
  includeNotes:   boolean;
  chordDisplay:   'name' | 'diagram' | 'both';
  orientation:    'portrait' | 'landscape';
  paperSize:      'a4' | 'letter';
  theme:          'light' | 'dark';
  showNumbering:  boolean;
  compactLayout:  boolean;
  exportStyle:    'minimal' | 'elegant' | 'compact';
}

const DEFAULT_EXPORT_CONFIG: ExportConfig = {
  includeTitle:  true,
  includeArtist: true,
  includeBPM:    true,
  includeKey:    true,
  includeNotes:  true,
  chordDisplay:  'both',
  orientation:   'portrait',
  paperSize:     'a4',
  theme:         'light',
  showNumbering: true,
  compactLayout: false,
  exportStyle:   'elegant',
};

/* ──────────────────── PDF EXPORT ──────────────────── */
function buildPrintSVG(data: GuitarChordData, dark = false, _accentColor = '#679cff', _scale = 1, noLabel = false): string {
  const numS = 6;
  const { frets, barres, baseFret } = data;
  const posF = frets.filter(f => f > 0);
  const minA = posF.length ? Math.min(...posF) : 1;
  const maxA = posF.length ? Math.max(...posF) : 1;
  const effBase = baseFret > 1 ? baseFret : Math.max(1, minA);
  const numF = Math.max(4, maxA - effBase + 1);
  const W = 86, H = 84;
  const pL = 10, pT = 14, pR = 10;
  const gridW = W - pL - pR;
  const cW = gridW / (numS - 1);
  const cH = (H - pT - 10) / numF;
  const r  = 4.5;
  const minF    = effBase;
  const showNut = minF <= 1;

  const dotFill    = dark ? '#e8e8e8' : '#191a1a';
  const lineFill   = dark ? 'rgba(200,200,200,0.18)' : 'rgba(25,26,26,0.15)';
  const nutFill    = dark ? '#ddd'    : '#191a1a';
  const muteColor  = dark ? '#555'    : '#ccc';
  const openStroke = dark ? '#555'    : '#bbb';

  let s = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" overflow="visible">`;

  if (showNut) {
    s += `<rect x="${pL}" y="${pT - 5}" width="${gridW}" height="4" rx="1.5" fill="${nutFill}"/>`;
  }
  if (!showNut && !noLabel) {
    s += `<text x="${pL - 3}" y="${pT + cH * 0.5}" font-family="Arial,sans-serif" font-size="8" font-weight="700" fill="${dark ? '#aaa' : '#777'}" text-anchor="end" dominant-baseline="middle">${minF}</text>`;
  }
  for (let i = 0; i <= numF; i++) {
    const y = pT + i * cH;
    const isTopFret = i === 0 && !showNut;
    s += `<line x1="${pL}" y1="${y}" x2="${pL + gridW}" y2="${y}" stroke="${lineFill}" stroke-width="${isTopFret ? 1.5 : 1}"/>`;
  }
  for (let i = 0; i < numS; i++) {
    const x = pL + i * cW;
    s += `<line x1="${x}" y1="${pT}" x2="${x}" y2="${pT + numF * cH}" stroke="${lineFill}" stroke-width="1"/>`;
  }
  if (barres) {
    for (const barre of barres) {
      const fp = barre.fret - minF;
      if (fp >= 0 && fp < numF) {
        const x1 = pL + (numS - barre.fromString) * cW;
        const x2 = pL + (numS - barre.toString) * cW;
        const cy = pT + fp * cH + cH / 2;
        s += `<rect x="${Math.min(x1, x2)}" y="${cy - r}" width="${Math.abs(x2 - x1)}" height="${r * 2}" rx="${r}" fill="${dotFill}"/>`;
      }
    }
  }
  frets.forEach((f, si) => {
    if (f <= 0) return;
    const fp = f - minF; if (fp < 0 || fp >= numF) return;
    const cx = pL + si * cW, cy = pT + fp * cH + cH / 2;
    s += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${dotFill}"/>`;
  });
  const aboveY = pT - 9;
  frets.forEach((f, si) => {
    const cx = pL + si * cW;
    if (f === -1) s += `<text x="${cx}" y="${aboveY + 3}" font-family="Arial,sans-serif" font-size="10" fill="${muteColor}" text-anchor="middle" dominant-baseline="middle" font-weight="bold">×</text>`;
    else if (f === 0) s += `<circle cx="${cx}" cy="${aboveY}" r="3.5" fill="none" stroke="${openStroke}" stroke-width="1.2"/>`;
  });

  s += '</svg>';
  return s;
}

/** Generalized fretboard SVG for any string count (bass=4, guitar=6) */
function buildPrintFretboardSVG(
  frets: number[], baseFret: number,
  barres: { fret: number; fromString: number; toString: number }[],
  numStrings: number,
  dark = false, _accentColor = '#679cff', _scale = 1, noLabel = false,
): string {
  const posF = frets.filter(f => f > 0);
  const minA = posF.length ? Math.min(...posF) : 1;
  const maxA = posF.length ? Math.max(...posF) : 1;
  const effBase = baseFret > 1 ? baseFret : Math.max(1, minA);
  const numF = Math.max(4, maxA - effBase + 1);
  const W = 86, H = 84;
  const pL = 10, pT = 14, pR = 10;
  const gridW = W - pL - pR;
  const strSpacing = numStrings > 1 ? gridW / (numStrings - 1) : 0;
  const cH = (H - pT - 10) / numF;
  const r  = 4.5;
  const minF    = effBase;
  const showNut = minF <= 1;
  const dotFill    = dark ? '#e8e8e8' : '#191a1a';
  const lineFill   = dark ? 'rgba(200,200,200,0.18)' : 'rgba(25,26,26,0.15)';
  const nutFill    = dark ? '#ddd'    : '#191a1a';
  const muteColor  = dark ? '#555'    : '#ccc';
  const openStroke = dark ? '#555'    : '#bbb';
  let s = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" overflow="visible">`;
  if (showNut) {
    s += `<rect x="${pL}" y="${pT - 5}" width="${(numStrings - 1) * strSpacing}" height="4" rx="1.5" fill="${nutFill}"/>`;
  } else if (!noLabel) {
    s += `<text x="${pL - 3}" y="${pT + cH * 0.5}" font-family="Arial,sans-serif" font-size="8" font-weight="700" fill="${dark ? '#aaa' : '#777'}" text-anchor="end" dominant-baseline="middle">${minF}</text>`;
  }
  for (let i = 0; i <= numF; i++) {
    const y = pT + i * cH;
    const isTop = i === 0 && !showNut;
    s += `<line x1="${pL}" y1="${y}" x2="${pL + (numStrings - 1) * strSpacing}" y2="${y}" stroke="${lineFill}" stroke-width="${isTop ? 1.5 : 1}"/>`;
  }
  for (let i = 0; i < numStrings; i++) {
    const x = pL + i * strSpacing;
    s += `<line x1="${x}" y1="${pT}" x2="${x}" y2="${pT + numF * cH}" stroke="${lineFill}" stroke-width="1"/>`;
  }
  for (const barre of barres) {
    const fp = barre.fret - minF;
    if (fp >= 0 && fp < numF) {
      const x1 = pL + (numStrings - barre.fromString) * strSpacing;
      const x2 = pL + (numStrings - barre.toString) * strSpacing;
      const cy = pT + fp * cH + cH / 2;
      s += `<rect x="${Math.min(x1, x2)}" y="${cy - r}" width="${Math.abs(x2 - x1)}" height="${r * 2}" rx="${r}" fill="${dotFill}"/>`;
    }
  }
  frets.forEach((f, si) => {
    if (f <= 0) return;
    const fp = f - minF; if (fp < 0 || fp >= numF) return;
    const cx = pL + si * strSpacing, cy = pT + fp * cH + cH / 2;
    s += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${dotFill}"/>`;
  });
  const aboveY = pT - 9;
  frets.forEach((f, si) => {
    const cx = pL + si * strSpacing;
    if (f === -1) s += `<text x="${cx}" y="${aboveY + 3}" font-family="Arial,sans-serif" font-size="10" fill="${muteColor}" text-anchor="middle" dominant-baseline="middle" font-weight="bold">×</text>`;
    else if (f === 0) s += `<circle cx="${cx}" cy="${aboveY}" r="3.5" fill="none" stroke="${openStroke}" stroke-width="1.2"/>`;
  });
  s += '</svg>';
  return s;
}

/** Piano keyboard SVG for PDF export */
function buildPrintPianoSVG(keys: number[], dark = false, accentColor = '#679cff', scale = 1): string {
  const W = Math.round(160 * scale), H = Math.round(88 * scale);
  const WHITE_CHROMAS = [0, 2, 4, 5, 7, 9, 11];
  const BLACK_CHROMAS = [1, 3, 6, 8, 10];
  const BLACK_POS     = [0.55, 1.55, 3.55, 4.55, 5.55];
  const numOct = 2, numWhite = numOct * 7;
  const wkW = W / numWhite, wkH = H - 2;
  const bkW = wkW * 0.62, bkH = wkH * 0.60;
  const whiteColor = dark ? '#cac6c2' : '#f4f4f4';
  const blackColor = dark ? '#1c1c1e' : '#1a1a1e';
  const strokeColor = dark ? '#383838' : '#d0d0d0';
  const bgColor     = dark ? '#252525' : '#e8e8e8';
  let s = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" overflow="visible">`;
  s += `<rect width="${W}" height="${H}" rx="5" fill="${bgColor}"/>`;
  for (let i = 0; i < numWhite; i++) {
    const chroma = WHITE_CHROMAS[i % 7];
    const isOn = keys.includes(chroma);
    s += `<rect x="${i * wkW + 0.5}" y="1" width="${wkW - 1}" height="${wkH}" rx="2" fill="${isOn ? accentColor : whiteColor}" stroke="${strokeColor}" stroke-width="0.5"/>`;
  }
  for (let oct = 0; oct < numOct; oct++) {
    for (let b = 0; b < BLACK_POS.length; b++) {
      const chroma = BLACK_CHROMAS[b];
      const isOn = keys.includes(chroma);
      const x = (oct * 7 + BLACK_POS[b]) * wkW - bkW / 2;
      s += `<rect x="${x}" y="1" width="${bkW}" height="${bkH}" rx="2" fill="${isOn ? accentColor : blackColor}"/>`;
    }
  }
  s += '</svg>';
  return s;
}

async function exportPresetToPDF(preset: SongPreset, cfg: ExportConfig = DEFAULT_EXPORT_CONFIG, transposeOffset = 0, storedCustomChords: CustomChord[] = [], accentColor = '#679cff', pdfName = '', mode: 'save' | 'share' = 'share'): Promise<boolean> {
  logActivity('export', `Exported ${preset.name} to PDF`, 'Chordex');
  const dark    = cfg.theme === 'dark';
  const style   = cfg.exportStyle ?? 'elegant';
  const compact = style === 'compact';
  const elegant = style === 'elegant';

  /* Build merged chord entry list */
  type ChordEntry = { isCustom: false; chord: Chord; idx: number } | { isCustom: true; customChord: CustomChord; idx: number };

  const buildEntries = (ids: string[]): ChordEntry[] => {
    const out: ChordEntry[] = [];
    ids.forEach((id, idx) => {
      if (id.startsWith('custom-')) {
        const cc = storedCustomChords.find(c => c.id === id);
        if (cc) out.push({ isCustom: true, customChord: cc, idx });
        else console.warn('[PDF] custom chord not found:', id);
      } else {
        const displayId = transposeOffset !== 0 ? transposeChordId(id, transposeOffset) : id;
        const chord = getChordById(displayId) ?? getChordById(id);
        if (chord) out.push({ isCustom: false, chord, idx });
        else console.warn('[PDF] chord ID not found in DB:', id, '(transposed:', displayId, ')');
      }
    });
    return out;
  };

  const hasSections = !!(preset.sections && preset.sections.length > 0);
  const allIds = hasSections
    ? preset.sections!.flatMap(s => s.chords)
    : preset.chords;
  const entries = buildEntries(allIds);

  const safeName   = preset.name.replace(/[^a-zA-Z0-9 ]/g, '').trim().replace(/\s+/g, '_') || 'Song';
  const safeArtist = preset.artist.replace(/[^a-zA-Z0-9 ]/g, '').trim().replace(/\s+/g, '_');
  const autoTitle  = safeArtist ? `${safeName}_${safeArtist}` : safeName;
  const docTitle   = pdfName.trim()
    ? pdfName.trim().replace(/[^a-zA-Z0-9 _-]/g, '').replace(/\s+/g, '_')
    : autoTitle;

  /* Columns and SVG scale — auto-fit if not compact */
  const totalChords = entries.length;
  const isLandscape = cfg.orientation === 'landscape';

  let cols: number;
  let svgScale: number;

  if (compact) {
    cols     = isLandscape ? 4 : 3;
    svgScale = 0.78;
  } else {
    // Page dimensions in px (at 96 dpi, letter = 816×1056, a4 = 794×1122)
    const paper    = cfg.paperSize ?? 'a4';
    const PW_PX    = isLandscape ? (paper === 'letter' ? 1056 : 1122) : (paper === 'letter' ? 816 : 794);
    const PH_PX    = isLandscape ? (paper === 'letter' ? 816  : 794 ) : (paper === 'letter' ? 1056 : 1122);
    const BODY_PAD = isLandscape ? 60 : 80;   // top+bottom body padding px
    const HEADER_H = isLandscape ? 160 : 200; // approx header height px
    const AVAIL_H  = PH_PX - BODY_PAD - HEADER_H;
    const AVAIL_W  = PW_PX - (isLandscape ? 80 : 104);
    const GAP      = 20; // elegant gridGap px

    let chosenCols  = 3;
    let chosenScale = 1.35;

    for (let c = 3; c <= 6; c++) {
      const cardW = (AVAIL_W - (c - 1) * GAP) / c;
      const scale = Math.min(1.35, (cardW - 32) / 160);
      const svgH  = 180 * scale;
      // Card height: card vertical padding (40) + instr badge (20) + name (24) + diagMb (14) + notes (14) + type (12) + SVG
      const cardH = 40 + 20 + 24 + 14 + 14 + 12 + svgH;
      const rows  = Math.ceil(totalChords / c);
      const total = rows * cardH + (rows - 1) * GAP;
      if (total <= AVAIL_H || c === 6) {
        chosenCols  = c;
        chosenScale = Math.max(0.45, scale);
        break;
      }
    }

    cols     = chosenCols;
    svgScale = chosenScale;
  }

  /* ── Palette ── */
  const bg       = dark ? '#0c0c0c'                 : (elegant ? '#f6f5f2' : '#ffffff');
  const text     = dark ? '#edeae4'                 : '#0d0d0d';
  const sub      = dark ? '#8a8a8a'                 : '#5a5f6e';
  const muted    = dark ? '#4a4a4a'                 : '#a0a6b2';
  const divider  = dark ? 'rgba(255,255,255,0.07)'  : 'rgba(0,0,0,0.08)';
  const cardBg   = dark ? '#1a1a1a'                 : '#ffffff';
  const cardBdr  = dark ? 'rgba(255,255,255,0.07)'  : 'rgba(0,0,0,0.07)';
  const cardShad = dark ? 'none'
    : (elegant ? '0 1px 6px rgba(0,0,0,0.07),0 0 0 1px rgba(0,0,0,0.04)' : 'none');
  const notesTxt = dark ? '#5a5a5a'                 : '#a0a6b2';
  const typeTxt  = dark ? '#383838'                 : '#c8ccda';
  const numClr   = elegant ? accentColor            : (dark ? '#444' : '#c8ccda');

  /* ── Sizes & spacing ── */
  const bodyPad   = compact ? '20px 28px'       : '40px 52px';
  const titleSz   = compact ? '28px'            : '46px';
  const artistSz  = compact ? '12px'            : '16px';
  const chordNameSz = cfg.chordDisplay === 'name'
    ? (compact ? '26px' : '38px')
    : (compact ? '13px' : '20px');
  const cardPad   = compact ? '12px 9px 10px'   : '22px 16px 18px';
  const cardR     = compact ? '8px'             : '14px';
  const hdrPb     = compact ? '14px'            : '26px';
  const hdrMb     = compact ? '12px'            : '24px';
  const gridGap   = compact ? '8px 6px'         : '20px 14px';
  const diagMb    = compact ? '5px'             : '14px';

  /* ── Accent hex helpers ── */
  const accentA22 = accentColor + '22';
  const accentA44 = accentColor + '44';

  /* ── Badge style ── */
  const badgeStyle = elegant
    ? `display:inline-flex;align-items:center;padding:4px 13px;border-radius:100px;border:1.5px solid ${accentA44};background:${accentA22};color:${sub};font-size:${compact ? '9px' : '10px'};font-weight:700;letter-spacing:0.07em;text-transform:uppercase;`
    : `display:inline-flex;align-items:center;padding:3px 10px;border-radius:100px;border:1.5px solid ${divider};color:${sub};font-size:${compact ? '9px' : '10px'};font-weight:700;letter-spacing:0.06em;text-transform:uppercase;`;

  /* ── Title block ── */
  const titleInner = [
    cfg.includeTitle  ? `<h1 class="song-name">${preset.name}</h1>` : '',
    cfg.includeArtist && preset.artist ? `<p class="artist">${preset.artist}</p>` : '',
  ].join('');
  const titleBlock = cfg.includeTitle
    ? (elegant
        ? `<div style="border-left:4px solid ${accentColor};padding-left:14px;">${titleInner}</div>`
        : `<div>${titleInner}</div>`)
    : '';

  const badges = [
    cfg.includeKey && preset.key    ? `<span style="${badgeStyle}">Tonalidad de ${preset.key}</span>` : '',
    cfg.includeBPM && preset.bpm > 0 ? `<span style="${badgeStyle}">${preset.bpm} BPM</span>` : '',
  ].filter(Boolean).join('');

  const notesHtml = cfg.includeNotes && preset.notes
    ? `<p style="margin-top:10px;font-size:12px;color:${sub};font-style:italic;max-width:460px;line-height:1.55;">${preset.notes}</p>` : '';

  /* ── Section row ── */
  const pip = elegant
    ? `<span style="display:inline-block;width:5px;height:5px;border-radius:50%;background:${accentColor};margin-right:7px;flex-shrink:0;"></span>` : '';
  const chordCount = `${entries.length} acorde${entries.length !== 1 ? 's' : ''}`;

  /* ── Instrument badge helper ── */
  const INSTR_COLORS: Record<string, string> = {
    guitar:  accentColor,
    bass:    '#fb923c',
    piano:   '#c084fc',
  };
  const instrBadge = (instr: string) => {
    const c = INSTR_COLORS[instr] ?? accentColor;
    return `<div class="chord-instr" style="background:${c}1a;color:${c};border:1px solid ${c}44;">${instr.toUpperCase()}</div>`;
  };

  /* ── Chord block builder ── */
  const buildBlock = (entry: ChordEntry, i: number): string => {
    const numEl = cfg.showNumbering ? `<div class="chord-num">${i + 1}</div>` : '';
    if (entry.isCustom) {
      const cc = entry.customChord;
      const instr = cc.instrument ?? 'guitar';
      const nameEl = cfg.chordDisplay !== 'diagram'
        ? `<div class="chord-name">${cc.name || 'Custom'}</div>` : '';
      let diagEl = '';
      if (cfg.chordDisplay !== 'name') {
        if (cc.instrument === 'piano') {
          diagEl = `<div class="chord-diagram">${buildPrintPianoSVG(cc.pianoKeys ?? [], dark, accentColor, svgScale)}</div>`;
        } else {
          const frts = cc.frets ?? [];
          const activeFrets = frts.filter((f: number) => f > 0);
          const baseFret = activeFrets.length > 0 ? Math.min(...activeFrets) : 1;
          if (cc.instrument === 'guitar') {
            diagEl = `<div class="chord-diagram">${buildPrintSVG({ frets: frts, fingers: [], barres: cc.barres ?? [], baseFret }, dark, accentColor, svgScale)}</div>`;
          } else {
            diagEl = `<div class="chord-diagram">${buildPrintFretboardSVG(frts, baseFret, cc.barres ?? [], 4, dark, accentColor, svgScale)}</div>`;
          }
        }
      }
      return `<div class="chord-block">${numEl}${instrBadge(instr)}${nameEl}${diagEl}<div class="chord-notes">${cc.notes.slice(0, 6).join(' · ')}</div></div>`;
    }
    const chord = entry.chord;
    const nameEl = cfg.chordDisplay !== 'diagram' ? `<div class="chord-name">${chord.name}</div>` : '';
    const diagEl = cfg.chordDisplay !== 'name'
      ? `<div class="chord-diagram">${buildPrintSVG(chord.guitar, dark, accentColor, svgScale)}</div>` : '';
    return `<div class="chord-block">${numEl}${instrBadge('guitar')}${nameEl}${diagEl}<div class="chord-notes">${chord.notes.join(' · ')}</div><div class="chord-type">${chord.type.toUpperCase()}</div></div>`;
  };

  /* ── Chord content (flat grid or section groups) ── */
  const chordContent = hasSections
    ? preset.sections!.map(section => {
        const secEntries = buildEntries(section.chords);
        const blocks = secEntries.map((e, i) => buildBlock(e, i)).join('');
        return `
          <div class="section-group">
            <div class="section-heading">${section.name}</div>
            <div class="chord-grid">${blocks || '<p style="font-size:11px;color:' + muted + ';padding:8px 0;">Sin acordes</p>'}</div>
          </div>`;
      }).join('')
    : `<div class="chord-grid">${entries.map((e, i) => buildBlock(e, i)).join('')}</div>`;

  /* ── Full HTML ── */
  const html = `<!DOCTYPE html>
<html><head>
<meta charset="utf-8"><title>${docTitle}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{
  font-family:system-ui,-apple-system,'Segoe UI','Helvetica Neue',Arial,sans-serif;
  color:${text};background:${bg};padding:${bodyPad};
  -webkit-print-color-adjust:exact;print-color-adjust:exact;
}
.doc-header{
  display:flex;align-items:flex-start;justify-content:space-between;gap:20px;
  padding-bottom:${hdrPb};margin-bottom:${hdrMb};
  border-bottom:1px solid ${divider};
}
.song-name{
  font-size:${titleSz};font-weight:900;letter-spacing:-0.04em;
  line-height:1;color:${text};margin-bottom:6px;
}
.artist{font-size:${artistSz};font-weight:500;color:${sub};margin-top:4px;}
.meta-row{display:flex;flex-direction:column;gap:${compact ? '4px' : '5px'};margin-top:${compact ? '8px' : '12px'};}
.header-right{
  flex-shrink:0;text-align:right;padding-top:4px;
  font-size:10px;font-weight:700;color:${muted};
  letter-spacing:0.06em;text-transform:uppercase;white-space:nowrap;
}
.section-row{
  display:flex;align-items:center;justify-content:space-between;
  margin-bottom:${compact ? '10px' : '14px'};
}
.section-label{
  font-size:${compact ? '7px' : '8px'};font-weight:700;
  letter-spacing:0.24em;text-transform:uppercase;color:${muted};
  display:flex;align-items:center;
}
.chord-grid{
  display:grid;
  grid-template-columns:repeat(${cols},1fr);
  gap:${gridGap};
}
.chord-block{
  position:relative;background:${cardBg};
  border:1px solid ${cardBdr};border-radius:${cardR};
  box-shadow:${cardShad};padding:${cardPad};
  text-align:center;break-inside:avoid;page-break-inside:avoid;
}
.chord-num{
  position:absolute;top:6px;right:8px;
  font-size:11px;font-weight:800;color:${numClr};
  letter-spacing:0.04em;line-height:1;
}
.chord-name{
  font-size:${chordNameSz};font-weight:900;letter-spacing:-0.02em;
  color:${text};margin-bottom:${compact ? '6px' : '10px'};line-height:1;
}
.chord-diagram{display:flex;justify-content:center;margin-bottom:${diagMb};overflow:visible;}
.chord-diagram svg{max-width:100%;height:auto;overflow:visible;}
.chord-notes{font-size:${compact ? '8px' : '9px'};color:${notesTxt};letter-spacing:0.04em;margin-bottom:2px;}
.chord-type{font-size:${compact ? '7px' : '8px'};font-weight:700;color:${typeTxt};letter-spacing:0.18em;text-transform:uppercase;}
.chord-instr{display:inline-block;padding:${compact ? '1px 6px' : '2px 8px'};border-radius:9999px;font-size:${compact ? '6px' : '7px'};font-weight:800;letter-spacing:0.18em;text-transform:uppercase;margin-bottom:${compact ? '5px' : '8px'};}
.doc-footer{
  margin-top:${compact ? '16px' : '28px'};padding-top:10px;
  border-top:1px solid ${divider};
  display:flex;justify-content:space-between;align-items:center;
}
.footer-txt{font-size:9px;font-weight:600;color:${muted};letter-spacing:0.05em;}
.section-group{margin-bottom:${compact ? '18px' : '36px'};}
.section-heading{
  font-size:${compact ? '8px' : '11px'};font-weight:800;letter-spacing:0.22em;
  text-transform:uppercase;color:${accentColor};
  border-left:4px solid ${accentColor};padding-left:10px;
  margin-bottom:${compact ? '8px' : '16px'};padding-top:2px;padding-bottom:2px;
}
@media print{
  body{padding:${compact ? '12px 18px' : '24px 36px'};}
  @page{margin:0.8cm;size:${cfg.paperSize === 'letter' ? 'Letter' : 'A4'} ${cfg.orientation};}
  .chord-block{break-inside:avoid;}
  .section-group{break-inside:avoid-page;}
}
</style></head>
<body>
<div class="doc-header">
  <div>
    ${titleBlock}
    ${badges ? `<div class="meta-row">${badges}</div>` : ''}
    ${notesHtml}
  </div>
  <div class="header-right">${chordCount}</div>
</div>
<div class="section-row">
  <div class="section-label">${pip}${hasSections ? 'Secciones' : 'Progresión de acordes'}</div>
  <div class="section-label">${chordCount}</div>
</div>
${chordContent}
<div class="doc-footer">
  <span class="footer-txt">Chordex</span>
  <span class="footer-txt">${new Date().getFullYear()}</span>
</div>
</body></html>`;

  /* ── Export ─────────────────────────────────────────────────────────── */
  // Draw PDF with jsPDF on both native and web — only the save step differs.
  const isNative = Capacitor.isNativePlatform();
  try {
    const { jsPDF } = await import('jspdf');

      /* ── Page geometry ─────────────────────────────────────── */
      const paper   = cfg.paperSize ?? 'a4';
      const orientJ = cfg.orientation === 'landscape' ? 'l' : 'p';
      const isLand  = orientJ === 'l';
      // Physical page dimensions in mm
      const PW = isLand ? (paper === 'letter' ? 279.4 : 297) : (paper === 'letter' ? 215.9 : 210);
      const PH = isLand ? (paper === 'letter' ? 215.9 : 210) : (paper === 'letter' ? 279.4 : 297);

      const doc = new jsPDF({ unit: 'mm', format: paper, orientation: orientJ });

      /* ── Style theme ───────────────────────────────────────── */
      const dark    = cfg.theme === 'dark';
      const sty     = cfg.exportStyle ?? 'elegant';
      const compact = sty === 'compact';
      const elegant = sty === 'elegant';

      const hexRgb = (h: string): [number,number,number] => {
        const n = parseInt(h.replace('#',''), 16);
        return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
      };

      const C_BG      = dark ? '#0c0c0c' : (elegant ? '#f6f5f2' : '#ffffff');
      const C_CARD    = dark ? '#1c1c1c' : '#ffffff';
      const C_TEXT    = dark ? '#edeae4' : '#0d0d0d';
      const C_SUB     = dark ? '#8a8a8a' : '#5a5f6e';
      const C_MUTED   = dark ? '#555555' : '#a0a6b2';
      const C_BORDER  = dark ? '#2e2e2e' : (elegant ? '#e0ddd7' : '#e0e0e0');
      const C_DIVIDER = dark ? '#2a2a2a' : (elegant ? '#d8d5cf' : '#e0e0e0');
      const C_ACCENT  = accentColor;
      const C_BADGE_BG = dark ? '#1e1e1e' : (elegant ? '#eceae5' : '#f0f0f0');

      /* ── Margins ───────────────────────────────────────────── */
      const ML  = compact ? 10 : 14;
      const MR  = compact ? 10 : 14;
      const MT  = compact ? 10 : 13;
      const MB  = 10;
      const CW  = PW - ML - MR;

      /* ── Card layout — auto-fit all chords ─────────────────── */
      const CARD_GAP   = compact ? 3.5 : 5;
      const CARD_PAD_X = compact ? 2   : 3;
      const CARD_PAD_Y = compact ? 2.5 : 3.5;

      // Estimate header height in mm
      const hasTitle  = cfg.includeTitle && !!preset.name;
      const hasArtist = cfg.includeArtist && !!preset.artist;
      const hasBadges = (cfg.includeKey && !!preset.key) || (cfg.includeBPM && preset.bpm > 0);
      const HDR_H = (hasTitle ? (compact ? 7 : 9) : 0)
                  + (hasArtist ? (compact ? 5 : 6.5) : 0)
                  + (hasBadges ? (compact ? 6 : 7) : 0)
                  + (hasTitle || hasArtist ? (compact ? 3 : 5) : 0); // divider gap

      const hasName = cfg.chordDisplay !== 'diagram';
      const hasDiag = cfg.chordDisplay !== 'name';
      const NAME_H  = hasName ? (compact ? 4.5 : 5.5) : 0;

      const AVAIL_H = PH - MT - MB - HDR_H - 8; // 8mm footer

      // Find minimum cols that fits all chords on one page
      let bestCols = 3;
      for (let c = 3; c <= 6; c++) {
        const cardW = (CW - (c - 1) * CARD_GAP) / c;
        const diagW = cardW - 2 * CARD_PAD_X;
        const diagH = hasDiag ? diagW * (160 / 160) : 0;
        const cardH = 2 * CARD_PAD_Y + NAME_H + diagH + (compact ? 1.5 : 2);
        const rows  = Math.ceil(entries.length / c);
        const total = rows * cardH + (rows - 1) * CARD_GAP;
        bestCols = c;
        if (total <= AVAIL_H || c === 6) break;
      }

      const COLS   = bestCols;
      const CARD_W = (CW - (COLS - 1) * CARD_GAP) / COLS;
      const DIAG_W = CARD_W - 2 * CARD_PAD_X;
      const DIAG_H = hasDiag ? DIAG_W * (160 / 160) : 0;
      const CARD_H = 2 * CARD_PAD_Y + NAME_H + DIAG_H + (compact ? 1.5 : 2);

      /* ── Pre-render SVG diagrams → PNG data URLs ───────────── */
      // Convert mm size to pixels for the SVG builder (96 dpi)
      const PX_PER_MM = 96 / 25.4;
      const diagWpx   = Math.round(DIAG_W * PX_PER_MM);
      const diagHpx   = Math.round(DIAG_H * PX_PER_MM);
      const svgSc     = diagWpx / 160;

      const svgToPng = (svgStr: string): Promise<string> =>
        new Promise(resolve => {
          if (!svgStr) { resolve(''); return; }
          const RES = 3; // render at 3× for sharp PDF output
          const cv  = document.createElement('canvas');
          cv.width  = diagWpx * RES;
          cv.height = diagHpx * RES;
          const ctx = cv.getContext('2d');
          if (!ctx) { resolve(''); return; }
          const img = new Image();
          img.onload  = () => {
            ctx.scale(RES, RES);
            ctx.drawImage(img, 0, 0, diagWpx, diagHpx);
            resolve(cv.toDataURL('image/png'));
          };
          img.onerror = () => resolve('');
          // base64-encode the SVG to avoid blob-URL issues in Android WebView
          img.src = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svgStr)))}`;
        });

      type CardData = { name: string; png: string; notes: string; type: string; baseFret: number; showNut: boolean };

      const cards: CardData[] = await Promise.all(entries.map(async entry => {
        let name = '', svgStr = '', notes = '', type = '';
        let baseFret = 1, showNut = true;
        if (entry.isCustom) {
          const cc = entry.customChord;
          name = cc.name;
          if (cc.instrument === 'piano') {
            svgStr = buildPrintPianoSVG(cc.pianoKeys ?? [], dark, C_ACCENT, svgSc);
          } else {
            const frets = cc.frets ?? [];
            baseFret = frets.some(f => f > 4)
              ? Math.max(1, Math.min(...frets.filter(f => f > 0))) : 1;
            showNut = baseFret === 1;
            const strings = (cc.instrument === 'bass') ? 4 : 4;
            svgStr = cc.instrument === 'guitar'
              ? buildPrintSVG({ frets, fingers: [], barres: cc.barres ?? [], baseFret }, dark, C_ACCENT, svgSc, false)
              : buildPrintFretboardSVG(frets, baseFret, cc.barres ?? [], strings, dark, C_ACCENT, svgSc, false);
          }
        } else {
          const ch = entry.chord;
          name  = ch.name;
          notes = (ch.notes ?? []).join(' ');
          type  = ch.type ?? '';
          baseFret = ch.guitar.baseFret ?? 1;
          showNut  = baseFret === 1;
          svgStr = buildPrintSVG(ch.guitar, dark, C_ACCENT, svgSc, false);
        }
        const png = hasDiag ? await svgToPng(svgStr) : '';
        return { name, png, notes, type, baseFret, showNut };
      }));

      /* ── Draw helpers ──────────────────────────────────────── */
      const fillPage = () => {
        doc.setFillColor(...hexRgb(C_BG));
        doc.rect(0, 0, PW, PH, 'F');
      };

      const drawHeader = (): number => {
        let y = MT;
        if (hasTitle) {
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(compact ? 17 : 22);
          doc.setTextColor(...hexRgb(C_TEXT));
          doc.text(preset.name, ML, y + (compact ? 5 : 6.5));
          y += compact ? 7 : 9;
        }
        if (hasArtist) {
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(compact ? 9 : 11);
          doc.setTextColor(...hexRgb(C_SUB));
          doc.text(preset.artist, ML, y + 3.5);
          y += compact ? 5 : 6.5;
        }
        if (hasBadges) {
          const badges: string[] = [];
          if (cfg.includeKey && preset.key)    badges.push(`Key: ${preset.key}`);
          if (cfg.includeBPM && preset.bpm > 0) badges.push(`${preset.bpm} BPM`);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(7);
          doc.setTextColor(...hexRgb(C_ACCENT));
          let bx = ML;
          badges.forEach(b => {
            const bw = doc.getTextWidth(b) + 5;
            const bh = 4.5;
            doc.setFillColor(...hexRgb(C_BADGE_BG));
            doc.setDrawColor(...hexRgb(C_ACCENT));
            doc.setLineWidth(0.25);
            doc.roundedRect(bx, y, bw, bh, 1.5, 1.5, 'FD');
            doc.text(b, bx + 2.5, y + 3.1);
            bx += bw + 2;
          });
          y += compact ? 6 : 7;
        }
        // Divider
        if (hasTitle || hasArtist) {
          doc.setDrawColor(...hexRgb(C_DIVIDER));
          doc.setLineWidth(0.3);
          doc.line(ML, y + 1, PW - MR, y + 1);
          y += compact ? 3 : 5;
        }
        return y;
      };

      const drawCard = (card: CardData, col: number, rowStartY: number, num: number) => {
        const cx = ML + col * (CARD_W + CARD_GAP);
        const cy = rowStartY;

        // Card background
        doc.setFillColor(...hexRgb(C_CARD));
        if (elegant) {
          doc.setDrawColor(...hexRgb(C_BORDER));
          doc.setLineWidth(0.25);
          doc.roundedRect(cx, cy, CARD_W, CARD_H, 2, 2, 'FD');
        } else if (compact) {
          doc.roundedRect(cx, cy, CARD_W, CARD_H, 1.5, 1.5, 'F');
        }
        // minimal: no card background — just content on page bg

        let iy = cy + CARD_PAD_Y;

        // Chord number — top-right to match preview
        if (cfg.showNumbering) {
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(compact ? 6.5 : 7.5);
          doc.setTextColor(...hexRgb(C_MUTED));
          doc.text(String(num), cx + CARD_W - CARD_PAD_X, cy + (compact ? 3.5 : 4), { align: 'right' });
        }

        // Chord name
        if (hasName) {
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(compact ? 9 : 11);
          doc.setTextColor(...hexRgb(C_TEXT));
          doc.text(card.name, cx + CARD_W / 2, iy + (compact ? 3 : 3.8), { align: 'center', maxWidth: CARD_W - 2 });
          iy += NAME_H;
        }

        // Diagram
        if (hasDiag && card.png) {
          const imgX = cx + CARD_PAD_X;
          const imgY = iy;
          doc.addImage(card.png, 'PNG', imgX, imgY, DIAG_W, DIAG_H);
          iy += DIAG_H + 1;
        }

        // Notes (chord tones)
        if (card.notes) {
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(5.5);
          doc.setTextColor(...hexRgb(C_MUTED));
          doc.text(card.notes, cx + CARD_W / 2, iy + 1.8, { align: 'center', maxWidth: CARD_W - 1 });
        }
      };

      const drawFooter = (pageNum: number, totalPages: number) => {
        const fy = PH - MB + 3;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6.5);
        doc.setTextColor(...hexRgb(C_MUTED));
        doc.text('CHORDEX', ML, fy);
        if (totalPages > 1) {
          doc.text(`${pageNum} / ${totalPages}`, PW - MR, fy, { align: 'right' });
        }
      };

      /* ── Section heading helper ────────────────────────────── */
      const SECT_H = compact ? 6 : 8; // mm: heading + gap below

      const drawSectionHeading = (name: string, y: number) => {
        doc.setFillColor(...hexRgb(C_ACCENT));
        doc.rect(ML, y + 0.5, 0.8, compact ? 3 : 4, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(compact ? 6 : 7.5);
        doc.setTextColor(...hexRgb(C_ACCENT));
        doc.text(name.toUpperCase(), ML + 3, y + (compact ? 3 : 3.8));
      };

      /* ── Build flat draw-item list ──────────────────────────── */
      type DrawItem =
        | { type: 'section-header'; name: string }
        | { type: 'card'; data: CardData; num: number };

      const drawItems: DrawItem[] = [];

      if (hasSections) {
        let cardIdx = 0;
        preset.sections!.forEach(sec => {
          const secLen = buildEntries(sec.chords).length;
          drawItems.push({ type: 'section-header', name: sec.name });
          for (let i = 0; i < secLen; i++) {
            if (cardIdx < cards.length) {
              drawItems.push({ type: 'card', data: cards[cardIdx], num: i + 1 });
              cardIdx++;
            }
          }
        });
      } else {
        cards.forEach((card, i) => drawItems.push({ type: 'card', data: card, num: i + 1 }));
      }

      /* ── Simulate layout to count total pages ───────────────── */
      const AVAIL_BOTTOM = PH - MB - 8;
      const headerStartY = MT + HDR_H; // same Y that drawHeader() returns, without drawing
      const simTotalPages = (() => {
        let page = 1;
        let cy = headerStartY;
        let col = 0;

        const simBreak = (neededH: number) => {
          if (cy + neededH > AVAIL_BOTTOM) {
            if (col > 0) { cy += CARD_H + CARD_GAP; col = 0; }
            if (cy + neededH > AVAIL_BOTTOM) { page++; cy = MT; }
          }
        };

        for (const item of drawItems) {
          if (item.type === 'section-header') {
            if (col > 0) { cy += CARD_H + CARD_GAP; col = 0; }
            simBreak(SECT_H + CARD_H);
            cy += SECT_H;
          } else {
            if (col === 0) simBreak(CARD_H);
            col++;
            if (col >= COLS) { col = 0; cy += CARD_H + CARD_GAP; }
          }
        }
        return page;
      })();

      /* ── Paginate & draw (Y-cursor) ─────────────────────────── */
      fillPage();
      let cy       = drawHeader();
      let colIdx   = 0;
      let curPage  = 1;

      const pageBreakIfNeeded = (neededH: number) => {
        if (cy + neededH > AVAIL_BOTTOM) {
          if (colIdx > 0) { cy += CARD_H + CARD_GAP; colIdx = 0; }
          if (cy + neededH > AVAIL_BOTTOM) {
            drawFooter(curPage, simTotalPages);
            doc.addPage();
            fillPage();
            curPage++;
            cy = MT;
          }
        }
      };

      for (const item of drawItems) {
        if (item.type === 'section-header') {
          // Flush current partial row
          if (colIdx > 0) { cy += CARD_H + CARD_GAP; colIdx = 0; }
          // Ensure space for heading + at least one card row
          pageBreakIfNeeded(SECT_H + CARD_H);
          drawSectionHeading(item.name, cy);
          cy += SECT_H;
        } else {
          if (colIdx === 0) pageBreakIfNeeded(CARD_H);
          drawCard(item.data, colIdx, cy, item.num);
          colIdx++;
          if (colIdx >= COLS) { colIdx = 0; cy += CARD_H + CARD_GAP; }
        }
      }

      drawFooter(curPage, simTotalPages);

      /* ── Save & share ──────────────────────────────────────── */
      if (isNative) {
        const { Filesystem, Directory } = await import('@capacitor/filesystem');
        const pdfBase64 = doc.output('datauristring').split(',')[1];
        if (mode === 'save') {
          // Try public Downloads first, fall back to app-specific external.
          let savedOk = false;
          try {
            await Filesystem.writeFile({
              path: `Download/${docTitle}.pdf`,
              data: pdfBase64,
              directory: Directory.ExternalStorage,
              recursive: true,
            });
            savedOk = true;
          } catch {
            try {
              await Filesystem.writeFile({
                path: `${docTitle}.pdf`,
                data: pdfBase64,
                directory: Directory.External,
                recursive: true,
              });
              savedOk = true;
            } catch { /* both failed */ }
          }
          return savedOk;
        } else {
          try {
            const { Share } = await import('@capacitor/share');
            const writeResult = await Filesystem.writeFile({
              path: `${docTitle}.pdf`,
              data: pdfBase64,
              directory: Directory.Cache,
              recursive: true,
            });
            await Share.share({
              title: docTitle,
              url: writeResult.uri,
              dialogTitle: 'Share your chord sheet PDF',
            });
          } catch {
            // User cancelled — do nothing.
          }
          return true;
        }
      } else {
        // Web browser: download as PDF
        doc.save(`${docTitle}.pdf`);
        return true;
      }
  } catch {
    // PDF generation failed — do nothing.
  }
  return false;
}

/* ──────────────────── Chord Picker Sheet ──────────────────── */
const PICKER_CATS: { type: ChordType | 'all'; label: string }[] = [
  { type: 'all',     label: 'All'    },
  { type: 'major',   label: 'Major'  },
  { type: 'minor',   label: 'Minor'  },
  { type: '7th',     label: '7th'    },
  { type: 'maj7',    label: 'Maj7'   },
  { type: 'min7',    label: 'Min7'   },
  { type: 'dim',     label: 'Dim'    },
  { type: 'aug',     label: 'Aug'    },
  { type: 'sus2',    label: 'Sus2'   },
  { type: 'sus4',    label: 'Sus4'   },
  { type: '9th',     label: '9th'    },
  { type: 'maj9',    label: 'Maj9'   },
  { type: 'min9',    label: 'Min9'   },
  { type: 'add9',    label: 'Add9'   },
  { type: '6th',     label: '6th'    },
  { type: 'min6',    label: 'Min6'   },
  { type: 'halfdim', label: 'ø7'     },
  { type: 'dim7',    label: 'Dim7'   },
  { type: '11th',    label: '11th'   },
  { type: '13th',    label: '13th'   },
  { type: '7sus4',   label: '7sus4'  },
  { type: '7sus2',   label: '7sus2'  },
  { type: 'maj6',    label: 'Maj6'   },
  { type: 'power',   label: 'Power'  },
  { type: 'minmaj7', label: 'm/M7'   },
  { type: 'aug7',    label: 'Aug7'   },
  { type: '7b9',     label: '7b9'    },
  { type: '7s9',     label: '7#9'    },
  { type: '69',      label: '6/9'    },
  { type: '9sus4',   label: '9sus4'  },
];

/* ──────────────────── Preview Fretboard (inside paper card) ──────────────────── */
function PreviewFretboard({ data, dark }: { data: GuitarChordData; dark: boolean }) {
  const W = 86, H = 84, numS = 6, numF = 4;
  const pL = 10, pT = 14, pR = 10;
  const cW = (W - pL - pR) / (numS - 1);
  const cH = (H - pT - 10) / numF;
  const r = 4.5;
  const { frets, barres, baseFret } = data;
  const allPositive = frets.filter(f => f > 0);
  const minActive = allPositive.length ? Math.min(...allPositive) : 1;
  const minF = baseFret > 1 ? baseFret : Math.max(1, minActive);
  const showNut = minF <= 1;
  const dotFill   = dark ? '#e8e8e8' : '#191a1a';
  const lineFill  = dark ? 'rgba(200,200,200,0.18)' : 'rgba(25,26,26,0.15)';
  const nutFill   = dark ? '#ddd' : '#191a1a';

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
      {showNut && (
        <rect x={pL} y={pT - 5} width={(numS - 1) * cW} height={4} rx={1.5} fill={nutFill} />
      )}
      {!showNut && (
        <text x={pL - 3} y={pT + cH * 0.5} fontFamily="Arial" fontSize={8} fontWeight="700"
          fill={dark ? '#aaa' : '#777'} textAnchor="end" dominantBaseline="middle">
          {minF}
        </text>
      )}
      {Array.from({ length: numF + 1 }).map((_, i) => (
        <line key={i} x1={pL} y1={pT + i * cH} x2={pL + (numS - 1) * cW} y2={pT + i * cH}
          stroke={lineFill} strokeWidth={i === 0 && !showNut ? 1.5 : 1} />
      ))}
      {Array.from({ length: numS }).map((_, i) => (
        <line key={i} x1={pL + i * cW} y1={pT} x2={pL + i * cW} y2={pT + numF * cH}
          stroke={lineFill} strokeWidth={1} />
      ))}
      {barres.map((barre, bi) => {
        const fp = barre.fret - minF;
        if (fp < 0 || fp >= numF) return null;
        const x1 = pL + (numS - barre.fromString) * cW;
        const x2 = pL + (numS - barre.toString) * cW;
        const cy = pT + fp * cH + cH / 2;
        return (
          <rect key={`b-${bi}`} x={Math.min(x1, x2)} y={cy - r} width={Math.abs(x2 - x1)} height={r * 2} rx={r} fill={dotFill} />
        );
      })}
      {frets.map((f, si) => {
        if (f === -1) return (
          <text key={si} x={pL + si * cW} y={pT - 9} fontFamily="Arial" fontSize={10}
            fill={dark ? '#555' : '#ccc'} textAnchor="middle" dominantBaseline="middle" fontWeight="bold">×</text>
        );
        if (f === 0) return (
          <circle key={si} cx={pL + si * cW} cy={pT - 9} r={3.5}
            fill="none" stroke={dark ? '#555' : '#bbb'} strokeWidth={1.2} />
        );
        const fp = f - minF;
        if (fp < 0 || fp >= numF) return null;
        const stringNum = numS - si;
        const onBarre = barres.some(b => b.fret === f && stringNum >= b.toString && stringNum <= b.fromString);
        if (onBarre) return null;
        const cx = pL + si * cW, cy = pT + fp * cH + cH / 2;
        return <circle key={si} cx={cx} cy={cy} r={r} fill={dotFill} />;
      })}
    </svg>
  );
}

/* ──────────────────── Print-neutral custom chord diagram ──────────────────── */
function PreviewCustomDiagram({ chord, dark }: { chord: CustomChord; dark: boolean }) {
  const dotFill  = dark ? '#e8e8e8' : '#191a1a';
  const lineFill = dark ? 'rgba(200,200,200,0.18)' : 'rgba(25,26,26,0.15)';
  const nutFill  = dark ? '#ddd' : '#191a1a';

  if (chord.instrument === 'piano') {
    const keys = chord.pianoKeys ?? [];
    const W = 76, H = 44;
    const WHITE         = [0, 2, 4, 5, 7, 9, 11];
    const BLACK_CHROMAS = [1, 3, 6, 8, 10];
    const BLACK_POS     = [0.55, 1.55, 3.55, 4.55, 5.55];
    const wkW = W / 7, wkH = H;
    const bkW = wkW * 0.6, bkH = wkH * 0.58;
    return (
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
        {WHITE.map((chroma, i) => (
          <rect key={i} x={i * wkW + 0.5} y={0.5} width={wkW - 1} height={wkH - 1}
            rx={1.5}
            fill={keys.includes(chroma) ? dotFill : (dark ? '#333' : '#f8f8f8')}
            stroke={dark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.18)'} strokeWidth={0.5} />
        ))}
        {BLACK_POS.map((pos, i) => (
          <rect key={i} x={pos * wkW - bkW / 2} y={0.5} width={bkW} height={bkH}
            rx={1}
            fill={keys.includes(BLACK_CHROMAS[i]) ? dotFill : (dark ? '#888' : '#1a1a1a')} />
        ))}
      </svg>
    );
  }

  const numS   = chord.instrument === 'guitar' ? 6 : 4;
  const frets  = chord.frets ?? Array(numS).fill(0);
  const cBarres = chord.barres ?? [];
  const active = frets.filter(f => f > 0);
  const minActive = active.length > 0 ? Math.min(...active) : 1;

  const W = 86, H = 84, numF = 4;
  const pL = 10, pT = 14, pR = 10;
  const cW = (W - pL - pR) / (numS - 1);
  const cH = (H - pT - 10) / numF;
  const r = 4.5;
  const minF    = Math.max(1, minActive);
  const showNut = minF <= 1;

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
      {showNut && (
        <rect x={pL} y={pT - 5} width={(numS - 1) * cW} height={4} rx={1.5} fill={nutFill} />
      )}
      {!showNut && (
        <text x={pL - 3} y={pT + cH * 0.5} fontFamily="Arial" fontSize={8} fontWeight="700"
          fill={dark ? '#aaa' : '#777'} textAnchor="end" dominantBaseline="middle">
          {minF}
        </text>
      )}
      {Array.from({ length: numF + 1 }).map((_, i) => (
        <line key={i} x1={pL} y1={pT + i * cH} x2={pL + (numS - 1) * cW} y2={pT + i * cH}
          stroke={lineFill} strokeWidth={i === 0 && !showNut ? 1.5 : 1} />
      ))}
      {Array.from({ length: numS }).map((_, i) => (
        <line key={i} x1={pL + i * cW} y1={pT} x2={pL + i * cW} y2={pT + numF * cH}
          stroke={lineFill} strokeWidth={1} />
      ))}
      {cBarres.map((barre: { fret: number; fromString: number; toString: number }, bi: number) => {
        const fp = barre.fret - minF;
        if (fp < 0 || fp >= numF) return null;
        const x1 = pL + (numS - barre.fromString) * cW;
        const x2 = pL + (numS - barre.toString) * cW;
        const cy = pT + fp * cH + cH / 2;
        return (
          <rect key={`b-${bi}`} x={Math.min(x1, x2)} y={cy - r} width={Math.abs(x2 - x1)} height={r * 2} rx={r} fill={dotFill} />
        );
      })}
      {frets.map((f, si) => {
        if (f === -1) return (
          <text key={si} x={pL + si * cW} y={pT - 9} fontFamily="Arial" fontSize={10}
            fill={dark ? '#555' : '#ccc'} textAnchor="middle" dominantBaseline="middle" fontWeight="bold">×</text>
        );
        if (f === 0) return (
          <circle key={si} cx={pL + si * cW} cy={pT - 9} r={3.5}
            fill="none" stroke={dark ? '#555' : '#bbb'} strokeWidth={1.2} />
        );
        const fp = f - minF;
        if (fp < 0 || fp >= numF) return null;
        const stringNum = numS - si;
        const onBarre = cBarres.some((b: { fret: number; fromString: number; toString: number }) => b.fret === f && stringNum >= b.toString && stringNum <= b.fromString);
        if (onBarre) return null;
        const cx = pL + si * cW, cy = pT + fp * cH + cH / 2;
        return <circle key={si} cx={cx} cy={cy} r={r} fill={dotFill} />;
      })}
    </svg>
  );
}

/* ──────────────────── Paper Document Preview ──────────────────── */
function PaperPreview({ preset, cfg, accent, transposeOffset = 0, storedCustomChords = [] }: {
  preset: SongPreset;
  cfg: ExportConfig;
  accent: { from: string; to: string };
  transposeOffset?: number;
  storedCustomChords?: CustomChord[];
}) {
  const dark    = cfg.theme === 'dark';
  const style   = cfg.exportStyle ?? 'elegant';
  const compact = style === 'compact';
  const elegant = style === 'elegant';

  const hasSections = !!(preset.sections && preset.sections.length > 0);
  const isLand  = cfg.orientation === 'landscape';
  const paper   = cfg.paperSize ?? 'a4';

  /* Build ALL chord entries – handles both standard and custom chords */
  type PreviewEntry = { kind: 'standard'; chord: Chord } | { kind: 'custom'; cc: CustomChord };
  type PreviewSection = { name: string; entries: PreviewEntry[] };

  const buildPreviewEntries = (ids: string[]): PreviewEntry[] => {
    return ids.flatMap((id): PreviewEntry[] => {
      if (id.startsWith('custom-')) {
        const cc = storedCustomChords.find(c => c.id === id);
        return cc ? [{ kind: 'custom' as const, cc }] : [];
      }
      const displayId = transposeOffset !== 0 ? transposeChordId(id, transposeOffset) : id;
      const chord = getChordById(displayId) ?? getChordById(id);
      return chord ? [{ kind: 'standard' as const, chord }] : [];
    });
  };

  const previewSections: PreviewSection[] = hasSections
    ? preset.sections!.map(sec => ({ name: sec.name, entries: buildPreviewEntries(sec.chords) }))
    : [{ name: 'Progresión de acordes', entries: buildPreviewEntries(preset.chords) }];

  /* Auto-fit columns based on total chord count – same thresholds as jsPDF engine */
  const totalChords = previewSections.reduce((n, s) => n + s.entries.length, 0);
  const cols = totalChords <= 6 ? 3 : totalChords <= 12 ? 4 : totalChords <= 18 ? 5 : 6;

  /* Scale card visuals down as column count increases */
  const cardPad  = cols <= 3 ? '8px 5px 7px' : cols === 4 ? '5px 4px 5px' : cols === 5 ? '4px 3px 4px' : '3px 2px 3px';
  const cardFont = cols <= 3 ? '9px'  : cols === 4 ? '7px'  : cols === 5 ? '6px' : '5px';
  const gridGap  = cols <= 3 ? '7px 5px' : cols === 4 ? '5px 4px' : cols === 5 ? '4px 3px' : '3px 2px';

  const bg        = dark ? '#0e0e0e' : (elegant ? '#f5f4f1' : '#ffffff');
  const paperColor = dark ? '#181818' : '#ffffff';
  const text    = dark ? '#edeae4' : '#0d0d0d';
  const sub     = dark ? '#888'    : '#5a5f6e';
  const muted   = dark ? '#484848' : '#a0a6b2';
  const divider = dark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.08)';
  const cardBdr = dark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)';
  const cardShad = dark ? 'none' : (elegant ? '0 1px 4px rgba(0,0,0,0.07)' : 'none');
  const accentC = accent.from;

  return (
    <div style={{
      background: bg,
      borderRadius: '8px',
      boxShadow: dark
        ? '0 32px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04)'
        : '0 32px 80px rgba(0,0,0,0.22), 0 2px 8px rgba(0,0,0,0.08)',
      padding: compact ? '18px 16px' : '22px 18px',
      color: text,
      fontFamily: 'Manrope, sans-serif',
      display: 'flex',
      flexDirection: 'column',
      width: '100%',
      aspectRatio: isLand
        ? (paper === 'letter' ? '1.294 / 1' : '1.414 / 1')
        : (paper === 'letter' ? '1 / 1.294' : '1 / 1.414'),
      overflow: 'hidden',
      transition: 'background 300ms ease, box-shadow 300ms ease',
    }}>

      {/* Document header */}
      {cfg.includeTitle && (
        <div style={{
          borderBottom: `1px solid ${divider}`,
          paddingBottom: compact ? '10px' : '14px',
          marginBottom: compact ? '10px' : '14px',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: '8px',
        }}>
          <div style={elegant ? { borderLeft: `3px solid ${accentC}`, paddingLeft: '8px' } : {}}>
            <p style={{ fontSize: compact ? '15px' : '20px', fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1, color: text }}>
              {preset.name || 'Untitled Song'}
            </p>
            {cfg.includeArtist && preset.artist && (
              <p style={{ fontSize: compact ? '7px' : '9px', fontWeight: 500, color: sub, marginTop: '3px' }}>
                {preset.artist}
              </p>
            )}
            <div style={{ display: 'flex', gap: '4px', marginTop: '6px', flexWrap: 'wrap' }}>
              {cfg.includeKey && preset.key && (
                <span style={{
                  padding: '2px 7px', borderRadius: '100px', fontSize: '6px', fontWeight: 700,
                  letterSpacing: '0.06em', textTransform: 'uppercase',
                  border: elegant ? `1px solid ${accentC}44` : `1px solid ${divider}`,
                  background: elegant ? `${accentC}18` : 'transparent',
                  color: sub,
                }}>Key {preset.key}</span>
              )}
              {cfg.includeBPM && preset.bpm > 0 && (
                <span style={{
                  padding: '2px 7px', borderRadius: '100px', fontSize: '6px', fontWeight: 700,
                  letterSpacing: '0.06em', textTransform: 'uppercase',
                  border: elegant ? `1px solid ${accentC}44` : `1px solid ${divider}`,
                  background: elegant ? `${accentC}18` : 'transparent',
                  color: sub,
                }}>{preset.bpm} BPM</span>
              )}
            </div>
          </div>
          <p style={{ fontSize: '6px', fontWeight: 700, color: muted, letterSpacing: '0.05em', textTransform: 'uppercase', whiteSpace: 'nowrap', paddingTop: '2px' }}>
            {previewSections.reduce((n, s) => n + s.entries.length, 0)} chords
          </p>
        </div>
      )}

      {/* Section(s) + chord grid */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: hasSections ? (compact ? '8px' : '12px') : 0 }}>
        {previewSections.map((sec, sIdx) => (
          <div key={sIdx}>
            {/* Section heading or "Chord Progression" label */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: compact ? '5px' : '7px' }}>
              {hasSections
                ? <div style={{ borderLeft: `2px solid ${accentC}`, paddingLeft: '4px' }}>
                    <p style={{ fontSize: '6px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.22em', color: accentC, lineHeight: 1 }}>{sec.name}</p>
                  </div>
                : <>
                    {elegant && <span style={{ display: 'inline-block', width: '4px', height: '4px', borderRadius: '50%', background: accentC, flexShrink: 0 }} />}
                    <p style={{ fontSize: '6px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.22em', color: muted }}>Progresión de acordes</p>
                  </>
              }
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${cols}, 1fr)`,
              gap: gridGap,
            }}>
              {sec.entries.map((entry, i) => {
                const entryKey = entry.kind === 'standard' ? entry.chord.id : entry.cc.id;
                const entryName = entry.kind === 'standard' ? entry.chord.name : (entry.cc.name || 'Custom');
                return (
                  <div key={entryKey} style={{
                    position: 'relative',
                    background: paperColor,
                    border: `1px solid ${cardBdr}`,
                    borderRadius: cols >= 5 ? '4px' : compact ? '5px' : '7px',
                    boxShadow: cardShad,
                    padding: cardPad,
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                  }}>
                    {cfg.showNumbering && (
                      <span style={{ position: 'absolute', top: '4px', right: '6px', fontSize: '9px', fontWeight: 800, color: elegant ? accentC : muted, lineHeight: 1 }}>
                        {i + 1}
                      </span>
                    )}
                    {cfg.chordDisplay !== 'diagram' && (
                      <p style={{ fontSize: cardFont, fontWeight: 900, letterSpacing: '-0.01em', color: text, marginBottom: '2px', lineHeight: 1 }}>
                        {entryName}
                      </p>
                    )}
                    {cfg.chordDisplay !== 'name' && entry.kind === 'standard' && (
                      <PreviewFretboard data={entry.chord.guitar} dark={dark} />
                    )}
                    {cfg.chordDisplay !== 'name' && entry.kind === 'custom' && (
                      <PreviewCustomDiagram chord={entry.cc} dark={dark} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div style={{ marginTop: 'auto', paddingTop: compact ? '7px' : '10px', borderTop: `1px solid ${divider}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <p style={{ fontSize: '5px', fontWeight: 700, color: muted, letterSpacing: '0.05em' }}>Chordex</p>
        <p style={{ fontSize: '5px', color: muted, letterSpacing: '0.04em' }}>Page 1 of 1</p>
      </div>
    </div>
  );
}

/* ──────────────────── Export Config Modal ──────────────────── */
function ExportModal({ preset, accent, onClose, transposeOffset = 0, storedCustomChords = [] }: {
  preset: SongPreset;
  accent: { from: string; to: string };
  onClose: () => void;
  transposeOffset?: number;
  storedCustomChords?: CustomChord[];
}) {
  const t = useT();
  const [cfg, setCfg] = useState<ExportConfig>({ ...DEFAULT_EXPORT_CONFIG });
  const [pdfName, setPdfName] = useState('');
  const [savingPDF, setSavingPDF] = useState(false);
  const [sharingPDF, setSharingPDF] = useState(false);
  const [closing, setClosing] = useState(false);
  const [saveResult, setSaveResult] = useState<'ok' | 'fail' | null>(null);
  const isNative = typeof window !== 'undefined' && !!(window as any).Capacitor?.isNativePlatform?.();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [barVisible, setBarVisible] = useState(true);
  const lastScrollTop = useRef(0);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      const sy = el.scrollTop;
      setBarVisible(sy <= lastScrollTop.current || sy < 50);
      lastScrollTop.current = sy;
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  const update = <K extends keyof ExportConfig>(key: K, val: ExportConfig[K]) =>
    setCfg(prev => ({ ...prev, [key]: val }));

  const handleClose = () => {
    setClosing(true);
    setTimeout(onClose, 320);
  };

  const handleExport = async (mode: 'save' | 'share' = 'share') => {
    if (mode === 'save') setSavingPDF(true);
    else setSharingPDF(true);
    await new Promise(r => setTimeout(r, 80));
    try {
      const result = await exportPresetToPDF(preset, cfg, transposeOffset, storedCustomChords, accent.from, pdfName, mode);
      if (mode === 'save') {
        setSaveResult(result === true ? 'ok' : 'fail');
        setTimeout(() => setSaveResult(null), 3000);
      } else {
        handleClose();
      }
    } finally {
      if (mode === 'save') setSavingPDF(false);
      else setSharingPDF(false);
    }
  };

  /* iOS-style toggle */
  const Toggle = ({ on, onChange }: { on: boolean; onChange: () => void }) => (
    <button
      onClick={onChange}
      className="btn-smooth"
      style={{
        width: '44px', height: '26px', borderRadius: '13px', flexShrink: 0, position: 'relative',
        background: on ? `linear-gradient(135deg, ${accent.from}, ${accent.to})` : 'rgba(72,72,72,0.25)',
        transition: 'background 220ms ease',
      }}
    >
      <div style={{
        position: 'absolute', top: '3px',
        left: on ? '21px' : '3px',
        width: '20px', height: '20px', borderRadius: '10px',
        background: '#fff',
        boxShadow: '0 1px 4px rgba(0,0,0,0.35)',
        transition: 'left 220ms cubic-bezier(0.34,1.56,0.64,1)',
      }} />
    </button>
  );

  /* Segmented control */
  const Segment = <T extends string>({ options, value, onChange }: {
    options: { value: T; label: string }[];
    value: T;
    onChange: (v: T) => void;
  }) => (
    <div style={{ display: 'flex', background: 'var(--app-surface)', borderRadius: '10px', padding: '3px', gap: '2px' }}>
      {options.map(opt => {
        const active = value === opt.value;
        return (
          <button key={opt.value} onClick={() => onChange(opt.value)} className="btn-smooth"
            style={{
              flex: 1, padding: '6px 10px', borderRadius: '7px', fontFamily: 'Manrope',
              fontWeight: 700, fontSize: '11px', whiteSpace: 'nowrap',
              background: active ? 'var(--app-surface-highest)' : 'transparent',
              color: active ? 'var(--c-text-primary)' : 'var(--c-text-secondary)',
              boxShadow: active ? '0 1px 4px rgba(0,0,0,0.18)' : 'none',
              transition: 'all 160ms ease',
            }}>
            {opt.label}
          </button>
        );
      })}
    </div>
  );

  /* Settings row */
  const Row = ({ label, sub, right }: { label: string; sub?: string; right: React.ReactNode }) => (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '14px 16px', background: 'var(--app-surface-high)', borderRadius: '14px',
    }}>
      <div>
        <p style={{ fontFamily: 'Manrope', fontWeight: 600, fontSize: '14px', color: 'var(--c-text-primary)' }}>{label}</p>
        {sub && <p style={{ fontFamily: 'Inter', fontSize: '11px', color: 'var(--c-text-secondary)', marginTop: '1px' }}>{sub}</p>}
      </div>
      {right}
    </div>
  );

  const totalChordCount = preset.sections?.length
    ? preset.sections.reduce((n, s) => n + s.chords.length, 0)
    : preset.chords.length;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: '#0e0e0e',
      display: 'flex', flexDirection: 'column',
      animation: closing
        ? 'sheet-down 320ms cubic-bezier(0.25, 0.46, 0.45, 0.94) both'
        : 'sheet-up 340ms cubic-bezier(0.25, 0.46, 0.45, 0.94) both',
    }}>

      {/* ── Header ── */}
      <div style={{
        paddingTop: 'env(safe-area-inset-top)',
        background: '#191a1a',
        flexShrink: 0,
        borderBottom: '1px solid rgba(255,255,255,0.05)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', height: '56px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <button onClick={handleClose} className="btn-smooth"
              style={{ width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', flexShrink: 0 }}>
              <span className="material-symbols-outlined" style={{ color: accent.from, fontSize: '22px' }}>arrow_back</span>
            </button>
            <p style={{ fontFamily: 'Manrope', fontWeight: 800, fontSize: '14px', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#e7e5e4', lineHeight: 1 }}>
              Vista previa
            </p>
          </div>
          <span style={{ fontFamily: 'Inter', fontSize: '10px', fontWeight: 700, color: '#484848', letterSpacing: '0.06em', textTransform: 'uppercase', padding: '3px 8px', borderRadius: '6px', border: '1px solid rgba(72,72,72,0.3)' }}>
            PDF
          </span>
        </div>
      </div>

      {/* ── Scrollable body ── */}
      <div
        ref={scrollRef}
        className="no-scrollbar"
        style={{ flex: 1, overflowY: 'auto', paddingBottom: 'var(--content-bottom-pad)' }}
      >
        {/* Paper stage */}
        <div style={{
          padding: '32px 24px 28px',
          background: '#0a0a0a',
          position: 'relative',
        }}>
          <div style={{
            position: 'absolute', inset: 0, opacity: 0.1, pointerEvents: 'none',
            backgroundImage: 'radial-gradient(#555 1px, transparent 1px)',
            backgroundSize: '28px 28px',
          }} />
          <div style={{ position: 'relative', zIndex: 1 }}>
            <PaperPreview preset={preset} cfg={cfg} accent={accent} transposeOffset={transposeOffset} storedCustomChords={storedCustomChords} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px', marginTop: '14px' }}>
            <span style={{ fontFamily: 'Inter', fontSize: '10px', fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#3a3a3a' }}>
              Página 1 de 1
            </span>
            <span style={{ width: '3px', height: '3px', borderRadius: '50%', background: '#3a3a3a', display: 'inline-block' }} />
            <span style={{ fontFamily: 'Inter', fontSize: '10px', fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#3a3a3a' }}>
              {totalChordCount} {totalChordCount === 1 ? 'acorde' : 'acordes'}
            </span>
          </div>
        </div>

        {/* File name + notes */}
        <div style={{ padding: '28px 20px 8px' }}>
          <p style={{ fontFamily: 'Inter', fontSize: '10px', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#484848', marginBottom: '10px' }}>
            File Name
          </p>
          <input
            type="text"
            value={pdfName}
            onChange={e => setPdfName(e.target.value)}
            placeholder={preset.name || 'Song'}
            maxLength={80}
            style={{
              width: '100%', padding: '13px 16px', borderRadius: '12px',
              background: '#191a1a',
              border: '1px solid rgba(72,72,72,0.25)',
              color: '#e7e5e4', fontFamily: 'Manrope', fontWeight: 600, fontSize: '15px',
              outline: 'none', boxSizing: 'border-box',
              transition: 'border-color 200ms ease',
              marginBottom: '16px',
            }}
          />

          {/* PDF personalization options */}
          <div style={{ display: 'flex', gap: '7px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '20px' }}>

            {/* Paper size */}
            <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', padding: '2px', gap: '1px' }}>
              {(['a4', 'letter'] as const).map(v => {
                const active = (cfg.paperSize ?? 'a4') === v;
                return (
                  <button key={v} onClick={() => update('paperSize', v)} className="btn-smooth"
                    style={{ padding: '5px 11px', borderRadius: '6px', fontFamily: 'Inter', fontWeight: 700, fontSize: '10px', letterSpacing: '0.05em', textTransform: 'uppercase',
                      background: active ? accent.from : 'transparent',
                      color: active ? '#fff' : '#6e6e80',
                      transition: 'all 160ms ease' }}>
                    {v === 'a4' ? 'A4' : 'US'}
                  </button>
                );
              })}
            </div>

            {/* Orientation */}
            <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', padding: '2px', gap: '1px' }}>
              {([['portrait', 'Port'] as const, ['landscape', 'Land'] as const]).map(([v, lbl]) => {
                const active = cfg.orientation === v;
                return (
                  <button key={v} onClick={() => update('orientation', v)} className="btn-smooth"
                    style={{ padding: '5px 11px', borderRadius: '6px', fontFamily: 'Inter', fontWeight: 700, fontSize: '10px', letterSpacing: '0.05em',
                      background: active ? accent.from : 'transparent',
                      color: active ? '#fff' : '#6e6e80',
                      transition: 'all 160ms ease' }}>
                    {lbl}
                  </button>
                );
              })}
            </div>

            {/* Export style */}
            <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', padding: '2px', gap: '1px' }}>
              {([['minimal', 'Min'] as const, ['elegant', 'Ele'] as const, ['compact', 'Cmp'] as const]).map(([v, lbl]) => {
                const active = (cfg.exportStyle ?? 'elegant') === v;
                return (
                  <button key={v} onClick={() => update('exportStyle', v as ExportConfig['exportStyle'])} className="btn-smooth"
                    style={{ padding: '5px 11px', borderRadius: '6px', fontFamily: 'Inter', fontWeight: 700, fontSize: '10px', letterSpacing: '0.05em',
                      background: active ? 'rgba(255,255,255,0.12)' : 'transparent',
                      color: active ? '#e7e5e4' : '#6e6e80',
                      transition: 'all 160ms ease' }}>
                    {lbl}
                  </button>
                );
              })}
            </div>

            {/* Dark theme chip */}
            <button onClick={() => update('theme', cfg.theme === 'dark' ? 'light' : 'dark')} className="btn-smooth"
              style={{ padding: '5px 12px', borderRadius: '8px', fontFamily: 'Inter', fontWeight: 700, fontSize: '10px', letterSpacing: '0.05em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '5px',
                background: cfg.theme === 'dark' ? 'rgba(255,255,255,0.09)' : 'rgba(255,255,255,0.04)',
                color: cfg.theme === 'dark' ? '#e7e5e4' : '#6e6e80',
                border: cfg.theme === 'dark' ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(255,255,255,0.04)',
                transition: 'all 160ms ease' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '13px', fontVariationSettings: cfg.theme === 'dark' ? "'FILL' 1" : "'FILL' 0" }}>dark_mode</span>
              Dark
            </button>

            {/* Diagrams chip */}
            <button onClick={() => update('chordDisplay', cfg.chordDisplay !== 'name' ? 'name' : 'both')} className="btn-smooth"
              style={{ padding: '5px 12px', borderRadius: '8px', fontFamily: 'Inter', fontWeight: 700, fontSize: '10px', letterSpacing: '0.05em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '5px',
                background: cfg.chordDisplay !== 'name' ? `${accent.from}20` : 'rgba(255,255,255,0.04)',
                color: cfg.chordDisplay !== 'name' ? accent.from : '#6e6e80',
                border: cfg.chordDisplay !== 'name' ? `1px solid ${accent.from}2e` : '1px solid rgba(255,255,255,0.04)',
                transition: 'all 160ms ease' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '13px', fontVariationSettings: cfg.chordDisplay !== 'name' ? "'FILL' 1" : "'FILL' 0" }}>grid_view</span>
              Diagrams
            </button>
          </div>

          <div style={{
            padding: '14px 16px', borderRadius: '12px',
            background: `${accent.from}0d`,
            border: `1px solid ${accent.from}18`,
            display: 'flex', gap: '10px', alignItems: 'flex-start',
          }}>
            <span className="material-symbols-outlined" style={{ color: accent.from, fontSize: '15px', flexShrink: 0, marginTop: '1px', fontVariationSettings: "'FILL' 1" }}>info</span>
            <p style={{ fontFamily: 'Inter', fontSize: '12px', color: '#6e6e80', lineHeight: 1.55, margin: 0 }}>
              {t.songs.pdfExportNote}
            </p>
          </div>
        </div>
      </div>

      {/* ── Floating bottom bar ── */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 300,
        transform: barVisible ? 'translateY(0)' : 'translateY(110%)',
        transition: 'transform 300ms cubic-bezier(0.4, 0, 0.2, 1)',
        background: 'rgba(15,15,15,0.94)',
        backdropFilter: 'blur(28px)',
        WebkitBackdropFilter: 'blur(28px)',
        borderTop: '1px solid rgba(255,255,255,0.06)',
      }}>
        {/* Export button */}
        <div style={{ padding: '6px 16px', paddingBottom: 'max(20px, env(safe-area-inset-bottom))', display: 'flex', gap: '10px', position: 'relative' }}>
          {saveResult && (
            <div style={{ position: 'absolute', bottom: '100%', left: 0, right: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '6px', fontFamily: 'Manrope', fontWeight: 700, fontSize: '12px',
              color: saveResult === 'ok' ? '#34d399' : '#f87171' }}>
              {saveResult === 'ok' && (
                <SuccessLottie size={20} isLight={false} style={{ flexShrink: 0 }} />
              )}
              {saveResult === 'ok' ? 'Saved to Downloads!' : 'Could not save — try Share instead'}
            </div>
          )}
          {isNative ? (
            <>
              <AnimatedActionButton
                onClick={() => handleExport('save')}
                disabled={savingPDF || sharingPDF}
                className="btn-smooth"
                wrapStyle={{ flex: 1 }}
                trailColor={accent.to}
                style={{ padding: '14px', fontFamily: 'Manrope', fontWeight: 800, fontSize: '14px', color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  background: (savingPDF || sharingPDF) ? 'rgba(72,72,72,0.3)' : `linear-gradient(135deg,${accent.from},${accent.to})`,
                  boxShadow: (savingPDF || sharingPDF) ? 'none' : `0 4px 20px ${accent.to}40`,
                  transition: 'all 200ms ease' }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '17px', fontVariationSettings: "'FILL' 1" }}>
                  {savingPDF ? 'hourglass_empty' : 'save'}
                </span>
                {savingPDF ? t.songs.generatingPdf : 'Save'}
              </AnimatedActionButton>
              <button onClick={() => handleExport('share')} disabled={savingPDF || sharingPDF} className="btn-smooth"
                style={{ flex: 1, padding: '14px', borderRadius: '9999px', fontFamily: 'Manrope', fontWeight: 800, fontSize: '14px',
                  color: accent.from, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  background: 'rgba(255,255,255,0.06)', transition: 'all 200ms ease' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '17px', fontVariationSettings: "'FILL' 1" }}>
                  {sharingPDF ? 'hourglass_empty' : 'share'}
                </span>
                {sharingPDF ? t.songs.generatingPdf : 'Share'}
              </button>
            </>
          ) : (
            <AnimatedActionButton
              onClick={() => handleExport('share')}
              disabled={sharingPDF}
              className="btn-smooth"
              wrapStyle={{ flex: 1 }}
              trailColor={accent.to}
              style={{ padding: '15px', fontFamily: 'Manrope', fontWeight: 800, fontSize: '15px', color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                background: sharingPDF ? 'rgba(72,72,72,0.3)' : `linear-gradient(135deg,${accent.from},${accent.to})`,
                boxShadow: sharingPDF ? 'none' : `0 4px 24px ${accent.to}40`,
                transition: 'all 200ms ease' }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '19px', fontVariationSettings: "'FILL' 1" }}>
                {sharingPDF ? 'hourglass_empty' : 'download'}
              </span>
              {sharingPDF ? t.songs.generatingPdf : t.songs.downloadPdf}
            </AnimatedActionButton>
          )}
        </div>
      </div>
    </div>
  );
}

/* ──────────────────── JSON Export ──────────────────── */
export interface ChordexJsonFile {
  _app: 'Chordex';
  _version: 1;
  songName: string;
  artist: string;
  bpm: number;
  key: string;
  notes: string;
  chords: { name: string; position: number }[];
}

async function exportPresetToJSON(preset: SongPreset, mode: 'save' | 'share' = 'share'): Promise<boolean> {
  logActivity('export', `Exported ${preset.name} to JSON`, 'Chordex');
  const idToName = new Map(getAllChords().map(c => [c.id, c.name]));
  const file: ChordexJsonFile = {
    _app: 'Chordex',
    _version: 1,
    songName: preset.name,
    artist: preset.artist,
    bpm: preset.bpm,
    key: preset.key,
    notes: preset.notes,
    chords: preset.chords.map((id, i) => ({
      name: idToName.get(id) ?? id,
      position: i + 1,
    })),
  };
  const content = JSON.stringify(file, null, 2);
  const fileName = `${preset.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.json`;

  if (Capacitor.isNativePlatform()) {
    const { Filesystem, Directory } = await import('@capacitor/filesystem');
    // Reliable UTF-8 → base64 encoding
    const bytes = new TextEncoder().encode(content);
    const binary = Array.from(bytes, b => String.fromCharCode(b)).join('');
    const base64 = btoa(binary);

    if (mode === 'save') {
      // Try public Downloads first, fall back to app-specific external.
      let savedOk = false;
      try {
        await Filesystem.writeFile({ path: `Download/${fileName}`, data: base64, directory: Directory.ExternalStorage, recursive: true });
        savedOk = true;
      } catch {
        try {
          await Filesystem.writeFile({ path: fileName, data: base64, directory: Directory.External, recursive: true });
          savedOk = true;
        } catch { /* both failed */ }
      }
      return savedOk;
    } else {
      try {
        const { Share } = await import('@capacitor/share');
        const cacheResult = await Filesystem.writeFile({ path: fileName, data: base64, directory: Directory.Cache, recursive: true });
        await Share.share({ title: preset.name, url: cacheResult.uri, dialogTitle: 'Share your Chordex song' });
      } catch { /* User cancelled or share unavailable */ }
      return true;
    }
  }

  // Web browser fallback: anchor download
  const blob = new Blob([content], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}

/* ──────────────────── JSON Export Action Sheet ──────────────────── */
function JsonExportSheet({ preset, accent, onClose }: {
  preset: SongPreset;
  accent: { from: string; to: string };
  onClose: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [saveResult, setSaveResult] = useState<'ok' | 'fail' | null>(null);
  const [closing, setClosing] = useState(false);

  const dismiss = () => { setClosing(true); setTimeout(onClose, 280); };

  const handleSave = async () => {
    setSaving(true);
    try {
      const ok = await exportPresetToJSON(preset, 'save');
      setSaveResult(ok ? 'ok' : 'fail');
      setTimeout(() => setSaveResult(null), 3000);
    } finally {
      setSaving(false);
    }
  };

  const handleShare = async () => {
    setSharing(true);
    try {
      await exportPresetToJSON(preset, 'share');
      dismiss();
    } finally {
      setSharing(false);
    }
  };

  return (
    <div
      onClick={dismiss}
      style={{
        position: 'fixed', inset: 0, zIndex: 300,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'flex-end',
        animation: closing ? 'fadeOut 280ms ease forwards' : 'fadeIn 200ms ease forwards',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%',
          background: 'var(--app-bg)',
          borderRadius: '20px 20px 0 0',
          padding: '20px 20px',
          paddingBottom: 'max(24px, env(safe-area-inset-bottom))',
          display: 'flex', flexDirection: 'column', gap: '12px',
          animation: closing ? 'slideDown 280ms ease forwards' : 'slideUp 280ms ease forwards',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
          <div>
            <p style={{ fontFamily: 'Manrope', fontWeight: 800, fontSize: '16px', color: 'var(--c-text-primary)' }}>Export JSON</p>
            <p style={{ fontFamily: 'Inter', fontSize: '12px', color: 'var(--c-text-secondary)', marginTop: '2px' }}>{preset.name}</p>
          </div>
          <button onClick={dismiss} className="btn-smooth"
            style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--app-surface-high)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'var(--c-text-secondary)' }}>close</span>
          </button>
        </div>

        {/* Result message */}
        {saveResult && (
          <div style={{
            textAlign: 'center', fontFamily: 'Manrope', fontWeight: 700, fontSize: '13px', padding: '4px 0',
            color: saveResult === 'ok' ? '#34d399' : '#f87171',
          }}>
            {saveResult === 'ok' ? 'Saved to Downloads!' : 'Could not save — try Share instead'}
          </div>
        )}

        {/* Save to Device */}
        <button
          onClick={handleSave}
          disabled={saving || sharing}
          className="btn-smooth"
          style={{
            width: '100%', padding: '16px', borderRadius: '9999px',
            fontFamily: 'Manrope', fontWeight: 800, fontSize: '15px',
            color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
            background: (saving || sharing) ? 'rgba(72,72,72,0.3)' : `linear-gradient(135deg, ${accent.from}, ${accent.to})`,
            boxShadow: (saving || sharing) ? 'none' : `0 6px 24px ${accent.to}50`,
            transition: 'all 200ms ease',
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '20px', fontVariationSettings: "'FILL' 1" }}>
            {saving ? 'hourglass_empty' : 'save'}
          </span>
          {saving ? 'Saving…' : 'Save to Device'}
        </button>

        {/* Share */}
        <button
          onClick={handleShare}
          disabled={saving || sharing}
          className="btn-smooth"
          style={{
            width: '100%', padding: '16px', borderRadius: '9999px',
            fontFamily: 'Manrope', fontWeight: 800, fontSize: '15px',
            color: accent.from, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
            background: 'var(--app-surface-high)',
            transition: 'all 200ms ease',
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '20px', fontVariationSettings: "'FILL' 1" }}>
            {sharing ? 'hourglass_empty' : 'share'}
          </span>
          {sharing ? 'Opening…' : 'Share'}
        </button>
      </div>
    </div>
  );
}

function resolveChordId(name: string): string | null {
  const allChords = getAllChords();
  const norm = (s: string) => s.trim().toLowerCase().replace(/\s/g, '');
  const n = norm(name);
  // Exact normalized match
  const exact = allChords.find(c => norm(c.name) === n);
  if (exact) return exact.id;
  // Common aliases: "Am" → "A-minor", "Bb" → "Bb-major", "F#m" → "F#-minor"
  const aliases: Record<string, string> = {
    'maj': 'major', 'min': 'minor', 'm': 'minor',
    'dom': '7th', 'dom7': '7th',
  };
  for (const [alias, type] of Object.entries(aliases)) {
    if (n.endsWith(alias)) {
      const root = name.slice(0, name.length - alias.length).trim();
      const found = allChords.find(c => norm(c.root) === norm(root) && c.type === type);
      if (found) return found.id;
    }
  }
  return null;
}

/* ──────────────────── Import Song Modal ──────────────────── */
type ImportStage = 'idle' | 'preview' | 'conflict' | 'success' | 'error';

interface ParsedImport {
  name: string;
  artist: string;
  bpm: number;
  key: string;
  notes: string;
  chords: string[];       // resolved chord IDs
  rawCount: number;       // total entries in file
  unresolvedCount: number;
}

function ImportSongModal({ accent, existingPresets, onImport, onClose }: {
  accent: { from: string; to: string; mid: string };
  existingPresets: SongPreset[];
  onImport: (data: Omit<SongPreset, 'id' | 'createdAt' | 'updatedAt'>, replaceId?: string) => void;
  onClose: () => void;
}) {
  const t = useT();
  const [stage, setStage]       = useState<ImportStage>('idle');
  const [parsed, setParsed]     = useState<ParsedImport | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [conflictId, setConflictId] = useState<string | null>(null);
  const [renameVal, setRenameVal]   = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const parseFile = useCallback((file: File) => {
    const isJson = file.name.toLowerCase().endsWith('.json') || file.type === 'application/json';
    if (!isJson) {
      setErrorMsg(t.songs.supportsJson);
      setStage('error');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const raw = JSON.parse(ev.target?.result as string);
        if (typeof raw !== 'object' || raw === null || Array.isArray(raw))
          throw new Error('Not a valid JSON object.');

        const songName = (raw.songName ?? raw.name ?? '').trim();
        if (!songName) throw new Error('Missing required field: songName');
        if (!Array.isArray(raw.chords)) throw new Error('Missing required field: chords (must be an array)');
        if (raw.chords.length === 0) throw new Error('The chords array is empty.');

        let unresolvedCount = 0;
        const resolvedIds: string[] = [];
        for (const c of raw.chords) {
          if (typeof c !== 'object' || c === null || typeof c.name !== 'string')
            throw new Error('Each chord entry must have a "name" field.');
          const id = resolveChordId(c.name);
          if (id) resolvedIds.push(id);
          else unresolvedCount++;
        }

        const result: ParsedImport = {
          name: songName,
          artist: (raw.artist ?? '').trim(),
          bpm: Math.max(0, Math.min(999, parseInt(raw.bpm) || 0)),
          key: (raw.key ?? '').trim(),
          notes: (raw.notes ?? '').trim(),
          chords: resolvedIds,
          rawCount: raw.chords.length,
          unresolvedCount,
        };

        setParsed(result);
        const conflict = existingPresets.find(
          p => p.name.trim().toLowerCase() === result.name.toLowerCase()
        );
        if (conflict) {
          setConflictId(conflict.id);
          setRenameVal(`${result.name} ${t.songs.importSuffix}`);
          setStage('conflict');
        } else {
          setStage('preview');
        }
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : t.songs.couldNotParse);
        setStage('error');
      }
    };
    reader.onerror = () => {
      setErrorMsg(t.songs.failedToRead);
      setStage('error');
    };
    reader.readAsText(file);
  }, [existingPresets, t]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) parseFile(file);
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) parseFile(file);
  };

  const doImport = (nameOverride?: string, replaceId?: string) => {
    if (!parsed) return;
    logActivity('import', `Imported ${nameOverride ?? parsed.name}`, 'Chordex');
    onImport({
      name: nameOverride ?? parsed.name,
      artist: parsed.artist,
      bpm: parsed.bpm,
      key: parsed.key,
      notes: parsed.notes,
      chords: parsed.chords,
    }, replaceId ?? undefined);
    setStage('success');
  };

  const reset = () => {
    setStage('idle');
    setParsed(null);
    setErrorMsg('');
    setConflictId(null);
  };

  /* ── Shared header ── */
  const ModalHeader = ({ title }: { title: string }) => (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '12px', padding: '16px 16px 12px', flexShrink: 0,
    }}>
      <button onClick={onClose} className="btn-smooth"
        style={{ width: '38px', height: '38px', borderRadius: '50%', background: 'var(--app-surface-high)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <span className="material-symbols-outlined" style={{ color: 'var(--c-text-primary)', fontSize: '20px' }}>close</span>
      </button>
      <p style={{ fontFamily: 'Manrope', fontWeight: 800, fontSize: '18px', color: 'var(--c-text-primary)' }}>{title}</p>
    </div>
  );

  /* ── Pill badge ── */
  const Pill = ({ label, color }: { label: string; color: string }) => (
    <span style={{ padding: '3px 10px', borderRadius: '9999px', background: `${color}18`, color, fontFamily: 'Manrope', fontWeight: 700, fontSize: '11px', border: `1px solid ${color}33` }}>{label}</span>
  );

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'flex-end' }}>
      {/* Backdrop */}
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)' }} />

      {/* Sheet */}
      <div style={{
        position: 'relative', width: '100%', background: 'var(--app-bg)',
        borderRadius: '1.5rem 1.5rem 0 0',
        animation: 'sheet-up 400ms cubic-bezier(0.16, 1, 0.3, 1) both',
        maxHeight: '92dvh', display: 'flex', flexDirection: 'column',
        paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
      }}>
        {/* Drag handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 2px' }}>
          <div style={{ width: '36px', height: '4px', borderRadius: '9999px', background: 'rgba(128,128,128,0.25)' }} />
        </div>

        {/* ── IDLE: file picker ── */}
        {stage === 'idle' && (
          <>
            <ModalHeader title={t.songs.importSong} />
            <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Drop zone */}
              <div
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className="btn-smooth"
                style={{
                  border: `2px dashed ${dragOver ? accent.from : 'rgba(128,128,128,0.25)'}`,
                  borderRadius: '1.25rem',
                  padding: '40px 24px',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px',
                  background: dragOver ? `${accent.from}0a` : 'var(--app-surface)',
                  cursor: 'pointer',
                  transition: 'border-color 200ms ease, background 200ms ease',
                }}
              >
                <div style={{
                  width: '56px', height: '56px', borderRadius: '50%',
                  background: `${accent.to}18`, display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <span className="material-symbols-outlined" style={{ color: accent.from, fontSize: '28px', fontVariationSettings: "'FILL' 1" }}>upload_file</span>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <p style={{ fontFamily: 'Manrope', fontWeight: 800, fontSize: '16px', color: 'var(--c-text-primary)' }}>
                    {dragOver ? t.songs.dropHere : t.songs.selectOrDrop}
                  </p>
                  <p style={{ fontFamily: 'Inter', fontSize: '12px', color: 'var(--c-text-secondary)', marginTop: '4px' }}>
                    {t.songs.supportsJson}
                  </p>
                </div>
                <div style={{ padding: '8px 20px', borderRadius: '9999px', background: `linear-gradient(135deg, ${accent.from}, ${accent.to})`, color: '#fff', fontFamily: 'Manrope', fontWeight: 800, fontSize: '13px' }}>
                  {t.songs.browseFiles}
                </div>
              </div>
              <input ref={fileInputRef} type="file" accept=".json,application/json" onChange={handleFileInput} style={{ display: 'none' }} />
              <p style={{ fontFamily: 'Inter', fontSize: '11px', color: 'var(--c-text-muted)', textAlign: 'center', lineHeight: 1.5 }}>
                {t.songs.importHint}
              </p>
            </div>
          </>
        )}

        {/* ── PREVIEW ── */}
        {stage === 'preview' && parsed && (
          <>
            <ModalHeader title={t.songs.previewImport} />
            <div className="no-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: '0 16px' }}>
              {/* Song card */}
              <div style={{ background: 'var(--app-surface)', borderRadius: '1.25rem', padding: '20px', marginBottom: '16px' }}>
                <p style={{ fontFamily: 'Manrope', fontWeight: 900, fontSize: '22px', color: 'var(--c-text-primary)', letterSpacing: '-0.02em', lineHeight: 1.2 }}>{parsed.name}</p>
                {parsed.artist && <p style={{ fontFamily: 'Inter', fontSize: '13px', color: 'var(--c-text-secondary)', marginTop: '3px' }}>{parsed.artist}</p>}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '10px' }}>
                  {parsed.key   && <Pill label={parsed.key} color={accent.from} />}
                  {parsed.bpm > 0 && <Pill label={`${parsed.bpm} BPM`} color="var(--c-text-secondary)" />}
                  <Pill label={t.songs.chordsLabel(parsed.chords.length)} color="#34d399" />
                  {parsed.unresolvedCount > 0 && (
                    <Pill label={t.songs.unrecognizedCount(parsed.unresolvedCount)} color="#fbbf24" />
                  )}
                </div>
                {parsed.notes && (
                  <p style={{ fontFamily: 'Inter', fontSize: '12px', color: 'var(--c-text-secondary)', marginTop: '10px', fontStyle: 'italic', lineHeight: 1.55 }}>{parsed.notes}</p>
                )}
              </div>
              {parsed.unresolvedCount > 0 && (
                <div style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)', borderRadius: '12px', padding: '12px 14px', marginBottom: '12px', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                  <span className="material-symbols-outlined" style={{ color: '#fbbf24', fontSize: '18px', flexShrink: 0, marginTop: '1px' }}>warning</span>
                  <p style={{ fontFamily: 'Inter', fontSize: '12px', color: '#fbbf24', lineHeight: 1.5 }}>
                    {t.songs.unrecognizedWarning(parsed.unresolvedCount)}
                  </p>
                </div>
              )}
              {parsed.chords.length === 0 && (
                <div style={{ background: 'rgba(238,125,119,0.08)', border: '1px solid rgba(238,125,119,0.25)', borderRadius: '12px', padding: '12px 14px', marginBottom: '12px', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                  <span className="material-symbols-outlined" style={{ color: '#ee7d77', fontSize: '18px', flexShrink: 0, marginTop: '1px' }}>error</span>
                  <p style={{ fontFamily: 'Inter', fontSize: '12px', color: '#ee7d77', lineHeight: 1.5 }}>
                    {t.songs.noRecognizedChords}
                  </p>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: '10px', padding: '14px 16px 0' }}>
              <button onClick={onClose} className="btn-smooth"
                style={{ flex: 1, padding: '14px', borderRadius: '9999px', background: 'var(--app-surface-high)', color: 'var(--c-text-secondary)', fontFamily: 'Manrope', fontWeight: 700, fontSize: '14px' }}>
                {t.songs.cancel}
              </button>
              <button onClick={() => doImport()} className="btn-smooth"
                style={{ flex: 2, padding: '14px', borderRadius: '9999px', background: `linear-gradient(135deg, ${accent.from}, ${accent.to})`, color: '#fff', fontFamily: 'Manrope', fontWeight: 800, fontSize: '14px', boxShadow: `0 4px 20px ${accent.to}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>download</span>
                {t.songs.importAction}
              </button>
            </div>
          </>
        )}

        {/* ── CONFLICT ── */}
        {stage === 'conflict' && parsed && (
          <>
            <ModalHeader title={t.songs.songAlreadyExists} />
            <div style={{ padding: '0 16px', flex: 1, overflowY: 'auto' }} className="no-scrollbar">
              <div style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)', borderRadius: '12px', padding: '14px', marginBottom: '16px', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                <span className="material-symbols-outlined" style={{ color: '#fbbf24', fontSize: '20px', flexShrink: 0, marginTop: '1px' }}>info</span>
                <p style={{ fontFamily: 'Inter', fontSize: '13px', color: 'var(--c-text-primary)', lineHeight: 1.55 }}>
                  {t.songs.songAlreadyExistsMsg(parsed.name)}
                </p>
              </div>
              {/* Option: Rename */}
              <div style={{ background: 'var(--app-surface)', borderRadius: '1rem', padding: '16px', marginBottom: '10px' }}>
                <p style={{ fontFamily: 'Manrope', fontWeight: 700, fontSize: '14px', color: 'var(--c-text-primary)', marginBottom: '8px' }}>{t.songs.importWithNewName}</p>
                <input
                  value={renameVal}
                  onChange={e => setRenameVal(e.target.value)}
                  style={{ width: '100%', background: 'var(--app-surface-high)', border: 'none', borderRadius: '0.5rem', padding: '10px 14px', color: 'var(--c-text-primary)', fontFamily: 'Manrope', fontWeight: 600, fontSize: '14px', outline: 'none' }}
                />
                <button onClick={() => doImport(renameVal.trim() || `${parsed.name} ${t.songs.importSuffix}`)} className="btn-smooth"
                  disabled={!renameVal.trim()}
                  style={{ marginTop: '10px', width: '100%', padding: '12px', borderRadius: '9999px', background: `linear-gradient(135deg, ${accent.from}, ${accent.to})`, color: '#fff', fontFamily: 'Manrope', fontWeight: 800, fontSize: '13px', opacity: renameVal.trim() ? 1 : 0.4 }}>
                  {t.songs.importAs(renameVal.trim() || '…')}
                </button>
              </div>
              {/* Option: Replace */}
              <div style={{ background: 'var(--app-surface)', borderRadius: '1rem', padding: '16px', marginBottom: '10px' }}>
                <p style={{ fontFamily: 'Manrope', fontWeight: 700, fontSize: '14px', color: 'var(--c-text-primary)', marginBottom: '4px' }}>{t.songs.replaceExisting}</p>
                <p style={{ fontFamily: 'Inter', fontSize: '12px', color: 'var(--c-text-secondary)', marginBottom: '10px' }}>{t.songs.replaceExistingWarning(parsed.name)}</p>
                <button onClick={() => doImport(parsed.name, conflictId ?? undefined)} className="btn-smooth"
                  style={{ width: '100%', padding: '12px', borderRadius: '9999px', background: 'rgba(238,125,119,0.12)', color: '#ee7d77', fontFamily: 'Manrope', fontWeight: 800, fontSize: '13px', border: '1px solid rgba(238,125,119,0.3)' }}>
                  {t.songs.replaceExistingBtn}
                </button>
              </div>
            </div>
            <div style={{ padding: '14px 16px 0' }}>
              <button onClick={onClose} className="btn-smooth"
                style={{ width: '100%', padding: '14px', borderRadius: '9999px', background: 'var(--app-surface-high)', color: 'var(--c-text-secondary)', fontFamily: 'Manrope', fontWeight: 700, fontSize: '14px' }}>
                {t.songs.cancel}
              </button>
            </div>
          </>
        )}

        {/* ── SUCCESS ── */}
        {stage === 'success' && parsed && (
          <div style={{ padding: '24px 20px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px', textAlign: 'center' }}>
            <SuccessLottie size={72} isLight={false} />
            <div>
              <p style={{ fontFamily: 'Manrope', fontWeight: 900, fontSize: '20px', color: 'var(--c-text-primary)', letterSpacing: '-0.02em' }}>{t.songs.songImportedTitle}</p>
              <p style={{ fontFamily: 'Inter', fontSize: '13px', color: 'var(--c-text-secondary)', marginTop: '6px' }}>
                {t.songs.songImportedDesc(parsed.name)}
              </p>
            </div>
            <button onClick={onClose} className="btn-smooth"
              style={{ padding: '14px 40px', borderRadius: '9999px', background: `linear-gradient(135deg, ${accent.from}, ${accent.to})`, color: '#fff', fontFamily: 'Manrope', fontWeight: 800, fontSize: '14px', boxShadow: `0 4px 20px ${accent.to}44` }}>
              {t.songs.done}
            </button>
          </div>
        )}

        {/* ── ERROR ── */}
        {stage === 'error' && (
          <div style={{ padding: '24px 20px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px', textAlign: 'center' }}>
            <div style={{ width: '72px', height: '72px', borderRadius: '50%', background: 'rgba(238,125,119,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span className="material-symbols-outlined" style={{ color: '#ee7d77', fontSize: '36px', fontVariationSettings: "'FILL' 1" }}>error</span>
            </div>
            <div>
              <p style={{ fontFamily: 'Manrope', fontWeight: 900, fontSize: '20px', color: 'var(--c-text-primary)', letterSpacing: '-0.02em' }}>{t.songs.importFailed}</p>
              <p style={{ fontFamily: 'Inter', fontSize: '13px', color: 'var(--c-text-secondary)', marginTop: '6px', lineHeight: 1.55 }}>{errorMsg}</p>
            </div>
            <div style={{ display: 'flex', gap: '10px', width: '100%' }}>
              <button onClick={onClose} className="btn-smooth"
                style={{ flex: 1, padding: '14px', borderRadius: '9999px', background: 'var(--app-surface-high)', color: 'var(--c-text-secondary)', fontFamily: 'Manrope', fontWeight: 700, fontSize: '14px' }}>
                {t.songs.cancel}
              </button>
              <button onClick={reset} className="btn-smooth"
                style={{ flex: 1, padding: '14px', borderRadius: '9999px', background: `linear-gradient(135deg, ${accent.from}, ${accent.to})`, color: '#fff', fontFamily: 'Manrope', fontWeight: 800, fontSize: '14px' }}>
                {t.songs.tryAgain}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ──────────────────── Chord Picker Sheet ──────────────────── */
type PickerTab = ChordType | 'all' | '__custom__';

function ChordPicker({ onAdd, onClose, accent, onCreateCustom, customChords }: {
  onAdd: (id: string) => void;
  onClose: () => void;
  accent: { from: string; to: string; mid: string };
  onCreateCustom: () => void;
  customChords: CustomChord[];
}) {
  const t = useT();
  const getCatLabel = (type: string) => {
    if (type === 'all') return t.songs.allChords;
    const cats = t.library.cats as Record<string, { label: string }>;
    return cats[type]?.label ?? type;
  };
  const [search, setSearch] = useState('');
  const [cat, setCat] = useState<PickerTab>('all');
  const [selected, setSelected] = useState<string[]>([]);
  const allChords = useMemo(() => getAllChords(), []);

  const isCustomTab = cat === '__custom__';

  const filteredStandard = useMemo(() => {
    if (isCustomTab) return [];
    return allChords.filter(c => {
      if (cat !== 'all' && c.type !== cat) return false;
      if (search) return c.name.toLowerCase().includes(search.toLowerCase()) || c.notes.join(' ').toLowerCase().includes(search.toLowerCase());
      return true;
    // Per-type: max 12 roots; All tab: cap at 60 so the list stays snappy
    }).slice(0, cat === 'all' ? 60 : 12);
  }, [allChords, cat, search, isCustomTab]);

  const filteredCustom = useMemo(() => {
    if (!isCustomTab) return [];
    if (!search) return customChords;
    return customChords.filter(c =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.notes.join(' ').toLowerCase().includes(search.toLowerCase()),
    );
  }, [customChords, search, isCustomTab]);

  const toggle = (id: string) => {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const confirm = () => {
    selected.forEach(id => onAdd(id));
    onClose();
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 150 }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} />
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'var(--app-surface)', borderRadius: '1.5rem 1.5rem 0 0', maxHeight: '80dvh', display: 'flex', flexDirection: 'column', overflow: 'hidden', animation: 'sheet-up 400ms cubic-bezier(0.16, 1, 0.3, 1) both' }}>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px' }}>
          <div style={{ width: '36px', height: '4px', borderRadius: '9999px', background: 'rgba(72,72,72,0.3)' }} />
        </div>
        <div style={{ padding: '4px 16px 10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <p style={{ color: 'var(--c-text-primary)', fontFamily: 'Manrope', fontWeight: 800, fontSize: '18px', flex: 1 }}>
            {selected.length > 0 ? t.songs.selectedCount(selected.length) : t.songs.addChord}
          </p>
          <button onClick={onClose} className="btn-smooth" style={{ color: 'var(--c-text-secondary)' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>close</span>
          </button>
        </div>
        <div style={{ padding: '0 16px 10px', position: 'relative' }}>
          <span className="material-symbols-outlined" style={{ position: 'absolute', left: '28px', top: '50%', transform: 'translateY(-50%)', color: 'var(--c-text-secondary)', fontSize: '16px', pointerEvents: 'none' }}>search</span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t.songs.searchChords}
            style={{ width: '100%', background: 'var(--app-surface-high)', border: 'none', borderRadius: '0.5rem', padding: '9px 14px 9px 36px', color: 'var(--c-text-primary)', fontFamily: 'Inter', fontSize: '14px', outline: 'none' }} />
        </div>
        <div style={{ display: 'flex', gap: '6px', padding: '4px 16px 10px', overflowX: 'auto', overflowY: 'hidden', flexShrink: 0, touchAction: 'pan-x' }} className="no-scrollbar">
          {PICKER_CATS.map(c => (
            <button key={c.type} onClick={() => setCat(c.type)} className="btn-smooth"
              style={{ padding: '5px 12px', borderRadius: '9999px', background: cat === c.type ? `linear-gradient(135deg, ${accent.from}, ${accent.to})` : 'var(--app-surface-high)', color: cat === c.type ? '#fff' : '#acabaa', fontFamily: 'Manrope', fontWeight: 700, fontSize: '12px', flexShrink: 0, transition: 'background 200ms ease' }}>
              {getCatLabel(c.type)}
            </button>
          ))}
          {/* Custom tab */}
          <button onClick={() => setCat('__custom__')} className="btn-smooth"
            style={{ padding: '5px 12px', borderRadius: '9999px', background: cat === '__custom__' ? `linear-gradient(135deg, ${accent.from}, ${accent.to})` : 'var(--app-surface-high)', color: cat === '__custom__' ? '#fff' : '#acabaa', fontFamily: 'Manrope', fontWeight: 700, fontSize: '12px', flexShrink: 0, transition: 'background 200ms ease', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>tune</span>
            {t.songs.custom}{customChords.length > 0 ? ` (${customChords.length})` : ''}
          </button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px', paddingBottom: selected.length > 0 ? '96px' : '24px' }} className="no-scrollbar">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>

            {/* Create custom chord button */}
            <button onClick={() => onCreateCustom()} className="btn-smooth"
              data-testid="create-custom-chord-btn"
              style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px', background: `linear-gradient(135deg, ${accent.from}10, ${accent.to}10)`, borderRadius: '0.875rem', border: `1px dashed ${accent.from}55`, textAlign: 'left', transition: 'background 180ms ease' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: `linear-gradient(135deg, ${accent.from}, ${accent.to})`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span className="material-symbols-outlined" style={{ fontSize: '20px', color: '#fff' }}>add</span>
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ color: accent.from, fontFamily: 'Manrope', fontWeight: 800, fontSize: '14px' }}>{t.songs.createCustomChord}</p>
                <p style={{ color: 'var(--c-text-secondary)', fontFamily: 'Inter', fontSize: '11px', marginTop: '1px' }}>{t.songs.createCustomChordDesc}</p>
              </div>
              <span className="material-symbols-outlined" style={{ fontSize: '18px', color: accent.from }}>arrow_forward_ios</span>
            </button>

            {/* Standard chords */}
            {!isCustomTab && filteredStandard.map(chord => {
              const isSelected = selected.includes(chord.id);
              return (
                <button key={chord.id} data-testid={`picker-chord-${chord.id}`} onClick={() => toggle(chord.id)} className="card-hover"
                  style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', background: isSelected ? `${accent.from}18` : 'var(--app-surface-high)', borderRadius: '0.875rem', border: `1px solid ${isSelected ? accent.from + '44' : 'rgba(72,72,72,0.06)'}`, textAlign: 'left', transition: 'background 180ms ease, border-color 180ms ease' }}>
                  <div style={{ background: 'var(--app-surface-lowest)', borderRadius: '10px', padding: '4px 4px 2px', width: '58px', flexShrink: 0 }}>
                    <ChordDiagram data={chord.guitar} accentFrom={accent.from} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ color: isSelected ? accent.from : 'var(--c-text-primary)', fontFamily: 'Manrope', fontWeight: 700, fontSize: '15px', transition: 'color 180ms ease' }}>{chord.name}</p>
                    <p style={{ color: 'var(--c-text-secondary)', fontFamily: 'Inter', fontSize: '11px' }}>{chord.notes.slice(0, 4).join(' · ')}</p>
                  </div>
                  <div style={{
                    width: '24px', height: '24px', borderRadius: '50%', flexShrink: 0,
                    background: isSelected ? `linear-gradient(135deg, ${accent.from}, ${accent.to})` : 'rgba(72,72,72,0.18)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'background 180ms cubic-bezier(0.34, 1.56, 0.64, 1), transform 180ms cubic-bezier(0.34, 1.56, 0.64, 1)',
                    transform: isSelected ? 'scale(1.1)' : 'scale(1)',
                  }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '15px', color: isSelected ? '#fff' : 'rgba(172,171,170,0.5)', fontVariationSettings: isSelected ? "'FILL' 1" : "'FILL' 0", transition: 'color 150ms ease' }}>check</span>
                  </div>
                </button>
              );
            })}

            {/* Custom chords tab */}
            {isCustomTab && filteredCustom.map(cc => {
              const isSelected = selected.includes(cc.id);
              return (
                <button key={cc.id} data-testid={`picker-custom-${cc.id}`} onClick={() => toggle(cc.id)} className="card-hover"
                  style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', background: isSelected ? `${accent.from}18` : 'var(--app-surface-high)', borderRadius: '0.875rem', border: `1px solid ${isSelected ? accent.from + '44' : 'rgba(72,72,72,0.06)'}`, textAlign: 'left', transition: 'background 180ms ease, border-color 180ms ease' }}>
                  <div style={{ background: 'var(--app-surface-lowest)', borderRadius: '8px', padding: '4px 3px', flexShrink: 0 }}>
                    <CustomMiniDiagram chord={cc} accentFrom={accent.from} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ color: isSelected ? accent.from : 'var(--c-text-primary)', fontFamily: 'Manrope', fontWeight: 700, fontSize: '15px', transition: 'color 180ms ease', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cc.name || 'Custom Chord'}</p>
                    <p style={{ color: 'var(--c-text-secondary)', fontFamily: 'Inter', fontSize: '11px' }}>{cc.instrument} · {cc.notes.slice(0, 4).join(' · ')}</p>
                  </div>
                  <div style={{
                    width: '24px', height: '24px', borderRadius: '50%', flexShrink: 0,
                    background: isSelected ? `linear-gradient(135deg, ${accent.from}, ${accent.to})` : 'rgba(72,72,72,0.18)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'background 180ms cubic-bezier(0.34, 1.56, 0.64, 1)',
                  }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '15px', color: isSelected ? '#fff' : 'rgba(172,171,170,0.5)', fontVariationSettings: isSelected ? "'FILL' 1" : "'FILL' 0" }}>check</span>
                  </div>
                </button>
              );
            })}
            {isCustomTab && filteredCustom.length === 0 && (
              <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--c-text-muted)' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '36px', display: 'block', marginBottom: '8px', opacity: 0.4 }}>tune</span>
                <p style={{ fontFamily: 'Manrope', fontWeight: 700, fontSize: '13px' }}>{t.songs.noCustomChords}</p>
                <p style={{ fontFamily: 'Inter', fontSize: '11px', marginTop: '4px', opacity: 0.7 }}>{t.songs.noCustomChordsHint}</p>
              </div>
            )}
            {!isCustomTab && filteredStandard.length === 0 && <p style={{ color: 'var(--c-text-secondary)', fontFamily: 'Inter', textAlign: 'center', padding: '24px' }}>{t.songs.noChords}</p>}
          </div>
        </div>

        {/* Sticky confirm bar */}
        {selected.length > 0 && (
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            padding: '12px 16px', paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
            background: 'var(--app-surface)',
            borderTop: '1px solid rgba(72,72,72,0.1)',
            animation: 'sheet-up 300ms cubic-bezier(0.16, 1, 0.3, 1) both',
          }}>
            <button onClick={confirm} className="btn-smooth"
              style={{ width: '100%', padding: '15px', borderRadius: '9999px', background: `linear-gradient(135deg, ${accent.from}, ${accent.to})`, color: '#fff', fontFamily: 'Manrope', fontWeight: 800, fontSize: '15px', boxShadow: `0 4px 20px ${accent.to}50` }}>
              Add {selected.length} chord{selected.length !== 1 ? 's' : ''}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ──────────────────── Preset Form Sheet ──────────────────── */
interface FormData { name: string; artist: string; bpm: string; key: string; notes: string }
const KEYS = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B', 'Cm', 'C#m', 'Dm', 'Ebm', 'Em', 'Fm', 'F#m', 'Gm', 'Abm', 'Am', 'Bbm', 'Bm'];

function PresetForm({ initial, onSave, onCancel, accent }: { initial?: FormData; onSave: (d: FormData) => void; onCancel: () => void; accent: { from: string; to: string; mid: string } }) {
  const t = useT();
  const [form, setForm] = useState<FormData>(initial || { name: '', artist: '', bpm: '120', key: 'C', notes: '' });
  const inputStyle: React.CSSProperties = { width: '100%', background: 'var(--app-surface-high)', border: '1px solid rgba(72,72,72,0.12)', borderRadius: '0.625rem', padding: '11px 14px', color: 'var(--c-text-primary)', fontFamily: 'Inter', fontSize: '14px', outline: 'none' };
  const labelStyle: React.CSSProperties = { color: 'var(--c-text-secondary)', fontFamily: 'Manrope', fontWeight: 700, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.15em', display: 'block', marginBottom: '6px' };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 150 }}>
      <div onClick={onCancel} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} />
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'var(--app-surface)', borderRadius: '1.5rem 1.5rem 0 0', animation: 'sheet-up 400ms cubic-bezier(0.16, 1, 0.3, 1) both' }}>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px' }}>
          <div style={{ width: '36px', height: '4px', borderRadius: '9999px', background: 'rgba(72,72,72,0.3)' }} />
        </div>
        <div style={{ padding: '4px 20px 20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <p style={{ color: 'var(--c-text-primary)', fontFamily: 'Manrope', fontWeight: 800, fontSize: '20px' }}>{initial ? t.songs.editSong : t.songs.newSong}</p>
          <div><label style={labelStyle}>{t.songs.songTitle}</label><input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Blackbird" style={inputStyle} /></div>
          <div><label style={labelStyle}>{t.songs.artist}</label><input value={form.artist} onChange={e => setForm(f => ({ ...f, artist: e.target.value }))} placeholder="e.g. The Beatles" style={inputStyle} /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div><label style={labelStyle}>{t.songs.bpm}</label><input type="number" min={20} max={400} value={form.bpm} onChange={e => setForm(f => ({ ...f, bpm: e.target.value }))} style={inputStyle} /></div>
            <div><label style={labelStyle}>{t.songs.key}</label><select value={form.key} onChange={e => setForm(f => ({ ...f, key: e.target.value }))} style={{ ...inputStyle, cursor: 'pointer' }}>{KEYS.map(k => <option key={k} value={k}>{k}</option>)}</select></div>
          </div>
          <div><label style={labelStyle}>{t.songs.notes}</label><textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} placeholder={t.songs.notesPlaceholder} style={{ ...inputStyle, resize: 'none' }} /></div>
          <div style={{ display: 'flex', gap: '10px', paddingBottom: 'max(8px, env(safe-area-inset-bottom))' }}>
            <button onClick={onCancel} className="btn-smooth" style={{ flex: 1, padding: '14px', borderRadius: '9999px', background: 'var(--app-surface-high)', color: 'var(--c-text-secondary)', fontFamily: 'Manrope', fontWeight: 700 }}>{t.songs.cancel}</button>
            <button onClick={() => { if (form.name.trim()) onSave(form); }} className="btn-smooth"
              style={{ flex: 2, padding: '14px', borderRadius: '9999px', background: form.name.trim() ? `linear-gradient(135deg, ${accent.from}, ${accent.to})` : 'rgba(72,72,72,0.2)', color: form.name.trim() ? '#fff' : '#acabaa', fontFamily: 'Manrope', fontWeight: 800, boxShadow: form.name.trim() ? `0 4px 20px ${accent.to}40` : 'none' }}>
              {initial ? t.songs.save : t.songs.newSong}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ──────────────────── Main SongsPanel ──────────────────── */
const ITEM_H = 76;

export default function SongsPanel() {
  const t = useT();
  const isWebDesktop = useIsWebDesktop();
  const {
    presets, activePresetId, activePanel, settings, transpositions, customChords,
    setActivePreset, createPreset, updatePreset, deletePreset,
    addChordToPreset, removeChordFromPreset, reorderPresetChords, duplicateChordInPreset,
    setTranspose, resetTranspose, updateSettings,
    saveCustomChord, updateCustomChord, deleteCustomChord,
    addSection, updateSection, deleteSection, addChordToSection, removeChordFromSection, reorderSectionChords, duplicateChordInSection, reorderSection, convertToSections,
    deduplicateAllPresets,
  } = useChordStore();
  const accent      = ACCENT_COLORS[settings.perApp?.chords?.accentColor ?? settings.accentColor] ?? ACCENT_COLORS.blue;
  const preferFlats = settings.preferFlats ?? false;
  const isNative    = typeof window !== 'undefined' && !!(window as any).Capacitor?.isNativePlatform?.();

  const [showForm, setShowForm]               = useState(false);
  const [editingId, setEditingId]             = useState<string | null>(null);
  const [showPicker, setShowPicker]           = useState(false);
  const [showCustomBuilder, setShowCustomBuilder] = useState(false);
  const [editCustomId, setEditCustomId]           = useState<string | null>(null);
  const [showLive, setShowLive]               = useState(false);
  const [showDeleteId, setShowDeleteId]       = useState<string | null>(null);
  const [exportModalPreset, setExportModal]   = useState<SongPreset | null>(null);
  const [jsonExportPreset, setJsonExportPreset] = useState<SongPreset | null>(null);
  const [showImport, setShowImport]           = useState(false);

  // Section state
  const [pickerSectionId, setPickerSectionId]         = useState<string | null>(null);
  const [editingSectionId, setEditingSectionId]       = useState<string | null>(null);
  const [editingSectionName, setEditingSectionName]   = useState('');

  // Section picker sheet
  const [showSectionPicker, setShowSectionPicker]     = useState(false);
  const [customSectionName, setCustomSectionName]     = useState('');
  const [customSectionMode, setCustomSectionMode]     = useState(false);

  // Section selector (which section to add chord to)
  const [showSectionSelector, setShowSectionSelector] = useState(false);

  // Section drag-to-reorder
  const [secDragIdx, setSecDragIdx]                   = useState<number | null>(null);
  const secGrabOffsetY  = useRef(0);   // pointer offset from node top — set once, never drifts
  const secRawRef       = useRef(0);   // current applied translateY — updated every frame
  const secDragStartIdx = useRef(0);
  const secDragNodeRef  = useRef<HTMLElement | null>(null);
  const secRefs         = useRef<(HTMLElement | null)[]>([]);
  const [localSections, setLocalSections]             = useState<SongSection[]>([]);
  const secInstanceKeys = useRef<string[]>([]);

  const SEC_CHORD_H = 62;
  const [secChordDragKey, setSecChordDragKey]           = useState<string | null>(null);
  const [secChordDragIdx, setSecChordDragIdx]           = useState<number | null>(null);
  const [secChordDragDeltaY, setSecChordDragDeltaY]     = useState(0);
  const secChordDragStartY    = useRef(0);
  const secChordDragStartIdx  = useRef(0);
  const secChordDragNodeRef   = useRef<HTMLDivElement | null>(null);
  const secChordDragDeltaRef  = useRef(0);
  const secChordDragCountRef  = useRef(0);
  const secChordPointerId     = useRef<number | null>(null);
  const secChordSectionId     = useRef<string>('');
  const secChordPresetRef     = useRef<SongPreset | null>(null);
  const secChordLocalRef      = useRef<SongSection[]>([]);

  const onSecChordDragStart = useCallback((e: React.PointerEvent, sectionId: string, index: number, count: number, preset: SongPreset) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    secChordPresetRef.current   = preset;
    secChordLocalRef.current    = localSections;
    secChordPointerId.current   = e.pointerId;
    secChordDragStartY.current  = e.clientY;
    secChordDragStartIdx.current = index;
    secChordDragDeltaRef.current = 0;
    secChordDragCountRef.current = count;
    secChordSectionId.current    = sectionId;
    setSecChordDragKey(sectionId);
    setSecChordDragIdx(index);
    setSecChordDragDeltaY(0);
  }, [localSections]);

  const onSecChordDragMove = useCallback((e: React.PointerEvent) => {
    if (secChordPointerId.current === null || e.pointerId !== secChordPointerId.current) return;
    if (!secChordDragNodeRef.current) return;
    const slot = secChordDragStartIdx.current;
    const clientY = e.clientY;
    const raw = clientY - secChordDragStartY.current;
    const maxD = (secChordDragCountRef.current - 1 - slot) * SEC_CHORD_H;
    const minD = -slot * SEC_CHORD_H;
    const clamped = Math.max(minD, Math.min(maxD, raw));
    secChordDragDeltaRef.current = clamped;
    secChordDragNodeRef.current.style.top = `${slot * SEC_CHORD_H + clamped}px`;
    const rawTarget = Math.round((slot * SEC_CHORD_H + clamped) / SEC_CHORD_H);
    const target = Math.max(0, Math.min(secChordDragCountRef.current - 1, rawTarget));
    if (target !== slot) {
      const sId = secChordSectionId.current;
      setLocalSections(prev => {
        const next = prev.map(s => {
          if (s.id !== sId) return s;
          const chords = [...s.chords];
          const [moved] = chords.splice(slot, 1);
          chords.splice(target, 0, moved);
          return { ...s, chords };
        });
        secChordLocalRef.current = next;
        return next;
      });
      secChordDragStartY.current += (target - slot) * SEC_CHORD_H;
      secChordDragDeltaRef.current = clientY - secChordDragStartY.current;
      secChordDragStartIdx.current = target;
      setSecChordDragIdx(target);
      setSecChordDragDeltaY(secChordDragDeltaRef.current);
    }
  }, []);

  const onSecChordDragEnd = useCallback((e: React.PointerEvent) => {
    if (secChordPointerId.current === null || e.pointerId !== secChordPointerId.current) return;
    const sId = secChordSectionId.current;
    secChordDragNodeRef.current = null;
    secChordDragDeltaRef.current = 0;
    secChordPointerId.current = null;
    setSecChordDragKey(null);
    setSecChordDragIdx(null);
    setSecChordDragDeltaY(0);
    const preset = secChordPresetRef.current;
    if (preset && sId) {
      const localSection = secChordLocalRef.current.find(s => s.id === sId);
      if (localSection) {
        updatePreset(preset.id, {
          sections: (preset.sections ?? []).map(s =>
            s.id === sId ? { ...s, chords: localSection.chords } : s
          ),
        });
      }
    }
  }, [updatePreset]);

  // ── Android back gesture / predictive back ──────────────────────────────
  // Returns true if it handled something, false if we're at the root (should minimize).
  // backHandlerRef always holds the freshest state — no stale closures.
  const backHandlerRef = useRef<() => boolean>(() => false);
  useEffect(() => {
    backHandlerRef.current = () => {
      if (showSectionPicker)   { setShowSectionPicker(false);   return true; }
      if (showSectionSelector) { setShowSectionSelector(false); return true; }
      if (showCustomBuilder)   { setShowCustomBuilder(false);   return true; }
      if (showPicker)          { setShowPicker(false);          return true; }
      if (showLive)            { setShowLive(false);            return true; }
      if (showForm)            { setShowForm(false); setEditingId(null); return true; }
      if (exportModalPreset)   { setExportModal(null);          return true; }
      if (jsonExportPreset)    { setJsonExportPreset(null);     return true; }
      if (showImport)          { setShowImport(false);          return true; }
      if (showDeleteId)        { setShowDeleteId(null);         return true; }
      if (activePresetId)      { setActivePreset(null);         return true; }
      return false;
    };
  }, [showSectionPicker, showSectionSelector, showCustomBuilder, showPicker,
      showLive, showForm, exportModalPreset, showImport, showDeleteId,
      activePresetId, setActivePreset]);

  // Register/deregister with the global back stack based on which panel is active.
  useEffect(() => {
    if (activePanel !== 'songs') return;
    setBackHandler(() => backHandlerRef.current());
    return () => setBackHandler(null);
  }, [activePanel]);

  useEffect(() => {
    deduplicateAllPresets();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Drag & drop
  const [localChords, setLocalChords] = useState<string[]>([]);
  const [dragIdx, setDragIdx]         = useState<number | null>(null);
  const [dragDeltaY, setDragDeltaY]   = useState(0); // only updated on slot change (not every pointermove)
  const dragStartY    = useRef(0);
  const dragStartIdx  = useRef(0);
  const dragNodeRef   = useRef<HTMLDivElement | null>(null); // imperative handle to active DOM node
  const dragDeltaRef  = useRef(0);                           // always up-to-date delta (no re-render)
  const dragCountRef  = useRef(0);                           // total chord count at drag start (for clamping)
  const instanceKeys  = useRef<string[]>([]);                // stable per-slot key so DOM nodes survive reorder
  const localChordsRef = useRef<string[]>([]);               // always up-to-date chord list (avoids stale closure)

  // Scroll refs for nav-hide
  const listScrollRef   = useRef<HTMLDivElement>(null);
  const editorScrollRef = useRef<HTMLDivElement>(null);
  useScrollHide(listScrollRef);
  useScrollHide(editorScrollRef);

  const activePreset    = presets.find(p => p.id === activePresetId) ?? null;
  const transposeOffset = (activePreset ? (transpositions[activePreset.id] ?? 0) : 0);

  // Hide the nav bar in editor view or when any sheet is open
  useEffect(() => {
    const anySheetOpen = showForm || showPicker || !!showDeleteId || !!exportModalPreset || showLive || showImport || showCustomBuilder;
    const inEditor = !!(activePreset && !showForm);
    setNavHidden(anySheetOpen || inEditor);
    return () => setNavHidden(false);
  }, [showForm, showPicker, showDeleteId, exportModalPreset, showLive, showImport, showCustomBuilder, activePreset]);

  const lastOpenedId = useRef<string | null>(null);
  useEffect(() => {
    if (activePreset && activePreset.id !== lastOpenedId.current) {
      logActivity('project_open', `Opened ${activePreset.name}`, 'Chordex');
      lastOpenedId.current = activePreset.id;
    } else if (!activePreset) {
      lastOpenedId.current = null;
    }
  }, [activePreset]);

  const handleImport = useCallback((
    data: Omit<SongPreset, 'id' | 'createdAt' | 'updatedAt'>,
    replaceId?: string,
  ) => {
    if (replaceId) {
      updatePreset(replaceId, { ...data, updatedAt: Date.now() });
    } else {
      createPreset(data);
    }
  }, [createPreset, updatePreset]);

  useEffect(() => {
    if (dragIdx === null) {
      const chords = activePreset?.chords ?? [];
      instanceKeys.current = chords.map(() => Math.random().toString(36).slice(2));
      localChordsRef.current = [...chords];
      setLocalChords([...chords]);
    }
  }, [activePreset?.chords, dragIdx]);

  // Track the active pointer id so window listeners only react to the right finger
  const dragPointerIdRef   = useRef<number | null>(null);
  // Stable ref to active preset id — avoids stale closure in the window end handler
  const activePresetIdRef  = useRef<string | null>(null);

  // Core move logic — reads only from refs so it's safe to call from a window listener
  const executeDragMove = (clientY: number) => {
    if (dragNodeRef.current === null) return;
    const slot = dragStartIdx.current;

    // ── Clamp pointer to screen AND list bounds so items can't fly off screen ──
    const containerRect = editorScrollRef.current?.getBoundingClientRect();
    const screenClampedY = containerRect
      ? Math.max(containerRect.top + 8, Math.min(containerRect.bottom - 8, clientY))
      : clientY;
    const unclamped = screenClampedY - dragStartY.current;
    const minDelta = -slot * ITEM_H;
    const maxDelta = (dragCountRef.current - 1 - slot) * ITEM_H;
    const raw = Math.max(minDelta, Math.min(maxDelta, unclamped));
    dragDeltaRef.current = raw;

    // ── Fast path: move the active node directly on the DOM — zero React overhead ──
    dragNodeRef.current.style.top = `${slot * ITEM_H + 8 + raw}px`;

    // ── Slot change detection ──
    const rawTarget = Math.round(raw / ITEM_H) + slot;
    const target    = Math.max(0, Math.min(dragCountRef.current - 1, rawTarget));
    if (target !== slot) {
      // Reorder both the chord list AND the stable instance-key list in lockstep
      const newChords = [...localChordsRef.current];         // always fresh — avoids stale closure
      const newKeys   = [...instanceKeys.current];
      const [movedChord] = newChords.splice(slot, 1);
      const [movedKey]   = newKeys.splice(slot, 1);
      newChords.splice(target, 0, movedChord);
      newKeys.splice(target, 0, movedKey);

      dragStartY.current   += (target - slot) * ITEM_H;
      dragDeltaRef.current  = clientY - dragStartY.current;
      dragStartIdx.current  = target;
      instanceKeys.current  = newKeys;
      localChordsRef.current = newChords;                    // keep ref in sync before React re-renders

      // React re-render only on slot change (rare), not every pointermove
      setLocalChords(newChords);
      setDragIdx(target);
      setDragDeltaY(dragDeltaRef.current); // JSX will set correct `top` after render
    }
  };

  // Core end logic — uses refs so it's safe to call from a window listener
  const executeDragEnd = () => {
    const presetId = activePresetIdRef.current;
    if (presetId !== null) updatePreset(presetId, { chords: localChordsRef.current });
    dragNodeRef.current    = null;
    dragDeltaRef.current   = 0;
    dragPointerIdRef.current = null;
    setDragIdx(null);
    setDragDeltaY(0);
  };

  const onDragStart = (e: React.PointerEvent, index: number) => {
    e.preventDefault();
    activePresetIdRef.current = activePreset?.id ?? null;
    dragPointerIdRef.current  = e.pointerId;
    dragStartY.current        = e.clientY;
    dragStartIdx.current      = index;
    dragDeltaRef.current      = 0;
    dragCountRef.current      = localChords.length;
    setDragIdx(index);
    setDragDeltaY(0);

    // ── Bind to window so React re-renders can't lose the pointer stream ──
    const handleMove = (ev: PointerEvent) => {
      if (ev.pointerId !== dragPointerIdRef.current) return;
      executeDragMove(ev.clientY);
    };
    const handleEnd = (ev: PointerEvent) => {
      if (ev.pointerId !== dragPointerIdRef.current) return;
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup',   handleEnd);
      window.removeEventListener('pointercancel', handleEnd);
      executeDragEnd();
    };
    window.addEventListener('pointermove',  handleMove,  { passive: true });
    window.addEventListener('pointerup',    handleEnd);
    window.addEventListener('pointercancel', handleEnd);
  };

  const handleFormSave = (data: FormData) => {
    const bpm = parseInt(data.bpm) || 120;
    if (editingId) updatePreset(editingId, { name: data.name, artist: data.artist, bpm, key: data.key, notes: data.notes });
    else createPreset({ name: data.name, artist: data.artist, bpm, key: data.key, notes: data.notes, chords: [] });
    setShowForm(false);
    setEditingId(null);
  };

  // Sync localSections from store when not dragging
  useEffect(() => {
    if (secDragIdx === null) {
      const secs = activePreset?.sections ?? [];
      secInstanceKeys.current = secs.map(() => Math.random().toString(36).slice(2));
      setLocalSections([...secs]);
    }
  }, [activePreset?.sections, secDragIdx]);

  const localSectionsRef = useRef<SongSection[]>([]);
  const lastSwapTime     = useRef<number>(0);

  const onSecDragStart = (e: React.PointerEvent, index: number) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const nodeEl = secRefs.current[index];
    secGrabOffsetY.current   = nodeEl ? e.clientY - nodeEl.getBoundingClientRect().top : 0;
    secRawRef.current        = 0;
    secDragStartIdx.current  = index;
    lastSwapTime.current     = 0;
    localSectionsRef.current = [...localSections];
    setSecDragIdx(index);
  };

  const onSecDragMove = (e: React.PointerEvent) => {
    const node = secDragNodeRef.current;
    if (!node) return;

    const slot          = secDragStartIdx.current;
    const containerRect = editorScrollRef.current?.getBoundingClientRect();

    // Natural (untransformed) top — derived from the TRACKED raw, never from a drifting origin.
    const nodeRect   = node.getBoundingClientRect();
    const nodeNatTop = nodeRect.top - secRawRef.current;
    const nodeH      = node.offsetHeight;

    // Where the user wants the node top to be (unconstrained).
    const desiredTop = e.clientY - secGrabOffsetY.current;

    // Hard limits.
    const minTop = containerRect ? containerRect.top    + 24         : -Infinity;
    const maxTop = containerRect ? containerRect.bottom - 24 - nodeH :  Infinity;

    // Rubber-band: past the limit the node follows at 15% speed → bouncy wall feel.
    const ELASTIC = 0.15;
    let displayTop: number;
    const atBoundary = desiredTop < minTop || desiredTop > maxTop;
    if (desiredTop < minTop) {
      displayTop = minTop + (desiredTop - minTop) * ELASTIC;
    } else if (desiredTop > maxTop) {
      displayTop = maxTop + (desiredTop - maxTop) * ELASTIC;
    } else {
      displayTop = desiredTop;
    }

    const raw = displayTop - nodeNatTop;
    secRawRef.current = raw;

    // Visual: subtle lift + faint border nudge when bouncing against the wall.
    node.style.transform  = `translateY(${raw}px) scale(${atBoundary ? 1.015 : 1.0})`;
    node.style.outline    = atBoundary ? '1.5px solid rgba(103,156,255,0.35)' : 'none';
    node.style.transition = 'outline 180ms ease';

    // Swap detection uses the true clamped Y (not the rubber-band-adjusted position).
    const clampedY = containerRect
      ? Math.max(containerRect.top + 24, Math.min(containerRect.bottom - 24, e.clientY))
      : e.clientY;

    const total = localSectionsRef.current.length;
    let target  = slot;

    if (raw > 0 && slot < total - 1) {
      const nextEl = secRefs.current[slot + 1];
      if (nextEl && clampedY > nextEl.getBoundingClientRect().top) target = slot + 1;
    } else if (raw < 0 && slot > 0) {
      const prevEl = secRefs.current[slot - 1];
      if (prevEl && clampedY < prevEl.getBoundingClientRect().bottom) target = slot - 1;
    }

    const now = performance.now();
    if (target !== slot && now - lastSwapTime.current > 120) {
      lastSwapTime.current = now;
      const aEl = secRefs.current[slot];
      const bEl = secRefs.current[target];

      const newSecs = [...localSectionsRef.current];
      const newKeys = [...secInstanceKeys.current];
      const [movedSec] = newSecs.splice(slot, 1);
      const [movedKey] = newKeys.splice(slot, 1);
      newSecs.splice(target, 0, movedSec);
      newKeys.splice(target, 0, movedKey);

      if (aEl && bEl) {
        // Visual position is preserved: newRaw = visualTop_A - naturalTop_B.
        // secGrabOffsetY stays unchanged — the visual top didn't move.
        const newRaw = aEl.getBoundingClientRect().top - bEl.getBoundingClientRect().top;
        secRawRef.current    = newRaw;
        node.style.transform = `translateY(${newRaw}px) scale(1.0)`;
      }

      secDragStartIdx.current  = target;
      secInstanceKeys.current  = newKeys;
      localSectionsRef.current = newSecs;

      setLocalSections(newSecs);
      setSecDragIdx(target);
    }
  };

  const onSecDragEnd = () => {
    const node = secDragNodeRef.current;
    if (node) {
      node.style.transform  = '';
      node.style.outline    = 'none';
      node.style.transition = '';
    }
    const finalIdx = secDragStartIdx.current;
    if (activePreset) {
      const movedId = localSectionsRef.current[finalIdx]?.id;
      if (movedId) {
        const fromIdx = (activePreset.sections ?? []).findIndex(s => s.id === movedId);
        if (fromIdx !== -1 && fromIdx !== finalIdx) reorderSection(activePreset.id, fromIdx, finalIdx);
      }
    }
    secDragNodeRef.current = null;
    setSecDragIdx(null);
  };

  const editingPreset   = editingId ? presets.find(p => p.id === editingId) : null;
  const editingFormData = editingPreset
    ? { name: editingPreset.name, artist: editingPreset.artist, bpm: String(editingPreset.bpm), key: editingPreset.key, notes: editingPreset.notes }
    : undefined;

  /* ═══════ VIEW: PRESET EDITOR ═══════ */
  const renderEditor = () => {
    if (!activePreset) return null;
    return (
      <div className="flex flex-col h-full overflow-hidden app-bg" style={{ position: 'relative' }}>
        {showLive && <LiveMode preset={activePreset} onClose={() => setShowLive(false)} transposeOffset={transposeOffset} />}
        {showPicker && <ChordPicker accent={accent} onAdd={id => {
          if (pickerSectionId) addChordToSection(activePreset.id, pickerSectionId, id);
          else addChordToPreset(activePreset.id, id);
        }} onClose={() => { setShowPicker(false); setPickerSectionId(null); }} onCreateCustom={() => { setShowPicker(false); setShowCustomBuilder(true); }} customChords={customChords} />}
        {showCustomBuilder && (
          <CustomChordBuilder
            accent={accent}
            editChord={editCustomId ? customChords.find(c => c.id === editCustomId) : undefined}
            onSave={(chord) => {
              if (editCustomId) {
                updateCustomChord(chord.id, chord);
              } else {
                saveCustomChord(chord);
                if (pickerSectionId) {
                  addChordToSection(activePreset.id, pickerSectionId, chord.id);
                } else {
                  addChordToPreset(activePreset.id, chord.id);
                }
              }
              setShowCustomBuilder(false);
              setEditCustomId(null);
              setPickerSectionId(null);
            }}
            onClose={() => { setShowCustomBuilder(false); setEditCustomId(null); setPickerSectionId(null); }}
          />
        )}

        {/* Header */}
        <header className="flex-none app-bg" style={{ paddingTop: '18px', paddingBottom: '10px', paddingLeft: '16px', paddingRight: '16px' }}>
          {/* ── Title row ── */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
            {/* Back button */}
            {!isWebDesktop && (
              <button onClick={() => setActivePreset(null)} data-testid="preset-back" className="btn-smooth"
                style={{ flexShrink: 0, width: '36px', height: '36px', borderRadius: '50%', background: 'var(--app-surface-high)', border: '1px solid rgba(128,128,128,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'spring-in 350ms cubic-bezier(0.34, 1.56, 0.64, 1) both', transition: 'background 500ms cubic-bezier(0.4,0,0.2,1)' }}>
                <span className="material-symbols-outlined" style={{ color: 'var(--c-text-primary)', fontSize: '18px' }}>arrow_back</span>
              </button>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <h2 style={{ color: 'var(--c-text-primary)', fontFamily: 'Manrope', fontWeight: 950, fontSize: isWebDesktop ? '18px' : '22px', letterSpacing: '-0.02em', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{activePreset.name}</h2>
              {activePreset.artist && <p style={{ color: 'var(--c-text-secondary)', fontFamily: 'Inter', fontSize: '12px', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{activePreset.artist}</p>}
            </div>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0 }}>
              {/* Live Mode pill */}
              {(() => {
                const hasChords = activePreset.chords.length > 0
                  || (activePreset.sections ?? []).some(s => s.chords.length > 0);
                return hasChords ? (
                  <button onClick={() => setShowLive(true)} data-testid="enter-live-mode" className="btn-smooth"
                    style={{ height: '34px', padding: '0 11px 0 9px', borderRadius: '9999px', background: `linear-gradient(135deg, ${accent.from}, ${accent.to})`, boxShadow: `0 2px 12px ${accent.to}55`, display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span className="material-symbols-outlined" style={{ color: '#fff', fontSize: '16px' }}>play_circle</span>
                    <span style={{ color: '#fff', fontFamily: 'Manrope', fontWeight: 800, fontSize: '11px', letterSpacing: '0.02em' }}>{t.songs.liveMode}</span>
                  </button>
                ) : null;
              })()}
              <button
                onClick={() => isNative ? setJsonExportPreset(activePreset) : exportPresetToJSON(activePreset, 'share')}
                className="btn-smooth" title={t.songs.exportAsJson}
                style={{ width: '34px', height: '34px', borderRadius: '50%', background: 'var(--app-surface-high)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span className="material-symbols-outlined" style={{ color: 'var(--c-text-secondary)', fontSize: '17px' }}>data_object</span>
              </button>
              <button onClick={() => setExportModal(activePreset)} className="btn-smooth" title={t.songs.exportToPdf}
                style={{ width: '34px', height: '34px', borderRadius: '50%', background: 'var(--app-surface-high)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span className="material-symbols-outlined" style={{ color: 'var(--c-text-secondary)', fontSize: '17px' }}>picture_as_pdf</span>
              </button>
              <button onClick={() => { setEditingId(activePreset.id); setShowForm(true); }} className="btn-smooth"
                style={{ width: '34px', height: '34px', borderRadius: '50%', background: 'var(--app-surface-high)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span className="material-symbols-outlined" style={{ color: 'var(--c-text-secondary)', fontSize: '17px' }}>edit</span>
              </button>
              {isWebDesktop && (
                <button onClick={() => setShowDeleteId(activePreset.id)} className="btn-smooth"
                  style={{ width: '34px', height: '34px', borderRadius: '50%', background: 'rgba(238,125,119,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span className="material-symbols-outlined" style={{ color: '#ee7d77', fontSize: '17px' }}>delete</span>
                </button>
              )}
            </div>
          </div>

          {/* ── Meta + transpose row (full width) ── */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px', marginTop: '8px' }}>
            {/* Left: key badge + BPM badge */}
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              {activePreset.key && (
                <span style={{ padding: '3px 10px 3px 8px', background: 'var(--app-surface-high)', color: 'var(--c-text-primary)', borderRadius: '9999px', fontFamily: 'Manrope', fontWeight: 700, fontSize: '11px', border: '1px solid rgba(72,72,72,0.18)', display: 'inline-flex', alignItems: 'center', gap: '3px', whiteSpace: 'nowrap' }}>
                  <span style={{ fontFamily: 'Manrope', fontWeight: 900, fontSize: '12px', lineHeight: 1, color: 'var(--c-text-secondary)' }}>#</span>
                  {transposeOffset === 0 ? activePreset.key : (
                    <>
                      <span style={{ opacity: 0.4, textDecoration: 'line-through', fontSize: '10px' }}>{activePreset.key}</span>
                      <span style={{ marginLeft: '2px' }}>{transposeKeyString(activePreset.key, transposeOffset, preferFlats)}</span>
                    </>
                  )}
                </span>
              )}
              {activePreset.bpm > 0 && (
                <span style={{ padding: '3px 10px', background: 'var(--app-surface-high)', color: 'var(--c-text-secondary)', borderRadius: '9999px', fontFamily: 'Manrope', fontWeight: 700, fontSize: '11px', whiteSpace: 'nowrap' }}>
                  {activePreset.bpm} BPM
                </span>
              )}
            </div>

            {/* Right: transpose controls — no background box */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '2px', flexShrink: 0 }}>
              {transposeOffset !== 0 && (
                <button onClick={() => resetTranspose(activePreset.id)} className="btn-smooth" title={t.songs.resetKey}
                  style={{ padding: '3px 6px', borderRadius: '9999px', background: 'var(--app-surface-high)', color: 'var(--c-text-secondary)', display: 'flex', alignItems: 'center' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>restart_alt</span>
                </button>
              )}
              <button onClick={() => updateSettings({ preferFlats: !preferFlats })} className="btn-smooth"
                title={preferFlats ? t.songs.usingFlats : t.songs.usingSharps}
                style={{ width: '28px', height: '28px', borderRadius: '7px', background: 'var(--app-surface-high)', color: 'var(--c-text-secondary)', fontFamily: 'Manrope', fontWeight: 800, fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {preferFlats ? '♭' : '♯'}
              </button>
              <button onClick={() => setTranspose(activePreset.id, transposeOffset - 1)} className="btn-smooth" data-testid="transpose-down"
                disabled={transposeOffset <= -11}
                style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--app-surface-high)', color: transposeOffset > -11 ? 'var(--c-text-primary)' : 'var(--c-text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: transposeOffset <= -11 ? 0.4 : 1 }}>
                <span className="material-symbols-outlined" style={{ fontSize: '17px' }}>remove</span>
              </button>
              <div style={{ width: '30px', textAlign: 'center', fontFamily: 'Manrope', fontWeight: 900, fontSize: '12px', color: transposeOffset !== 0 ? accent.from : 'var(--c-text-muted)', transition: 'color 250ms ease', flexShrink: 0 }}>
                {formatOffset(transposeOffset)}
              </div>
              <button onClick={() => setTranspose(activePreset.id, transposeOffset + 1)} className="btn-smooth" data-testid="transpose-up"
                disabled={transposeOffset >= 11}
                style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--app-surface-high)', color: transposeOffset < 11 ? 'var(--c-text-primary)' : 'var(--c-text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: transposeOffset >= 11 ? 0.4 : 1 }}>
                <span className="material-symbols-outlined" style={{ fontSize: '17px' }}>add</span>
              </button>
            </div>
          </div>
        </header>


        {/* Chord list (scrollable) */}
        {(() => {
          const hasSections = !!(activePreset.sections && activePreset.sections.length > 0);
          return (
        <div ref={editorScrollRef} className="flex-1 overflow-y-auto no-scrollbar" style={{ padding: '0 16px 90px', position: 'relative' }}>
          {hasSections ? (
            /* ── Sections view ── */
            <div style={{ paddingTop: '12px', paddingBottom: '16px' }}
              onPointerMove={onSecDragMove} onPointerUp={onSecDragEnd} onPointerCancel={onSecDragEnd}>
              {localSections.map((section, secIdx) => {
                const isEditing   = editingSectionId === section.id;
                const isSecActive = secDragIdx === secIdx;
                const stableKey   = secInstanceKeys.current[secIdx] ?? section.id;
                return (
                  <div key={stableKey}
                    ref={el => { secRefs.current[secIdx] = el; if (isSecActive) secDragNodeRef.current = el; }}
                    style={{
                      marginBottom: '16px',
                      borderRadius: '14px',
                      background: isSecActive ? `${accent.to}10` : 'transparent',
                      border: isSecActive ? `1.5px solid ${accent.to}30` : '1.5px solid transparent',
                      // transform is controlled imperatively via node.style.transform — do not set here
                      boxShadow: isSecActive ? '0 6px 20px rgba(0,0,0,0.18)' : 'none',
                      zIndex: isSecActive ? 10 : 1,
                      position: 'relative',
                      willChange: isSecActive ? 'transform' : 'auto',
                      transition: isSecActive ? 'box-shadow 150ms ease' : 'box-shadow 200ms ease',
                      padding: isSecActive ? '8px' : '0',
                    }}>
                    {/* Section header row */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', padding: '0 2px' }}>
                      {/* Drag handle */}
                      <div
                        onPointerDown={e => onSecDragStart(e, secIdx)}
                        style={{ cursor: isSecActive ? 'grabbing' : 'grab', touchAction: 'none', padding: '4px 4px', color: 'var(--c-text-muted)', userSelect: 'none', flexShrink: 0 }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>drag_indicator</span>
                      </div>
                      {isEditing ? (
                        <input autoFocus value={editingSectionName}
                          onChange={e => setEditingSectionName(e.target.value)}
                          onBlur={() => { if (editingSectionName.trim()) updateSection(activePreset.id, section.id, editingSectionName.trim()); setEditingSectionId(null); }}
                          onKeyDown={e => { if (e.key === 'Enter') { if (editingSectionName.trim()) updateSection(activePreset.id, section.id, editingSectionName.trim()); setEditingSectionId(null); } if (e.key === 'Escape') setEditingSectionId(null); }}
                          style={{ flex: 1, background: 'var(--app-surface)', border: `1px solid ${accent.from}44`, borderRadius: '8px', padding: '5px 10px', color: 'var(--c-text-primary)', fontFamily: 'Manrope', fontWeight: 800, fontSize: '13px', outline: 'none' }} />
                      ) : (
                        <p style={{ flex: 1, color: accent.from, fontFamily: 'Manrope', fontWeight: 800, fontSize: '13px', letterSpacing: '0.08em', textTransform: 'uppercase', borderLeft: `3px solid ${accent.from}`, paddingLeft: '8px' }}>{section.name}</p>
                      )}
                      {!isEditing && (<>
                        <button onClick={() => { setEditingSectionId(section.id); setEditingSectionName(section.name); }} className="btn-smooth"
                          style={{ width: '28px', height: '28px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--app-surface-high)' }}>
                          <span className="material-symbols-outlined" style={{ color: 'var(--c-text-secondary)', fontSize: '15px' }}>edit</span>
                        </button>
                        <button onClick={() => { if (localSections.length > 1 || section.chords.length === 0) deleteSection(activePreset.id, section.id); }} className="btn-smooth"
                          style={{ width: '28px', height: '28px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(238,125,119,0.1)', opacity: localSections.length <= 1 && section.chords.length > 0 ? 0.3 : 1 }}>
                          <span className="material-symbols-outlined" style={{ color: '#ee7d77', fontSize: '15px' }}>delete</span>
                        </button>
                      </>)}
                    </div>
                    {/* Chords in section */}
                    {section.chords.length === 0 && (
                      <p style={{ color: 'var(--c-text-muted)', fontFamily: 'Inter', fontSize: '12px', padding: '4px 12px 8px' }}>{t.songs.noSectionChords}</p>
                    )}
                    {(() => {
                      const sChords = (secChordDragKey === section.id ? (localSections.find(s => s.id === section.id)?.chords ?? section.chords) : section.chords);
                      const isDragSec = secChordDragKey === section.id;
                      return (
                        <div
                          onPointerMove={isDragSec ? onSecChordDragMove : undefined}
                          onPointerUp={isDragSec ? onSecChordDragEnd : undefined}
                          onPointerCancel={isDragSec ? onSecChordDragEnd : undefined}
                          style={{
                            position: 'relative',
                            height: isDragSec ? `${sChords.length * SEC_CHORD_H}px` : 'auto',
                          }}>
                          {sChords.map((chordId, idx) => {
                            const isCustom = chordId.startsWith('custom-');
                            const customChord = isCustom ? customChords.find(c => c.id === chordId) ?? null : null;
                            const displayId = (!isCustom && transposeOffset !== 0) ? transposeChordId(chordId, transposeOffset) : chordId;
                            const chord = isCustom ? null : (getChordById(displayId) ?? getChordById(chordId));
                            if (!chord && !customChord) return null;
                            const isActive = isDragSec && secChordDragIdx === idx;
                            return (
                              <div key={chordId + '-' + idx}
                                ref={isActive ? (el) => { secChordDragNodeRef.current = el; } : undefined}
                                style={{
                                  position: isDragSec ? 'absolute' : 'relative',
                                  left: isDragSec ? 0 : undefined,
                                  right: isDragSec ? 0 : undefined,
                                  top: isDragSec ? `${idx * SEC_CHORD_H + (isActive ? secChordDragDeltaY : 0)}px` : undefined,
                                  height: `${SEC_CHORD_H - 6}px`,
                                  marginBottom: isDragSec ? 0 : '6px',
                                  display: 'flex', alignItems: 'center', gap: '8px',
                                  padding: '8px 10px',
                                  background: isActive ? `${accent.to}18` : 'var(--app-surface)',
                                  borderRadius: '1rem',
                                  border: isActive ? `1.5px solid ${accent.to}44` : '1px solid rgba(72,72,72,0.06)',
                                  boxShadow: isActive ? '0 12px 36px rgba(0,0,0,0.4)' : 'none',
                                  zIndex: isActive ? 10 : 1,
                                  transform: isActive ? 'scale(1.03)' : 'scale(1)',
                                  transition: isDragSec && !isActive
                                    ? 'top 180ms cubic-bezier(0.34,1.3,0.64,1), box-shadow 150ms ease, transform 200ms ease'
                                    : isActive
                                    ? 'box-shadow 120ms ease, transform 200ms cubic-bezier(0.34,1.56,0.64,1)'
                                    : 'transform 200ms ease',
                                  willChange: isDragSec ? 'top, transform' : 'auto',
                                }}>
                                <div
                                  onPointerDown={e => onSecChordDragStart(e, section.id, idx, sChords.length, activePreset)}
                                  style={{ cursor: isActive ? 'grabbing' : 'grab', touchAction: 'none', padding: '4px 4px', color: 'var(--c-text-muted)', userSelect: 'none', flexShrink: 0 }}>
                                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>drag_indicator</span>
                                </div>
                                <div style={{ background: 'var(--app-surface-lowest)', borderRadius: '8px', padding: '3px 3px 1px', width: '52px', flexShrink: 0 }}>
                                  {isCustom && customChord ? <CustomMiniDiagram chord={customChord} accentFrom={accent.from} /> : <ChordDiagram data={chord!.guitar} accentFrom={accent.from} />}
                                </div>
                                <p style={{ flex: 1, color: 'var(--c-text-primary)', fontFamily: 'Manrope', fontWeight: 800, fontSize: '15px' }}>
                                  {isCustom ? (customChord?.name || t.songs.customChord) : chord!.name.replace(/\s/g, '')}
                                </p>
                                <button onClick={() => duplicateChordInSection(activePreset.id, section.id, idx)} className="btn-smooth"
                                  style={{ width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', flexShrink: 0 }}>
                                  <span className="material-symbols-outlined" style={{ color: 'var(--c-text-secondary)', fontSize: '15px' }}>content_copy</span>
                                </button>
                                <button onClick={() => removeChordFromSection(activePreset.id, section.id, idx)} className="btn-smooth"
                                  style={{ width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(238,125,119,0.1)', flexShrink: 0 }}>
                                  <span className="material-symbols-outlined" style={{ color: '#ee7d77', fontSize: '15px' }}>close</span>
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>
                );
              })}
            </div>
          ) : (
            /* ── Flat chord list ── */
            <>
          {localChords.length === 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '200px', gap: '12px' }}>
              <MusicNotesLottie size={52} />
              <p style={{ color: 'var(--c-text-secondary)', fontFamily: 'Inter', fontSize: '14px' }}>{t.songs.noChords}</p>
            </div>
          )}
          {/* During drag: absolute-positioned items with CSS `top` transitions for siblings */}
          <div style={{
            paddingTop: '8px',
            paddingBottom: '24px',
            position: 'relative',
            // Give the container a fixed height during drag so it doesn't collapse
            height: dragIdx !== null ? `${localChords.length * ITEM_H + 32}px` : 'auto',
          }}>
            {localChords.map((chordId, i) => {
              // Check if it's a custom chord
              const isCustom  = chordId.startsWith('custom-');
              const customChord = isCustom ? customChords.find(c => c.id === chordId) ?? null : null;
              // Apply transposition only for display on standard chords
              const displayId = (!isCustom && transposeOffset !== 0) ? transposeChordId(chordId, transposeOffset) : chordId;
              const chord     = isCustom ? null : (getChordById(displayId) ?? getChordById(chordId));
              if (!chord && !customChord) return null;
              const isActive  = dragIdx === i;
              const stableKey = instanceKeys.current[i] ?? `${chordId}-${i}`;
              const isDrag    = dragIdx !== null;

              return (
                <div
                  key={stableKey}
                  ref={isActive ? (el) => { dragNodeRef.current = el; } : undefined}
                  style={{
                    // ── Layout: absolute during drag, normal flow otherwise ──
                    position: isDrag ? 'absolute' : 'relative',
                    left:   isDrag ? 0 : undefined,
                    right:  isDrag ? 0 : undefined,
                    // Active item: JSX top = correct after slot-change re-render;
                    // between slot changes it's overridden by imperative onDragMove
                    top: isDrag ? `${i * ITEM_H + 8 + (isActive ? dragDeltaY : 0)}px` : undefined,
                    height: `${ITEM_H - 8}px`,
                    marginBottom: isDrag ? 0 : '8px',

                    // ── Visuals ──
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '10px',
                    background: isActive ? `${accent.to}18` : 'var(--app-surface)',
                    borderRadius: '1rem',
                    borderWidth: isActive ? '1.5px' : '1px',
                    borderStyle: 'solid',
                    borderColor: isActive ? `${accent.to}44` : 'rgba(72,72,72,0.06)',
                    boxShadow: isActive ? '0 16px 48px rgba(0,0,0,0.5)' : 'none',
                    zIndex: isActive ? 10 : 1,
                    transform: isActive ? 'scale(1.03)' : 'scale(1)',

                    // ── Transitions ──
                    // Siblings animate `top` smoothly; active item has no transform transition (imperative)
                    transition: isDrag && !isActive
                      ? 'top 180ms cubic-bezier(0.34, 1.3, 0.64, 1), box-shadow 150ms ease, background-color 150ms ease, border-color 150ms ease, transform 200ms cubic-bezier(0.34, 1.3, 0.64, 1)'
                      : isActive
                      ? 'background-color 120ms ease, border-color 120ms ease, box-shadow 120ms ease, transform 200ms cubic-bezier(0.34, 1.56, 0.64, 1)'
                      : 'background-color 200ms ease, border-color 200ms ease, transform 200ms ease',

                    willChange: isDrag ? 'top, transform' : 'auto',
                  }}
                >
                  {/* Drag handle */}
                  <div
                    onPointerDown={e => onDragStart(e, i)}
                    style={{ cursor: isActive ? 'grabbing' : 'grab', touchAction: 'none', padding: '4px 6px', color: 'var(--c-text-muted)', userSelect: 'none', flexShrink: 0 }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>drag_indicator</span>
                  </div>

                  <div style={{ background: 'var(--app-surface-lowest)', borderRadius: '8px', padding: '3px 3px 1px', width: '52px', flexShrink: 0 }}>
                    {isCustom && customChord
                      ? <CustomMiniDiagram chord={customChord} accentFrom={accent.from} />
                      : <ChordDiagram data={chord!.guitar} accentFrom={accent.from} />
                    }
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <p style={{ color: 'var(--c-text-primary)', fontFamily: 'Manrope', fontWeight: 800, fontSize: '17px', lineHeight: 1 }}>
                        {isCustom ? (customChord?.name || t.songs.customChord) : chord!.name.replace(/\s/g, '')}
                      </p>
                      {settings.chordAssistant && settings.assistantConflictDetection && !isCustom && activePreset.key && isChordOutOfKey(chordId, activePreset.key) && (
                        <span title="Out of key" style={{ display: 'inline-flex', alignItems: 'center', background: 'rgba(251,146,60,0.15)', borderRadius: '4px', padding: '1px 4px' }}>
                          <span className="material-symbols-outlined" style={{ fontSize: '12px', color: '#fb923c' }}>warning</span>
                        </span>
                      )}
                    </div>
                    {/* Instrument badge (custom) / chord type (standard) */}
                    {isCustom ? (() => {
                      const instr = customChord?.instrument ?? 'guitar';
                      const c = { guitar: accent.from, bass: '#fb923c', piano: '#c084fc' }[instr] ?? accent.from;
                      return (
                        <span style={{
                          display: 'inline-block', marginTop: '4px',
                          padding: '1px 7px', borderRadius: '9999px',
                          background: `${c}1a`, border: `1px solid ${c}44`,
                          color: c, fontFamily: 'Inter', fontWeight: 800,
                          fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.15em',
                        }}>
                          {instr}
                        </span>
                      );
                    })() : (
                      <p style={{ color: 'var(--c-text-secondary)', fontFamily: 'Inter', fontSize: '10px', marginTop: '3px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                        {chord!.type}
                      </p>
                    )}
                  </div>
                  <span style={{ color: 'var(--c-text-muted)', fontFamily: 'Manrope', fontWeight: 900, fontSize: '12px', flexShrink: 0 }}>#{i + 1}</span>
                  {isCustom && customChord && (
                    <button onClick={() => { setEditCustomId(customChord.id); setShowCustomBuilder(true); }} className="btn-smooth"
                      title={t.songs.editCustomChord}
                      style={{ width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${accent.from}18`, flexShrink: 0 }}>
                      <span className="material-symbols-outlined" style={{ color: accent.from, fontSize: '15px' }}>edit</span>
                    </button>
                  )}
                  <button onClick={() => duplicateChordInPreset(activePreset.id, i)} className="btn-smooth"
                    style={{ width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', flexShrink: 0 }}>
                    <span className="material-symbols-outlined" style={{ color: 'var(--c-text-secondary)', fontSize: '16px' }}>content_copy</span>
                  </button>
                  <button onClick={() => removeChordFromPreset(activePreset.id, i)} className="btn-smooth"
                    style={{ width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(238,125,119,0.1)', flexShrink: 0 }}>
                    <span className="material-symbols-outlined" style={{ color: '#ee7d77', fontSize: '16px' }}>close</span>
                  </button>
                </div>
              );
            })}
          </div>
            </>
          )}
        </div>
          );
        })()}

        {/* Bottom action strip — floating, always Add Section (left) + Add Chord (right) */}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 30, padding: '10px 16px', paddingBottom: 'max(18px, env(safe-area-inset-bottom))', display: 'flex', gap: '8px' }}>
          <button
            onClick={() => { setCustomSectionName(''); setCustomSectionMode(false); setShowSectionPicker(true); }}
            data-testid="add-section-btn" className="btn-smooth"
            style={{ flex: 1, padding: '10px 12px', borderRadius: '9999px', background: 'rgba(72,72,72,0.35)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.07)', color: 'var(--c-text-secondary)', fontFamily: 'Manrope', fontWeight: 700, fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>segment</span>
            {t.songs.addSection}
          </button>
          <button onClick={() => {
            const secs = activePreset.sections;
            if (secs && secs.length > 0) {
              setShowSectionSelector(true);
            } else {
              setPickerSectionId(null);
              setShowPicker(true);
            }
          }} data-testid="add-chord-btn" className="btn-smooth"
            style={{ flex: 1, padding: '10px 12px', borderRadius: '9999px', background: 'rgba(72,72,72,0.35)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.07)', color: 'var(--c-text-secondary)', fontFamily: 'Manrope', fontWeight: 700, fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>library_music</span>
            {t.songs.addChord}
          </button>
        </div>

        {/* Section picker sheet */}
        {showSectionPicker && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}
            onClick={e => { if (e.target === e.currentTarget) setShowSectionPicker(false); }}>
            <div style={{ background: 'var(--app-surface)', borderRadius: '20px 20px 0 0', padding: '20px 16px', paddingBottom: 'max(24px, env(safe-area-inset-bottom))', boxShadow: '0 -8px 40px rgba(0,0,0,0.3)' }}>
              <div style={{ width: '36px', height: '4px', borderRadius: '2px', background: 'rgba(128,128,128,0.3)', margin: '0 auto 16px' }} />
              <p style={{ fontFamily: 'Manrope', fontWeight: 800, fontSize: '16px', color: 'var(--c-text-primary)', marginBottom: '14px' }}>{t.songs.addSection}</p>
              {/* Preset section names */}
              {!customSectionMode && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '12px' }}>
                  {['Verse','Chorus','Bridge','Pre-Chorus','Intro','Outro','Interlude','Solo','Hook'].map(name => (
                    <button key={name} className="btn-smooth" onClick={() => {
                      const hasSecs = !!(activePreset.sections && activePreset.sections.length > 0);
                      if (!hasSecs && localChords.length > 0) convertToSections(activePreset.id);
                      else addSection(activePreset.id, name);
                      setShowSectionPicker(false);
                    }}
                      style={{ padding: '10px 6px', borderRadius: '12px', background: 'var(--app-surface-high)', color: 'var(--c-text-primary)', fontFamily: 'Manrope', fontWeight: 700, fontSize: '13px', border: `1px solid rgba(72,72,72,0.08)` }}>
                      {name}
                    </button>
                  ))}
                  <button className="btn-smooth" onClick={() => setCustomSectionMode(true)}
                    style={{ padding: '10px 6px', borderRadius: '12px', background: `${accent.from}14`, color: accent.from, fontFamily: 'Manrope', fontWeight: 700, fontSize: '13px', border: `1px dashed ${accent.from}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>edit</span>
                    Custom
                  </button>
                </div>
              )}
              {/* Custom name input */}
              {customSectionMode && (
                <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                  <input autoFocus placeholder={t.songs.sectionNamePlaceholder}
                    value={customSectionName} onChange={e => setCustomSectionName(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && customSectionName.trim()) {
                        const hasSecs = !!(activePreset.sections && activePreset.sections.length > 0);
                        if (!hasSecs && localChords.length > 0) convertToSections(activePreset.id);
                        else addSection(activePreset.id, customSectionName.trim());
                        setShowSectionPicker(false);
                      }
                    }}
                    style={{ flex: 1, background: 'var(--app-surface-high)', border: `1px solid ${accent.from}44`, borderRadius: '12px', padding: '12px 14px', color: 'var(--c-text-primary)', fontFamily: 'Manrope', fontWeight: 700, fontSize: '14px', outline: 'none' }} />
                  <button className="btn-smooth" onClick={() => {
                    if (!customSectionName.trim()) return;
                    const hasSecs = !!(activePreset.sections && activePreset.sections.length > 0);
                    if (!hasSecs && localChords.length > 0) convertToSections(activePreset.id);
                    else addSection(activePreset.id, customSectionName.trim());
                    setShowSectionPicker(false);
                  }}
                    style={{ padding: '12px 16px', borderRadius: '12px', background: `linear-gradient(135deg, ${accent.from}, ${accent.to})`, color: '#fff', fontFamily: 'Manrope', fontWeight: 800, fontSize: '13px' }}>
                    Add
                  </button>
                </div>
              )}
              <button onClick={() => setShowSectionPicker(false)} className="btn-smooth"
                style={{ width: '100%', padding: '10px', borderRadius: '12px', background: 'var(--app-surface-high)', color: 'var(--c-text-secondary)', fontFamily: 'Manrope', fontWeight: 700, fontSize: '13px' }}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Section selector — pick where to add chord */}
        {showSectionSelector && activePreset.sections && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}
            onClick={e => { if (e.target === e.currentTarget) setShowSectionSelector(false); }}>
            <div style={{ background: 'var(--app-surface)', borderRadius: '20px 20px 0 0', padding: '20px 16px', paddingBottom: 'max(24px, env(safe-area-inset-bottom))', boxShadow: '0 -8px 40px rgba(0,0,0,0.3)' }}>
              <div style={{ width: '36px', height: '4px', borderRadius: '2px', background: 'rgba(128,128,128,0.3)', margin: '0 auto 16px' }} />
              <p style={{ fontFamily: 'Manrope', fontWeight: 800, fontSize: '15px', color: 'var(--c-text-primary)', marginBottom: '12px' }}>Add chord to…</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {activePreset.sections.map(section => (
                  <button key={section.id} className="btn-smooth" onClick={() => {
                    setPickerSectionId(section.id);
                    setShowSectionSelector(false);
                    setShowPicker(true);
                  }} style={{ width: '100%', padding: '13px 16px', borderRadius: '12px', background: 'var(--app-surface-high)', border: '1px solid rgba(72,72,72,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontFamily: 'Manrope', fontWeight: 700, fontSize: '14px', color: 'var(--c-text-primary)' }}>{section.name}</span>
                    <span style={{ fontFamily: 'Inter', fontSize: '11px', color: 'var(--c-text-muted)' }}>{section.chords.length} chord{section.chords.length !== 1 ? 's' : ''}</span>
                  </button>
                ))}
              </div>
              <button onClick={() => setShowSectionSelector(false)} className="btn-smooth"
                style={{ width: '100%', padding: '10px', borderRadius: '12px', background: 'var(--app-surface-high)', color: 'var(--c-text-secondary)', fontFamily: 'Manrope', fontWeight: 700, fontSize: '13px', marginTop: '10px' }}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {showForm && <PresetForm accent={accent} initial={editingFormData} onSave={handleFormSave} onCancel={() => { setShowForm(false); setEditingId(null); }} />}

        {/* Export modal (also available from inside the editor) */}
        {exportModalPreset && (
          <ExportModal
            preset={exportModalPreset}
            accent={accent}
            onClose={() => setExportModal(null)}
            transposeOffset={transposeOffset}
            storedCustomChords={customChords}
          />
        )}

        {/* JSON export action sheet */}
        {jsonExportPreset && <JsonExportSheet preset={jsonExportPreset} accent={accent} onClose={() => setJsonExportPreset(null)} />}
      </div>
    );
  };

  if (!isWebDesktop && activePreset && !showForm) {
    return renderEditor();
  }

  /* ═══════ VIEW: PRESET LIST ═══════ */
  if (isWebDesktop) {
    return (
      <div className="flex w-full h-full overflow-hidden bg-[#050505]" style={{ position: 'relative' }}>
        {/* Left Column: Setlist song list */}
        <div className="border-r border-zinc-900/60" style={{ width: '280px', display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
          {/* Header */}
          <div className="border-b border-zinc-900/60" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
            <span style={{ fontSize: '9px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--c-text-secondary)' }}>SETLIST</span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button 
                onClick={() => { setEditingId(null); setShowForm(true); }}
                style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '2px' }}
                title={t.songs.newSong}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>add</span>
              </button>
              <button 
                onClick={() => setShowImport(true)}
                style={{ background: 'transparent', border: 'none', color: 'var(--c-text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '2px' }}
                title="Import"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>upload_file</span>
              </button>
            </div>
          </div>
          {/* List of songs */}
          <div className="flex-1 overflow-y-auto no-scrollbar" style={{ padding: '8px' }}>
            {presets.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--c-text-muted)', fontSize: '12px' }}>
                No Songs
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {presets.map(p => {
                  const isActive = p.id === activePresetId;
                  return (
                    <button
                      key={p.id}
                      onClick={() => setActivePreset(p.id)}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: '6px',
                        textAlign: 'left',
                        background: isActive ? 'rgba(255,255,255,0.06)' : 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '2px',
                        transition: 'background 150ms ease'
                      }}
                      onMouseEnter={(e) => {
                        if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.02)';
                      }}
                      onMouseLeave={(e) => {
                        if (!isActive) e.currentTarget.style.background = 'transparent';
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                        <span style={{ fontSize: '12.5px', fontWeight: isActive ? '700' : '500', color: isActive ? '#fff' : 'var(--c-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {p.name}
                        </span>
                        {p.key && (
                          <span style={{ fontSize: '10px', color: 'var(--c-text-secondary)', opacity: 0.8 }}>
                            {p.key}
                          </span>
                        )}
                      </div>
                      {p.artist && (
                        <span style={{ fontSize: '11px', color: 'var(--c-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {p.artist}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Preset Editor or Empty State */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', position: 'relative' }}>
          {activePreset ? (
            renderEditor()
          ) : (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--c-text-muted)' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '32px', marginBottom: '8px', opacity: 0.4 }}>queue_music</span>
              <span style={{ fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 'bold' }}>Select a song from the setlist</span>
            </div>
          )}
        </div>

        {/* Form and Modals */}
        {showForm && <PresetForm accent={accent} initial={editingFormData} onSave={handleFormSave} onCancel={() => { setShowForm(false); setEditingId(null); }} />}
        
        {showDeleteId && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 150, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div onClick={() => setShowDeleteId(null)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} />
            <div style={{ position: 'relative', width: '360px', background: 'var(--app-surface-low)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '20px' }}>
              <p style={{ color: 'var(--c-text-primary)', fontFamily: 'Manrope', fontWeight: 800, fontSize: '16px', marginBottom: '16px' }}>{t.songs.confirmDelete}</p>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={() => setShowDeleteId(null)} style={{ flex: 1, padding: '10px', borderRadius: '6px', background: 'var(--app-surface-high)', color: 'var(--c-text-secondary)', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}>{t.songs.cancel}</button>
                <button onClick={() => { deletePreset(showDeleteId); setShowDeleteId(null); }} style={{ flex: 1, padding: '10px', borderRadius: '6px', background: 'rgba(238,125,119,0.15)', color: '#ee7d77', border: '1px solid rgba(238,125,119,0.3)', cursor: 'pointer', fontWeight: 800, fontSize: '13px' }}>{t.songs.delete}</button>
              </div>
            </div>
          </div>
        )}

        {exportModalPreset && (
          <ExportModal
            preset={exportModalPreset}
            accent={accent}
            onClose={() => setExportModal(null)}
            transposeOffset={transposeOffset}
            storedCustomChords={customChords}
          />
        )}

        {jsonExportPreset && <JsonExportSheet preset={jsonExportPreset} accent={accent} onClose={() => setJsonExportPreset(null)} />}

        {showImport && (
          <ImportSongModal
            accent={accent}
            existingPresets={presets}
            onImport={handleImport}
            onClose={() => setShowImport(false)}
          />
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden app-bg" style={{ position: 'relative' }}>
      {showForm && <PresetForm accent={accent} initial={editingFormData} onSave={handleFormSave} onCancel={() => { setShowForm(false); setEditingId(null); }} />}

      {!isWebDesktop && (
        <header className="flex-none px-6 pt-6 pb-1 app-bg">
          <h1 style={{ color: 'var(--c-text-secondary)', fontFamily: 'Manrope', fontWeight: 700, fontSize: '15px', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '7px' }}>
            <AppModeMenuLogo />
          </h1>
        </header>
      )}

      {/* Scrollable list (nav auto-hides here) */}
      <div ref={listScrollRef} className="flex-1 overflow-y-auto no-scrollbar px-5 pb-32" style={{ paddingTop: isWebDesktop ? '20px' : '0px' }}>
        <AnimatedAppHeader
          title={t.songs.title}
          subtitle={t.songs.subtitle}
        />

        {/* Empty state */}
        {presets.length === 0 && (
          <div className="spring-in" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', background: 'var(--app-surface)', borderRadius: '1.5rem', gap: '16px' }}>
            <div style={{ width: '72px', height: '72px', borderRadius: '50%', background: `${accent.to}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span className="material-symbols-outlined" style={{ color: accent.from, fontSize: '36px' }}>queue_music</span>
            </div>
            <div style={{ textAlign: 'center' }}>
              <p style={{ color: 'var(--c-text-primary)', fontFamily: 'Manrope', fontWeight: 800, fontSize: '18px' }}>{t.songs.noSongs}</p>
              <p style={{ color: 'var(--c-text-secondary)', fontFamily: 'Inter', fontSize: '13px', marginTop: '4px' }}>Create your first song or import a shared preset.</p>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => { setEditingId(null); setShowForm(true); }} className="btn-smooth"
                style={{ padding: '12px 24px', borderRadius: '9999px', background: `linear-gradient(135deg, ${accent.from}, ${accent.to})`, color: '#fff', fontFamily: 'Manrope', fontWeight: 800, boxShadow: `0 4px 20px ${accent.to}44` }}>
                {t.songs.newSong}
              </button>
              <button onClick={() => setShowImport(true)} className="btn-smooth"
                style={{ padding: '12px 20px', borderRadius: '9999px', background: 'var(--app-surface-high)', color: 'var(--c-text-secondary)', fontFamily: 'Manrope', fontWeight: 700, border: '1px solid rgba(128,128,128,0.15)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>upload_file</span>
                Import
              </button>
            </div>
          </div>
        )}

        {/* Preset list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <StaggeredReveal staggerInterval={40}>
            {presets.map(preset => (
            <div key={preset.id} className="card-hover"
              style={{ background: 'var(--app-surface)', borderRadius: '1.25rem', overflow: 'hidden', border: '1px solid rgba(72,72,72,0.06)' }}>
              {/* Clickable main area */}
              <button onClick={() => setActivePreset(preset.id)} data-testid={`preset-${preset.id}`}
                style={{ width: '100%', textAlign: 'left', padding: '16px', display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: `${accent.to}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span className="material-symbols-outlined" style={{ color: accent.from, fontSize: '24px', fontVariationSettings: "'FILL' 1" }}>queue_music</span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ color: 'var(--c-text-primary)', fontFamily: 'Manrope', fontWeight: 800, fontSize: '16px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{preset.name}</p>
                  {preset.artist && <p style={{ color: 'var(--c-text-secondary)', fontFamily: 'Inter', fontSize: '12px', marginTop: '2px' }}>{preset.artist}</p>}
                  <div style={{ display: 'flex', gap: '6px', marginTop: '5px', flexWrap: 'wrap', alignItems: 'center' }}>
                    {preset.key && (
                      <span style={{ fontSize: '10px', fontFamily: 'Manrope', fontWeight: 700, color: 'var(--c-text-primary)', background: 'var(--app-surface-high)', padding: '2px 8px 2px 7px', borderRadius: '9999px', display: 'inline-flex', alignItems: 'center', gap: '2px', whiteSpace: 'nowrap' }}>
                        <span style={{ fontFamily: 'Manrope', fontWeight: 900, fontSize: '11px', lineHeight: 1, color: 'var(--c-text-secondary)' }}>#</span>
                        {preset.key}
                      </span>
                    )}
                    {preset.bpm > 0 && (
                      <span style={{ fontSize: '10px', fontFamily: 'Manrope', fontWeight: 700, color: 'var(--c-text-secondary)', display: 'inline-flex', alignItems: 'center', gap: '2px', whiteSpace: 'nowrap' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '11px', lineHeight: 1 }}>speed</span>
                        {preset.bpm} BPM
                      </span>
                    )}
                    <span style={{ fontSize: '10px', fontFamily: 'Manrope', fontWeight: 700, color: 'var(--c-text-muted)' }}>{t.songs.chordsLabel(preset.chords.length)}</span>
                  </div>
                </div>
                <span className="material-symbols-outlined" style={{ color: 'var(--c-text-secondary)', fontSize: '20px', flexShrink: 0 }}>chevron_right</span>
              </button>

              {/* Quick action row: Live | Export PDF | Edit | Delete */}
              <div style={{ display: 'flex', borderTop: '1px solid rgba(72,72,72,0.07)' }}>
                <button
                  onClick={() => { setActivePreset(preset.id); setTimeout(() => setShowLive(true), 100); }}
                  className="btn-smooth"
                  style={{ flex: 1, padding: '9px 6px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', color: accent.from, fontFamily: 'Manrope', fontWeight: 700, fontSize: '11px', borderRight: '1px solid rgba(72,72,72,0.07)', whiteSpace: 'nowrap' }}
                  data-testid={`live-${preset.id}`}>
                  <span className="material-symbols-outlined" style={{ fontSize: '14px', flexShrink: 0 }}>play_circle</span>
                  Live
                </button>
                <button
                  onClick={() => setExportModal(preset)}
                  className="btn-smooth"
                  data-testid={`pdf-${preset.id}`}
                  style={{ flex: 1, padding: '9px 6px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', color: '#9d9da6', fontFamily: 'Manrope', fontWeight: 700, fontSize: '11px', borderRight: '1px solid rgba(72,72,72,0.07)', whiteSpace: 'nowrap' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '14px', flexShrink: 0 }}>picture_as_pdf</span>
                  PDF
                </button>
                <button
                  onClick={() => { setEditingId(preset.id); setShowForm(true); }}
                  className="btn-smooth"
                  style={{ flex: 1, padding: '9px 6px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', color: 'var(--c-text-secondary)', fontFamily: 'Manrope', fontWeight: 700, fontSize: '11px', borderRight: '1px solid rgba(72,72,72,0.07)', whiteSpace: 'nowrap' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '14px', flexShrink: 0 }}>edit</span>
                  Edit
                </button>
                <button
                  onClick={() => setShowDeleteId(preset.id)}
                  className="btn-smooth"
                  style={{ flex: 1, padding: '9px 6px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', color: '#ee7d77', fontFamily: 'Manrope', fontWeight: 700, fontSize: '11px', whiteSpace: 'nowrap' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '14px', flexShrink: 0 }}>delete</span>
                  Delete
                </button>
              </div>
            </div>
            ))}
          </StaggeredReveal>
        </div>
      </div>

      {/* Delete confirmation sheet */}
      {showDeleteId && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 150, display: 'flex', alignItems: 'flex-end' }}>
          <div onClick={() => setShowDeleteId(null)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} />
          <div style={{ position: 'relative', width: '100%', background: 'var(--app-surface)', borderRadius: '1.5rem 1.5rem 0 0', padding: '20px', animation: 'sheet-up 400ms cubic-bezier(0.16, 1, 0.3, 1) both' }}>
            <p style={{ color: 'var(--c-text-primary)', fontFamily: 'Manrope', fontWeight: 800, fontSize: '18px', marginBottom: '8px' }}>{t.songs.confirmDelete}</p>
            <div style={{ display: 'flex', gap: '10px', paddingBottom: 'max(8px, env(safe-area-inset-bottom))' }}>
              <button onClick={() => setShowDeleteId(null)} className="btn-smooth" style={{ flex: 1, padding: '14px', borderRadius: '9999px', background: 'var(--app-surface-high)', color: 'var(--c-text-secondary)', fontFamily: 'Manrope', fontWeight: 700 }}>{t.songs.cancel}</button>
              <button onClick={() => { deletePreset(showDeleteId); setShowDeleteId(null); }} className="btn-smooth" style={{ flex: 1, padding: '14px', borderRadius: '9999px', background: 'rgba(238,125,119,0.15)', color: '#ee7d77', fontFamily: 'Manrope', fontWeight: 800, border: '1px solid rgba(238,125,119,0.3)' }}>{t.songs.delete}</button>
            </div>
          </div>
        </div>
      )}

      {/* Export config modal */}
      {exportModalPreset && (
        <ExportModal
          preset={exportModalPreset}
          accent={accent}
          onClose={() => setExportModal(null)}
          transposeOffset={transposeOffset}
          storedCustomChords={customChords}
        />
      )}

      {/* JSON export action sheet */}
      {jsonExportPreset && <JsonExportSheet preset={jsonExportPreset} accent={accent} onClose={() => setJsonExportPreset(null)} />}

      {/* Import song modal */}
      {showImport && (
        <ImportSongModal
          accent={accent}
          existingPresets={presets}
          onImport={handleImport}
          onClose={() => setShowImport(false)}
        />
      )}

      {/* Floating action buttons above bottom nav */}
      <div style={{ position: 'absolute', right: '20px', bottom: 'var(--content-bottom-pad)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', pointerEvents: 'none', zIndex: 50 }}>
        {/* Import circle — top */}
        <button
          onClick={() => setShowImport(true)}
          data-testid="import-preset-btn"
          className="btn-smooth"
          style={{
            width: '48px', height: '48px', borderRadius: '50%',
            background: 'var(--app-surface-high)',
            border: '1px solid rgba(128,128,128,0.18)',
            color: 'var(--c-text-secondary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 16px rgba(0,0,0,0.28)',
            pointerEvents: 'auto',
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>upload_file</span>
        </button>
        {/* New circle — bottom */}
        <button
          onClick={() => { setEditingId(null); setShowForm(true); }}
          data-testid="new-preset-btn"
          className="btn-smooth"
          style={{
            width: '54px', height: '54px', borderRadius: '50%',
            background: `linear-gradient(135deg, ${accent.from}, ${accent.to})`,
            color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: `0 4px 20px ${accent.to}66`,
            pointerEvents: 'auto',
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '26px', fontVariationSettings: "'wght' 400" }}>add</span>
        </button>
      </div>
    </div>
  );
}
