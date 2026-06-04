import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import AdmZip from 'adm-zip';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, '..');

const paths = {
  pluginJava: path.join(appRoot, 'android/app/src/main/java/com/chordex/app/AppInstallerPlugin.java'),
  mainActivityJava: path.join(appRoot, 'android/app/src/main/java/com/chordex/app/MainActivity.java'),
  apkDownloaderTs: path.join(appRoot, 'src/lib/apkDownloader.ts'),
  apkPath: path.join(appRoot, 'android/app/build/outputs/apk/release/app-release.apk'),
};

console.log('=== RUNNING APPINSTALLER CONTRACT VALIDATION ===');

// Helper to assert condition and fail
function assert(condition, message) {
  if (!condition) {
    console.error(`\x1b[31mVALIDATION FAILED: ${message}\x1b[0m`);
    process.exit(1);
  }
}

// 1. Verify AppInstallerPlugin.java exists and is valid
console.log(`Checking ${path.relative(appRoot, paths.pluginJava)}...`);
assert(fs.existsSync(paths.pluginJava), 'AppInstallerPlugin.java does not exist!');

const pluginContent = fs.readFileSync(paths.pluginJava, 'utf8');
assert(
  /@CapacitorPlugin\s*\(\s*name\s*=\s*["']AppInstaller["']/i.test(pluginContent),
  'AppInstallerPlugin.java is missing @CapacitorPlugin(name = "AppInstaller") annotation!'
);

const requiredMethods = [
  'downloadApk',
  'verifyApkSha256',
  'installApk',
  'openInstallPermissionSettings'
];

for (const method of requiredMethods) {
  const methodRegex = new RegExp(`@PluginMethod\\s+public\\s+void\\s+${method}\\b`);
  assert(
    methodRegex.test(pluginContent),
    `AppInstallerPlugin.java is missing the required @PluginMethod: public void ${method}`
  );
}
console.log('✓ AppInstallerPlugin.java structure and methods are correct.');

// 2. Verify MainActivity.java manual registration
console.log(`Checking ${path.relative(appRoot, paths.mainActivityJava)}...`);
assert(fs.existsSync(paths.mainActivityJava), 'MainActivity.java does not exist!');

const mainActivityContent = fs.readFileSync(paths.mainActivityJava, 'utf8');
assert(
  /registerPlugin\s*\(\s*AppInstallerPlugin\.class\s*\)/.test(mainActivityContent),
  'MainActivity.java is missing registerPlugin(AppInstallerPlugin.class) call!'
);
console.log('✓ MainActivity.java manual plugin registration is correct.');

// 3. Verify apkDownloader.ts registration
console.log(`Checking ${path.relative(appRoot, paths.apkDownloaderTs)}...`);
assert(fs.existsSync(paths.apkDownloaderTs), 'apkDownloader.ts does not exist!');

const apkDownloaderContent = fs.readFileSync(paths.apkDownloaderTs, 'utf8');
assert(
  /registerPlugin\s*<\s*AppInstallerPlugin\s*>\s*\(\s*['"]AppInstaller['"]\s*\)/.test(apkDownloaderContent),
  "apkDownloader.ts is missing registerPlugin<AppInstallerPlugin>('AppInstaller')!"
);
console.log('✓ apkDownloader.ts TypeScript registration is correct.');

// 4. Verify APK packaging integrity
console.log(`Checking APK packaging at ${path.relative(appRoot, paths.apkPath)}...`);
const allowMissingApk = process.argv.includes('--allow-missing-apk');

if (!fs.existsSync(paths.apkPath)) {
  if (allowMissingApk) {
    console.log('⚠ APK file does not exist, but --allow-missing-apk was passed. Skipping APK scan.');
  } else {
    assert(false, `APK file not found at ${paths.apkPath}. Build APK first or pass --allow-missing-apk.`);
  }
} else {
  try {
    const zip = new AdmZip(paths.apkPath);
    const zipEntries = zip.getEntries();
    
    // Find all dex files in the zip
    const dexEntries = zipEntries.filter(entry => entry.entryName.startsWith('classes') && entry.entryName.endsWith('.dex'));
    assert(dexEntries.length > 0, 'No .dex files found inside the APK!');
    
    let foundClass = false;
    for (const entry of dexEntries) {
      console.log(`Scanning DEX file: ${entry.entryName}...`);
      const buffer = entry.getData();
      
      // Dex files contain ASCII string pools. We search for the ASCII representation of "AppInstallerPlugin"
      if (buffer.includes('AppInstallerPlugin') || buffer.includes('Lcom/chordex/app/AppInstallerPlugin;')) {
        foundClass = true;
        console.log(`✓ Found AppInstallerPlugin in ${entry.entryName}`);
        break;
      }
    }
    
    assert(foundClass, 'AppInstallerPlugin class reference NOT found in any classes.dex! The APK build is broken.');
    console.log('✓ APK contains the packaged AppInstallerPlugin class.');
  } catch (err) {
    assert(false, `Error occurred while unzipping/reading classes.dex from APK: ${err.message}`);
  }
}

// 5. Android Tools signature & debuggable validation
function getAndroidTool(toolName) {
  try {
    execSync(`${toolName} --version`, { stdio: 'ignore' });
    return toolName;
  } catch (e) {}

  let sdkPath = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || '';
  if (!sdkPath && process.platform === 'win32') {
    const localAppData = process.env.LOCALAPPDATA || '';
    if (localAppData) {
      const standardPath = path.join(localAppData, 'Android/Sdk');
      if (fs.existsSync(standardPath)) {
        sdkPath = standardPath;
      }
    }
  }

  if (sdkPath) {
    const buildToolsDir = path.join(sdkPath, 'build-tools');
    if (fs.existsSync(buildToolsDir)) {
      const versions = fs.readdirSync(buildToolsDir).sort().reverse();
      for (const ver of versions) {
        const fullPath = path.join(buildToolsDir, ver, toolName + (process.platform === 'win32' ? '.bat' : ''));
        const fullPathExe = path.join(buildToolsDir, ver, toolName + (process.platform === 'win32' ? '.exe' : ''));
        if (fs.existsSync(fullPath)) return `"${fullPath}"`;
        if (fs.existsSync(fullPathExe)) return `"${fullPathExe}"`;
      }
    }
  }
  return toolName;
}

if (fs.existsSync(paths.apkPath)) {
  // A. Verify non-debuggable status
  try {
    const aapt2 = getAndroidTool('aapt2');
    console.log(`Verifying release APK is non-debuggable via ${aapt2}...`);
    const manifestXml = execSync(`${aapt2} dump xmltree --file AndroidManifest.xml "${paths.apkPath}"`, { encoding: 'utf8' });
    if (manifestXml.includes('http://schemas.android.com/apk/res/android:debuggable') && manifestXml.includes('true')) {
      assert(false, 'The release APK is compiled as debuggable (android:debuggable="true")!');
    }
    console.log('✓ APK is confirmed to be non-debuggable.');
  } catch (err) {
    assert(false, `Failed to verify debuggable status: ${err.message}`);
  }

  // B. Verify signature status
  try {
    const apksigner = getAndroidTool('apksigner');
    console.log(`Verifying release APK signature status via ${apksigner}...`);
    const signInfo = execSync(`${apksigner} verify --print-certs "${paths.apkPath}"`, { encoding: 'utf8' });
    if (!signInfo.includes('SHA-256 digest')) {
      assert(false, 'The release APK is not signed!');
    }
    console.log('✓ APK is successfully signed.');

    // C. Expected signature matching (if variable defined in env)
    if (process.env.EXPECTED_SIGNATURE_SHA256) {
      const expected = process.env.EXPECTED_SIGNATURE_SHA256.replace(/:/g, '').toLowerCase();
      const matches = signInfo.toLowerCase().replace(/:/g, '').includes(expected);
      assert(matches, `Signing certificate fingerprint mismatch! Expected SHA-256 containing: ${process.env.EXPECTED_SIGNATURE_SHA256}`);
      console.log('✓ APK signing certificate matches the expected production certificate.');
    }
  } catch (err) {
    assert(false, `Failed to verify APK signature: ${err.message}`);
  }
}

console.log('\x1b[32m=== APPINSTALLER CONTRACT VALIDATION PASSED ===\x1b[0m');
process.exit(0);
