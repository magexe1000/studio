import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const chordsJsPath = path.join(repoRoot, 'packages/studio-core/dist/src/data/chords.js');

if (!fs.existsSync(chordsJsPath)) {
  console.error(`Error: Transpiled chords.js not found at ${chordsJsPath}. Please build packages first.`);
  process.exit(1);
}

// Dynamically import chords JS using pathToFileURL for Windows compatibility
const { getChordByName, normalizeChordName, getAllChords } = await import(pathToFileURL(chordsJsPath).href);
const chordDatabase = getAllChords();

console.log('=== RUNNING CHORD COVERAGE AUDIT ===');
console.log(`Database size: ${chordDatabase.length} entries`);

const roots = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B', 'Db', 'Eb', 'Gb', 'Ab', 'Bb'];
const latinRoots = ['Do', 'Re', 'Mi', 'Fa', 'Sol', 'La', 'Si', 'Dó', 'Ré', 'Fá', 'Lá'];
const suffixes = [
  '', 'm', '7', 'maj7', 'm7', 'm/maj7', 'dim7', 'ø7',
  '6', 'm6', '6/9', '9', 'm9', 'maj9', '7b9', '7s9', 'add9', 'm(add9)',
  '11', 'm11', 'maj11', '7#11', 'maj7#11', 'add11',
  '13', 'm13', 'maj13', '13sus4', 'sus2', 'sus4', '7sus4', '9sus4', 'sus2add13',
  'aug', 'aug7', 'dim', '7b5', '7alt'
];

const slashChords = [
  'C/E', 'C/G', 'D/F#', 'D/A', 'E/G#', 'E/B', 'F/A', 'G/B', 'A/C#', 'Am/G', 'Dm/F', 'Em/G', 'F/C', 'G/D'
];

const aliases = [
  { from: 'Cm7b5', expected: 'Cø7' },
  { from: 'Cminmaj7', expected: 'Cm/maj7' },
  { from: 'C7#5', expected: 'Caug7' },
  { from: 'DoM7', expected: 'Cmaj7' },
  { from: 'Ré7M', expected: 'Dmaj7' },
  { from: 'Fa#menor', expected: 'F#m' },
  { from: 'Solmaior', expected: 'G' }
];

let totalTested = 0;
let resolvedCount = 0;
let missingCount = 0;
const missingList = [];
const unsupportedSuffixList = new Set();
const normalizationMappingList = [];

// 1. Test standard combination of Roots x Suffixes
for (const r of roots) {
  for (const s of suffixes) {
    const raw = `${r}${s}`;
    totalTested++;
    const normalized = normalizeChordName(raw);
    normalizationMappingList.push({ from: raw, to: normalized });

    let found = getChordByName(normalized);
    if (!found && normalized.includes('/')) {
      const basePart = normalized.split('/')[0].trim();
      found = getChordByName(basePart);
    }

    if (found) {
      resolvedCount++;
    } else {
      missingCount++;
      missingList.push(normalized);
      unsupportedSuffixList.add(s);
    }
  }
}

// 2. Test Latin Roots
for (const lr of latinRoots) {
  for (const s of ['', 'm', '7', 'maj7']) {
    const raw = `${lr}${s}`;
    totalTested++;
    const normalized = normalizeChordName(raw);
    normalizationMappingList.push({ from: raw, to: normalized });

    let found = getChordByName(normalized);
    if (found) {
      resolvedCount++;
    } else {
      missingCount++;
      missingList.push(normalized);
    }
  }
}

// 3. Test Slash Chords
for (const sc of slashChords) {
  totalTested++;
  const normalized = normalizeChordName(sc);
  normalizationMappingList.push({ from: sc, to: normalized });

  let found = getChordByName(normalized);
  if (!found && normalized.includes('/')) {
    const basePart = normalized.split('/')[0].trim();
    found = getChordByName(basePart);
  }

  if (found) {
    resolvedCount++;
  } else {
    missingCount++;
    missingList.push(normalized);
  }
}

// 4. Test Aliases
for (const item of aliases) {
  totalTested++;
  const normalized = normalizeChordName(item.from);
  normalizationMappingList.push({ from: item.from, to: normalized });
  
  if (normalized !== item.expected) {
    console.error(`[FAIL] Normalization fail: "${item.from}" normalized to "${normalized}", expected "${item.expected}"`);
  }

  let found = getChordByName(normalized);
  if (found) {
    resolvedCount++;
  } else {
    missingCount++;
    missingList.push(normalized);
  }
}

console.log(`\nAudit Results:`);
console.log(`- Total Chords Tested: ${totalTested}`);
console.log(`- Diagrams Resolved:  ${resolvedCount} (${((resolvedCount / totalTested) * 100).toFixed(1)}%)`);
console.log(`- Diagrams Missing:   ${missingCount}`);

if (missingCount > 0) {
  console.log(`\nMissing List (first 15):`);
  console.log(missingList.slice(0, 15).join(', '));
}

if (unsupportedSuffixList.size > 0) {
  console.log(`\nUnsupported Suffix List:`);
  console.log(Array.from(unsupportedSuffixList).join(', '));
}

console.log(`\n✓ Chord audit complete.`);
if (missingCount > 40) {
  console.error('Too many missing chords! Coverage check failed.');
  process.exit(1);
} else {
  console.log('✓ Chord coverage check passed.');
  process.exit(0);
}
