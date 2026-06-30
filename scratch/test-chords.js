import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const chordsJsPath = path.join(repoRoot, 'packages/studio-core/dist/src/data/chords.js');

const { getAllChords, getChordByName, normalizeChordName } = await import(pathToFileURL(chordsJsPath).href);

const db = getAllChords();
console.log('Database size:', db.length);

// Check if C#7 is in the database
const cs7 = db.find(c => c.name === 'C#7' || c.id === 'C#-7th');
console.log('C#7 exists in DB:', cs7 ? JSON.stringify(cs7) : 'NO');

// Let's print all root="C#" chords in the database
const csChords = db.filter(c => c.root === 'C#');
console.log('C# chords in DB:', csChords.map(c => `${c.id} -> name:${c.name}`));
