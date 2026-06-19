import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

const standardDeps = {
  "@capacitor-firebase/authentication": "^6.3.1",
  "@capacitor/android": "^6.2.1",
  "@capacitor/app": "^6.0.3",
  "@capacitor/core": "^6.2.1",
  "@capacitor/filesystem": "^6.0.1",
  "@capacitor/local-notifications": "^6.1.3",
  "@capacitor/preferences": "^8.0.1",
  "@capacitor/screen-orientation": "^6.0.4",
  "@capacitor/share": "^6.0.1",
  "@capacitor/status-bar": "^6.0.1",
  "@fontsource/inter": "^5.2.8",
  "@fontsource/manrope": "^5.2.8",
  "@radix-ui/react-dropdown-menu": "^2.1.16",
  "@soundtouchjs/audio-worklet": "^1.0.9",
  "@supabase/supabase-js": "^2.107.0",
  "@tolgee/i18next": "^7.0.0",
  "@tolgee/react": "^7.0.0",
  "clsx": "catalog:",
  "firebase": "^12.12.0",
  "gsap": "^3.15.0",
  "i18next": "^26.0.10",
  "jspdf": "^4.2.1",
  "lottie-react": "^2.4.1",
  "lucide-react": "catalog:",
  "material-symbols": "^0.43.0",
  "motion": "^12.40.0",
  "pitchy": "^4.1.0",
  "react": "catalog:",
  "react-dom": "catalog:",
  "react-i18next": "^17.0.7",
  "tailwind-merge": "catalog:",
  "zustand": "^5.0.12"
};

const packageWorkspaceDeps = {
  "studio-core": {
    "@workspace/db": "workspace:*",
    "@workspace/api-client-react": "workspace:*"
  },
  "ui-shared": {
    "@workspace/db": "workspace:*",
    "@workspace/api-client-react": "workspace:*",
    "@workspace/studio-core": "workspace:*"
  },
  "ui-web": {
    "@workspace/db": "workspace:*",
    "@workspace/api-client-react": "workspace:*",
    "@workspace/studio-core": "workspace:*",
    "@workspace/ui-shared": "workspace:*"
  },
  "ui-android": {
    "@workspace/db": "workspace:*",
    "@workspace/api-client-react": "workspace:*",
    "@workspace/studio-core": "workspace:*",
    "@workspace/ui-shared": "workspace:*"
  }
};

const packages = ['studio-core', 'ui-shared', 'ui-web', 'ui-android'];

for (const pkg of packages) {
  const pkgJsonPath = path.join(repoRoot, 'packages', pkg, 'package.json');
  if (!fs.existsSync(pkgJsonPath)) continue;

  const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));

  // Merge standard dependencies with workspace specific ones
  pkgJson.dependencies = {
    ...standardDeps,
    ...packageWorkspaceDeps[pkg]
  };

  fs.writeFileSync(pkgJsonPath, JSON.stringify(pkgJson, null, 2) + '\n', 'utf8');
  console.log(`✓ Synchronized dependencies in packages/${pkg}/package.json`);
}

console.log('Dependency synchronization complete.');
