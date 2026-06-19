import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

const uiAndroidComponentsDir = path.join(repoRoot, 'packages/ui-android/src/components');
const uiWebComponentsDir = path.join(repoRoot, 'packages/ui-web/src/components');

const androidToKeep = [
  'BottomNav.tsx',
  'UpdateIndicator.tsx',
  'UpdateDiagnosticsSheet.tsx',
  'StudioUpdateScreen.tsx',
  'DownloadIcon.tsx'
];

const webToKeep = [
  'WebSidebarLayout.tsx',
  'StudioSidebar.tsx',
  'WebAppSectionDock.tsx',
  'WebDesignSystem.tsx'
];

function cleanDirectory(dir, keepList) {
  if (!fs.existsSync(dir)) {
    console.log(`Directory does not exist: ${dir}`);
    return;
  }

  const items = fs.readdirSync(dir);
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      console.log(`Removing directory: ${fullPath}`);
      fs.rmSync(fullPath, { recursive: true, force: true });
    } else if (stat.isFile()) {
      if (!keepList.includes(item)) {
        console.log(`Removing file: ${fullPath}`);
        fs.unlinkSync(fullPath);
      } else {
        console.log(`Keeping file: ${fullPath}`);
      }
    }
  }
}

console.log('Cleaning ui-android components...');
cleanDirectory(uiAndroidComponentsDir, androidToKeep);

console.log('\nCleaning ui-web components...');
cleanDirectory(uiWebComponentsDir, webToKeep);

console.log('\nCleanup finished successfully.');
