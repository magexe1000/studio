import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

const args = process.argv.slice(2);
let targetPlatform = null;
let diffBase = 'origin/main';

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--platform' && i + 1 < args.length) {
    targetPlatform = args[i + 1].toLowerCase();
    i++;
  } else if (args[i] === '--base' && i + 1 < args.length) {
    diffBase = args[i + 1];
    i++;
  }
}

if (!targetPlatform || !['web', 'apk', 'shared'].includes(targetPlatform)) {
  console.error('Error: Please specify a valid platform scope using --platform <web|apk|shared>');
  process.exit(1);
}

console.log(`=== RUNNING PLATFORM SCOPE CHECK FOR: ${targetPlatform.toUpperCase()} (Base: ${diffBase}) ===`);

// 1. Get changed files relative to diffBase
let changedFiles = [];
try {
  const diffOutput = execSync(`git diff --name-only ${diffBase}...HEAD`, { encoding: 'utf8', cwd: repoRoot }).trim();
  if (diffOutput) {
    changedFiles = diffOutput.split('\n');
  }
} catch (e) {
  console.warn('Warning: Could not diff against origin/main. Checking unstaged/staged files instead.');
  try {
    const statusOutput = execSync('git status --porcelain', { encoding: 'utf8', cwd: repoRoot }).trim();
    if (statusOutput) {
      changedFiles = statusOutput.split('\n').map(line => line.substring(3).trim());
    }
  } catch (err) {
    console.error('Error: Failed to obtain list of changed files.', err.message);
    process.exit(1);
  }
}

// Filter out deleted files if they don't exist
changedFiles = changedFiles.filter(f => f.trim() !== '');

console.log(`Auditing ${changedFiles.length} changed files...`);

const ownershipMap = {
  web: [
    /^apps\/studio-web\//,
    /^packages\/ui-web\//
  ],
  apk: [
    /^apps\/studio-android\//,
    /^packages\/ui-android\//
  ],
  shared: [
    /^packages\/studio-core\//,
    /^packages\/ui-shared\//
  ]
};

let violations = [];

changedFiles.forEach(file => {
  let owner = 'other';
  if (ownershipMap.web.some(regex => regex.test(file))) {
    owner = 'web';
  } else if (ownershipMap.apk.some(regex => regex.test(file))) {
    owner = 'apk';
  } else if (ownershipMap.shared.some(regex => regex.test(file))) {
    owner = 'shared';
  }

  // Check violations based on target platform
  if (targetPlatform === 'web' && owner === 'apk') {
    violations.push({ file, owner, reason: 'Web task cannot modify APK-owned files.' });
  } else if (targetPlatform === 'apk' && owner === 'web') {
    violations.push({ file, owner, reason: 'APK task cannot modify Web-owned files.' });
  }
});

if (violations.length > 0) {
  console.error(`\x1b[31mPlatform Scope Check Failed: Found ${violations.length} boundary violations!\x1b[0m`);
  violations.forEach(v => {
    console.error(`  - \x1b[33m${v.file}\x1b[0m (Owner: ${v.owner.toUpperCase()}): ${v.reason}`);
  });
  process.exit(1);
}

console.log('\x1b[32m✓ Platform scope check passed successfully.\x1b[0m');
process.exit(0);
