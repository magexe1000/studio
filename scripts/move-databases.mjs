import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

const coreVocalexDir = path.join(repoRoot, 'packages/studio-core/src/vocalex');
const sharedVocalexDir = path.join(repoRoot, 'packages/ui-shared/src/vocalex');

if (!fs.existsSync(coreVocalexDir)) {
  fs.mkdirSync(coreVocalexDir, { recursive: true });
}

const dbFiles = ['takesDb.ts', 'labSessionDb.ts'];

for (const file of dbFiles) {
  const sharedFilePath = path.join(sharedVocalexDir, file);
  const coreFilePath = path.join(coreVocalexDir, file);

  if (fs.existsSync(sharedFilePath) && !fs.lstatSync(sharedFilePath).isSymbolicLink()) {
    console.log(`Moving database file: ${sharedFilePath} -> ${coreFilePath}`);
    fs.renameSync(sharedFilePath, coreFilePath);
  }

  if (fs.existsSync(sharedFilePath)) {
    fs.unlinkSync(sharedFilePath);
  }

  // Create relative symlink
  console.log(`Creating file symlink for ${file}`);
  const targetRelative = `../../../studio-core/src/vocalex/${file}`;
  fs.symlinkSync(coreFilePath, sharedFilePath, 'file');
}

console.log('Database files moved and symlinked successfully.');
