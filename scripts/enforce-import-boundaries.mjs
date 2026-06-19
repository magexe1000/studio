#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

let violationsCount = 0;

function checkFolder(folderPath, rules, relativeRoot) {
  if (!fs.existsSync(folderPath)) return;
  const files = readdirRecursive(folderPath);

  for (const file of files) {
    if (!/\.(ts|tsx|js|jsx|mjs)$/.test(file)) continue;

    const content = fs.readFileSync(file, 'utf8');
    const importRegex = /(?:import\s+(?:[\w*\s{},]*\s+from\s+)?['"]([^'"]+)['"]|import\(['"]([^'"]+)['"]\))/g;
    let match;

    while ((match = importRegex.exec(content)) !== null) {
      const importPath = match[1] || match[2];
      
      for (const rule of rules) {
        if (rule.pattern.test(importPath)) {
          console.error(`✗ Violation in ${path.relative(repoRoot, file)}:`);
          console.error(`  Forbidden import of "${importPath}" (Rule: ${rule.description})`);
          violationsCount++;
        }
      }
    }
  }
}

function readdirRecursive(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      if (file !== 'node_modules' && file !== 'dist' && file !== 'build' && file !== '.git') {
        results = results.concat(readdirRecursive(filePath));
      }
    } else {
      results.push(filePath);
    }
  }
  return results;
}

console.log('Running import boundary checks...');

// Rule Definitions
const rules = {
  webApp: [
    {
      pattern: /@workspace\/ui-android|ui-android/i,
      description: "Web application cannot import from ui-android"
    }
  ],
  androidApp: [
    {
      pattern: /@workspace\/ui-web|ui-web/i,
      description: "Android application cannot import from ui-web"
    }
  ],
  core: [
    {
      pattern: /@workspace\/ui-web|ui-web|@workspace\/ui-android|ui-android|@workspace\/ui-shared|ui-shared/i,
      description: "studio-core cannot import from platform UI packages or ui-shared"
    }
  ],
  uiShared: [
    {
      pattern: /@workspace\/ui-web|ui-web|@workspace\/ui-android|ui-android|BottomNav|UpdateIndicator/i,
      description: "ui-shared cannot import from platform UI packages or Capacitor-native navigation"
    }
  ]
};

checkFolder(path.join(repoRoot, 'apps/studio-web'), rules.webApp);
checkFolder(path.join(repoRoot, 'apps/studio-android'), rules.androidApp);
checkFolder(path.join(repoRoot, 'packages/studio-core'), rules.core);
checkFolder(path.join(repoRoot, 'packages/ui-shared'), rules.uiShared);

if (violationsCount > 0) {
  console.error(`\n✗ Import boundary check failed with ${violationsCount} violation(s).`);
  process.exit(1);
} else {
  console.log('✓ Import boundary check passed successfully.');
  process.exit(0);
}
