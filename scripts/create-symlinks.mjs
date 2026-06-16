import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

const uiPackages = ['ui-shared', 'ui-web', 'ui-android'];

for (const pkg of uiPackages) {
  const pkgSrc = path.join(repoRoot, 'packages', pkg, 'src');
  if (!fs.existsSync(pkgSrc)) continue;

  const targetDirs = ['lib', 'store', 'hooks', 'data', 'i18n'];
  if (pkg !== 'ui-shared') {
    targetDirs.push('vocalex');
  }

  for (const dir of targetDirs) {
    const linkPath = path.join(pkgSrc, dir);
    const targetPath = path.join(repoRoot, 'packages/studio-core/src', dir);

    if (fs.existsSync(linkPath)) {
      const lstat = fs.lstatSync(linkPath);
      if (lstat.isSymbolicLink() || lstat.isDirectory()) {
        console.log(`Link/directory already exists at ${linkPath}, removing...`);
        fs.rmSync(linkPath, { recursive: true, force: true });
      }
    }

    console.log(`Creating junction link for ${pkg}: ${linkPath} -> ${targetPath}`);
    fs.symlinkSync(targetPath, linkPath, 'junction');
  }
}

console.log('Symlinks created successfully.');
