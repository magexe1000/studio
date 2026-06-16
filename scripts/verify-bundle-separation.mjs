import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

const paths = {
  webDist: path.join(repoRoot, 'dist/web'),
  androidDist: path.join(repoRoot, 'dist/android-web')
};

console.log('=== RUNNING BUNDLE SEPARATION ASSERTIONS ===');

if (!fs.existsSync(paths.webDist) || !fs.existsSync(paths.androidDist)) {
  console.error('Error: dist directories do not exist. Please run builds first: pnpm build');
  process.exit(1);
}

function getFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(getFiles(file));
    } else {
      if (file.endsWith('.js') || file.endsWith('.html') || file.endsWith('.css')) {
        results.push(file);
      }
    }
  });
  return results;
}

const androidFiles = getFiles(paths.androidDist);
const webFiles = getFiles(paths.webDist);

let failed = false;

// 1. Android bundle checks (must not contain landing page copy)
const forbiddenAndroidTexts = [
  'USE STUDIO WEB',
  'WINDOWS APP',
  'STUDIO PLATFORM SUITE'
];

androidFiles.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  forbiddenAndroidTexts.forEach(text => {
    if (content.toUpperCase().includes(text.toUpperCase())) {
      console.error(`\x1b[31mAssertion Failed: Android asset '${path.relative(repoRoot, file)}' contains forbidden landing copy '${text}'!\x1b[0m`);
      failed = true;
    }
  });
});

// 2. Web bundle checks (must not bundle Android bottom navigation shell or native back listeners)
const forbiddenWebTexts = [
  'bottom-nav-container', // class or ID uniquely identifying BottomNav
  'hardwareBack' // checking back handlers
];

webFiles.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  forbiddenWebTexts.forEach(text => {
    // Only check our own assets, not third-party vendors
    if (content.includes(text) && !file.includes('vendor') && !file.includes('firebase')) {
      console.error(`\x1b[31mAssertion Failed: Web asset '${path.relative(repoRoot, file)}' contains forbidden native behavior reference '${text}'!\x1b[0m`);
      failed = true;
    }
  });
});

if (!failed) {
  console.log('✓ Android bundle excludes public landing copy successfully.');
  console.log('✓ Web bundle excludes Android-only startup behavior successfully.');
  console.log('\x1b[32m=== BUNDLE SEPARATION ASSERTIONS PASSED ===\x1b[0m');
  process.exit(0);
} else {
  console.error('\x1b[31m=== BUNDLE SEPARATION ASSERTIONS FAILED ===\x1b[0m');
  process.exit(1);
}
