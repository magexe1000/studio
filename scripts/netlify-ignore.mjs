#!/usr/bin/env node
import { execSync } from 'node:child_process';

const webAffectingPatterns = [
  /^apps\/studio-web\//,
  /^packages\/studio-core\//,
  /^packages\/ui-shared\//,
  /^packages\/ui-web\//,
  /^netlify\.toml$/,
  /^package\.json$/,
  /^pnpm-lock\.yaml$/,
  /^pnpm-workspace\.yaml$/,
  /^tsconfig\.json$/,
  /^tsconfig\.base\.json$/,
  /^scripts\/netlify-ignore\.mjs$/
];

try {
  const cachedRef = process.env.CACHED_COMMIT_REF;
  const commitRef = process.env.COMMIT_REF;
  
  let gitCmd = 'git diff --name-only HEAD^';
  if (cachedRef && commitRef && cachedRef !== commitRef) {
    gitCmd = `git diff --name-only ${cachedRef} ${commitRef}`;
  }
  
  console.log(`Running git command: ${gitCmd}`);
  const output = execSync(gitCmd, { encoding: 'utf8' }).trim();
  const changedFiles = output.split('\n').map(f => f.trim()).filter(Boolean);
  
  console.log('Changed files:');
  console.log(changedFiles);
  
  if (changedFiles.length === 0) {
    console.log('No changed files found. Skipping build.');
    process.exit(0);
  }
  
  const hasWebChanges = changedFiles.some(file => {
    return webAffectingPatterns.some(pattern => pattern.test(file));
  });
  
  if (hasWebChanges) {
    console.log('Web-affecting changes detected. Proceeding with build (exit 1).');
    process.exit(1);
  } else {
    console.log('Android-only changes detected. Skipping Netlify build (exit 0).');
    process.exit(0);
  }
} catch (err) {
  console.warn('Error running git diff checks, defaulting to build (exit 1):', err.message);
  process.exit(1);
}
