import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

// 1. Directory junctions in components
const componentsDirs = ['animata', 'ui', 'lottie'];
const pkgs = ['ui-web', 'ui-android'];

for (const pkg of pkgs) {
  const compDir = path.join(repoRoot, `packages/${pkg}/src/components`);
  if (!fs.existsSync(compDir)) continue;

  for (const dir of componentsDirs) {
    const linkPath = path.join(compDir, dir);
    const targetPath = path.join(repoRoot, `packages/ui-shared/src/components/${dir}`);

    if (fs.existsSync(linkPath)) {
      fs.rmSync(linkPath, { recursive: true, force: true });
    }
    console.log(`Creating component directory junction: ${linkPath} -> ${targetPath}`);
    fs.symlinkSync(targetPath, linkPath, 'junction');
  }
}

// 1b. Directory junctions in src/ for lottie
for (const pkg of pkgs) {
  const srcDir = path.join(repoRoot, `packages/${pkg}/src`);
  if (!fs.existsSync(srcDir)) continue;

  const linkPath = path.join(srcDir, 'lottie');
  const targetPath = path.join(repoRoot, `packages/ui-shared/src/lottie`);

  if (fs.existsSync(linkPath)) {
    fs.rmSync(linkPath, { recursive: true, force: true });
  }
  console.log(`Creating src lottie directory junction: ${linkPath} -> ${targetPath}`);
  fs.symlinkSync(targetPath, linkPath, 'junction');
}

// 2. File symlinks for specific components
const fileLinks = [
  {
    link: 'packages/ui-web/src/components/ChordexLogo.tsx',
    target: 'packages/ui-shared/src/components/ChordexLogo.tsx'
  },
  {
    link: 'packages/ui-android/src/components/StudioProgressBar.tsx',
    target: 'packages/ui-shared/src/components/StudioProgressBar.tsx'
  },
  {
    link: 'packages/ui-android/src/components/StudioUpdateAuroraBackground.tsx',
    target: 'packages/ui-shared/src/components/StudioUpdateAuroraBackground.tsx'
  },
  {
    link: 'packages/ui-android/src/components/StudioCountUpPercentage.tsx',
    target: 'packages/ui-shared/src/components/StudioCountUpPercentage.tsx'
  }
];

for (const entry of fileLinks) {
  const linkPath = path.join(repoRoot, entry.link);
  const targetPath = path.join(repoRoot, entry.target);

  if (fs.existsSync(linkPath)) {
    fs.unlinkSync(linkPath);
  }
  console.log(`Creating file symlink: ${linkPath} -> ${targetPath}`);
  fs.symlinkSync(targetPath, linkPath, 'file');
}

// 3. firebase.config.json symlinks in package roots
const firebaseTarget = path.join(repoRoot, 'packages/studio-core/firebase.config.json');
// Make sure target exists, if not copy it from original chord-app
if (!fs.existsSync(firebaseTarget)) {
  const originalConfig = path.join(repoRoot, 'artifacts/chord-app/firebase.config.json');
  if (fs.existsSync(originalConfig)) {
    console.log(`Copying firebase.config.json to studio-core`);
    fs.copyFileSync(originalConfig, firebaseTarget);
  }
}

const firebasePkgs = ['ui-shared', 'ui-web', 'ui-android'];
for (const pkg of firebasePkgs) {
  const linkPath = path.join(repoRoot, `packages/${pkg}/firebase.config.json`);
  if (fs.existsSync(linkPath)) {
    fs.unlinkSync(linkPath);
  }
  console.log(`Creating firebase config symlink: ${linkPath} -> ${firebaseTarget}`);
  fs.symlinkSync(firebaseTarget, linkPath, 'file');
}

console.log('Extra symlinks created successfully.');
