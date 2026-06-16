#!/usr/bin/env node
import { execSync } from 'node:child_process';

const androidOnlyPatterns = [
  /^apps\/studio-android\//,
  /^packages\/ui-android\//,
  /^android\//
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
  
  const hasNonAndroidChanges = changedFiles.some(file => {
    return !androidOnlyPatterns.some(pattern => pattern.test(file));
  });
  
  if (hasNonAndroidChanges) {
    console.log('Web-affecting or unknown changes detected. Proceeding with Netlify build (exit 1).');
    process.exit(1);
  } else {
    console.log('Android-only changes detected. Skipping Netlify build (exit 0).');
    process.exit(0);
  }
} catch (err) {
  console.warn('Error running git diff checks, defaulting to build (exit 1):', err.message);
  process.exit(1);
}
