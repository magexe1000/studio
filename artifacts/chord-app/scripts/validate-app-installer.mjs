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

// Resolve previous version from Firebase and compare
let prevVersionCode = 0;
let prevPackageName = '';
let prevSignature = '';
if (fs.existsSync(paths.apkPath)) {
  console.log('Resolving previous release info from Firebase...');
  try {
    const versionRes = await fetch('https://studio-30f44.web.app/version.json');
    if (versionRes.ok) {
      const versionData = await versionRes.json();
      const prevVersion = versionData.version;
      console.log(`Previous deployed version: ${prevVersion}`);
      
      const packageJsonPath = path.join(appRoot, 'package.json');
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      const currentVersion = packageJson.version;
      
      if (prevVersion && prevVersion !== currentVersion) {
        const prevApkUrl = `https://github.com/MAGEXE1000/Studio/releases/download/v${prevVersion}/studio-${prevVersion}.apk`;
        const tempApkPath = path.join(appRoot, `studio-temp-prev.apk`);
        
        console.log(`Downloading previous APK to compare: ${prevApkUrl}`);
        const downloadRes = await fetch(prevApkUrl);
        if (downloadRes.ok) {
          const fileStream = fs.createWriteStream(tempApkPath);
          const buffer = await downloadRes.arrayBuffer();
          fs.writeFileSync(tempApkPath, Buffer.from(buffer));
          console.log(`✓ Previous APK downloaded to ${tempApkPath}`);
          
          // Parse previous APK details
          const aapt2 = getAndroidTool('aapt2');
          const apksigner = getAndroidTool('apksigner');
          
          const prevManifestXml = execSync(`${aapt2} dump xmltree --file AndroidManifest.xml "${tempApkPath}"`, { encoding: 'utf8' });
          const prevPackageMatch = prevManifestXml.match(/package="([^"]+)"/);
          prevPackageName = prevPackageMatch ? prevPackageMatch[1] : '';
          
          const prevCodeMatch = prevManifestXml.match(/versionCode\([^)]+\)=(\d+|0x[0-9a-f]+)/i);
          prevVersionCode = prevCodeMatch ? (prevCodeMatch[1].startsWith('0x') ? parseInt(prevCodeMatch[1], 16) : parseInt(prevCodeMatch[1], 10)) : 0;
          
          const prevSignInfo = execSync(`${apksigner} verify --print-certs "${tempApkPath}"`, { encoding: 'utf8' });
          const prevSha256Match = prevSignInfo.match(/certificate SHA-256 digest:\s+([a-fA-F0-9:]+)/i);
          prevSignature = prevSha256Match ? prevSha256Match[1].replace(/:/g, '').toLowerCase() : '';
          
          console.log(`Previous APK Details: package=${prevPackageName}, versionCode=${prevVersionCode}, signature=${prevSignature}`);
          
          try {
            fs.unlinkSync(tempApkPath);
          } catch (_) {}
        } else {
          console.warn(`⚠ Could not download previous APK (Status ${downloadRes.status}). Skipping previous APK comparison.`);
        }
      } else {
        console.log(`Previous version is same as current version (${currentVersion}). Skipping download.`);
      }
    } else {
      console.warn(`⚠ Could not fetch version.json from Firebase. Skipping previous APK comparison.`);
    }
  } catch (err) {
    console.warn(`⚠ Failed during previous APK fetch/analysis: ${err.message}. Skipping previous APK comparison.`);
  }
}

if (fs.existsSync(paths.apkPath)) {
  // A. Verify non-debuggable and package manifest attributes
  try {
    const aapt2 = getAndroidTool('aapt2');
    console.log(`Verifying release APK manifest via ${aapt2}...`);
    const manifestXml = execSync(`${aapt2} dump xmltree --file AndroidManifest.xml "${paths.apkPath}"`, { encoding: 'utf8' });
    
    // 1. Debuggable check
    if (manifestXml.includes('http://schemas.android.com/apk/res/android:debuggable') && manifestXml.includes('true')) {
      assert(false, 'The release APK is compiled as debuggable (android:debuggable="true")!');
    }
    console.log('✓ APK is confirmed to be non-debuggable.');

    // 2. Package name check
    const packageMatch = manifestXml.match(/package="([^"]+)"/);
    assert(packageMatch && packageMatch[1] === 'com.chordex.app', `Package name mismatch! Expected com.chordex.app but found: ${packageMatch ? packageMatch[1] : 'null'}`);
    if (prevPackageName) {
      assert(packageMatch[1] === prevPackageName, `Package name changed! Previous: ${prevPackageName}, Current: ${packageMatch[1]}`);
    }
    console.log('✓ APK package name is com.chordex.app.');

    // 3. VersionCode check
    const codeMatch = manifestXml.match(/versionCode\([^)]+\)=(\d+|0x[0-9a-f]+)/i);
    assert(codeMatch, 'Could not parse versionCode from APK manifest!');
    const versionCodeVal = codeMatch[1].startsWith('0x') ? parseInt(codeMatch[1], 16) : parseInt(codeMatch[1], 10);
    assert(versionCodeVal > 0, `Invalid versionCode parsed: ${versionCodeVal}`);
    if (prevVersionCode) {
      assert(versionCodeVal > prevVersionCode, `Release blocked: versionCode must increase! Installed/Previous: ${prevVersionCode}, Current: ${versionCodeVal}. Please increment versionCode in build.gradle.`);
    }
    console.log(`✓ APK versionCode is ${versionCodeVal}.`);

    // 4. VersionName check
    const nameMatch = manifestXml.match(/versionName\([^)]+\)="([^"]+)"/i);
    assert(nameMatch, 'Could not parse versionName from APK manifest!');
    const versionNameVal = nameMatch[1];
    
    // Get expected versionName from package.json
    const packageJsonPath = path.join(appRoot, 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    const expectedVersionName = packageJson.version;
    
    assert(versionNameVal === expectedVersionName, `VersionName mismatch! Expected ${expectedVersionName} but found: ${versionNameVal}`);
    console.log(`✓ APK versionName is ${versionNameVal} (matches expected ${expectedVersionName}).`);

  } catch (err) {
    assert(false, `Failed to verify manifest configuration: ${err.message}`);
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

    const sha256Match = signInfo.match(/certificate SHA-256 digest:\s+([a-fA-F0-9:]+)/i);
    const currentSignature = sha256Match ? sha256Match[1].replace(/:/g, '').toLowerCase() : '';
    
    // Check signature consistency with previous release
    if (prevSignature) {
      assert(currentSignature === prevSignature, `Release blocked: signing certificate signature fingerprint changed! Previous: ${prevSignature}, Current: ${currentSignature}`);
    }
    
    // Check signature consistency with expected production key
    const expectedProdSignature = "900cf259185c81100cda8bb08571fa23552e9789131cf07a8f4056e4d4129206";
    if (process.env.CI) {
      assert(currentSignature === expectedProdSignature, `Release blocked: APK is not signed with the production certificate in CI! Expected: ${expectedProdSignature}, Found: ${currentSignature}`);
    } else {
      // Local expected signature matching (if variable defined in env)
      if (process.env.EXPECTED_SIGNATURE_SHA256) {
        const expected = process.env.EXPECTED_SIGNATURE_SHA256.replace(/:/g, '').toLowerCase();
        assert(currentSignature === expected, `Signing certificate fingerprint mismatch! Expected: ${process.env.EXPECTED_SIGNATURE_SHA256}, Found: ${currentSignature}`);
      }
    }
    console.log('✓ APK signing certificate validation check passed.');
  } catch (err) {
    assert(false, `Failed to verify APK signature: ${err.message}`);
  }
}

console.log('\x1b[32m=== APPINSTALLER CONTRACT VALIDATION PASSED ===\x1b[0m');
process.exit(0);
