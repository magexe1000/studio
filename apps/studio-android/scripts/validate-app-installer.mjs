import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import AdmZip from 'adm-zip';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(__dirname, '../../..');

const paths = {
  pluginJava: path.join(appRoot, 'android/app/src/main/java/com/chordex/app/AppInstallerPlugin.java'),
  mainActivityJava: path.join(appRoot, 'android/app/src/main/java/com/chordex/app/MainActivity.java'),
  apkDownloaderTs: path.join(appRoot, '../../packages/studio-core/src/lib/apkDownloader.ts'),
  apkPath: path.join(appRoot, 'android/app/build/outputs/apk/release/app-release.apk'),
};

console.log('=== RUNNING APPINSTALLER CONTRACT VALIDATION ===');

const EXIT_CODES = {
  SUCCESS: 0,
  APP_INSTALLER_VALIDATION: 10,
  PATH_TEMP_FILE: 11,
  PREV_APK_DOWNLOAD: 12,
  RELEASE_VALIDATION: 13,
};

// Helper to assert condition and fail
function assert(condition, message, exitCode = EXIT_CODES.APP_INSTALLER_VALIDATION) {
  if (!condition) {
    console.error(`\x1b[31mVALIDATION FAILED: ${message}\x1b[0m`);
    process.exit(exitCode);
  }
}

// 0. Verify releaseType and native changes
const releaseType = process.env.RELEASE_TYPE || 'both';
const isDevPreview = process.argv.includes('--development-preview') && process.env.STUDIO_PRODUCTION_RELEASE !== 'true';

if (!isDevPreview) {
  try {
    console.log(`Checking for native or update-system changes (releaseType: ${releaseType})...`);
    const changedFiles = execSync('git diff --name-only HEAD^ HEAD', { encoding: 'utf8' })
      .split('\n')
      .map(f => f.trim())
      .filter(Boolean);
    
    // Check if any native files or update-system files changed
    const nativeFiles = changedFiles.filter(f => 
      f.startsWith('apps/studio-android/android/') ||
      f === 'packages/studio-core/src/lib/apkDownloader.ts' ||
      f === 'packages/studio-core/src/lib/capgoUpdater.ts' ||
      f === 'packages/studio-core/src/lib/otaUpdate.ts' ||
      f === 'apps/studio-android/scripts/validate-app-installer.mjs' ||
      f === 'apps/studio-android/scripts/generate-release-metadata.mjs'
    );
    if (nativeFiles.length > 0) {
      assert(
        releaseType !== 'ota',
        `Native or update-system files changed but releaseType is '${releaseType}'! The release type must be 'apk' or 'both' to upgrade native wrappers. Changed files:\n${nativeFiles.join('\n')}`,
        EXIT_CODES.RELEASE_VALIDATION
      );
      console.log('✓ Release type is correctly set for native / update-system changes.');
    } else {
      console.log('✓ No native or update-system changes detected.');
    }
  } catch (err) {
    console.warn('validate-app-installer: Warning: Could not verify changed files using git:', err.message);
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
  'openInstallPermissionSettings',
  'inspectApk',
  'getInstalledAppInfo'
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
    const versionRes = await fetch('https://studio-30f44.web.app/app-release.json');
    if (versionRes.ok) {
      const versionData = await versionRes.json();
      const prevVersion = versionData.version;
      console.log(`Previous deployed version: ${prevVersion}`);
      
      const appVersionPath = path.join(repoRoot, 'packages/studio-core/src/lib/appVersion.ts');
      const appVersionSrc = fs.readFileSync(appVersionPath, 'utf8');
      const nativeVersionMatches = [...appVersionSrc.matchAll(/export\s+const\s+NATIVE_VERSION\s*=\s*['"]([^'"]+)['"]/g)];
      if (nativeVersionMatches.length !== 1) {
        throw new Error('Unable to resolve NATIVE_VERSION from appVersion.ts');
      }
      const currentVersion = nativeVersionMatches[0][1];
      
      if (prevVersion && prevVersion !== currentVersion) {
        const prevApkUrl = `https://github.com/MAGEXE1000/Studio/releases/download/v${prevVersion}/studio-${prevVersion}.apk`;
        const tempDir = path.join(appRoot, '.release-temp');
        const tempApkPath = path.join(tempDir, 'studio-temp-prev.apk');
        
        // Clean up helper
        const cleanupTemp = () => {
          try {
            if (fs.existsSync(tempApkPath)) {
              fs.unlinkSync(tempApkPath);
              console.log('✓ Cleaned up temporary APK comparison files.');
            }
          } catch (_) {}
        };
        
        console.log(`Ensuring temp directory exists: ${tempDir}`);
        try {
          fs.mkdirSync(tempDir, { recursive: true });
        } catch (err) {
          console.error(`\x1b[31mERROR: Failed to create temp directory ${tempDir}: ${err.message}\x1b[0m`);
          process.exit(EXIT_CODES.PATH_TEMP_FILE);
        }

        console.log(`Downloading previous APK to compare: ${prevApkUrl}`);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 seconds timeout
        
        try {
          const downloadRes = await fetch(prevApkUrl, { signal: controller.signal });
          clearTimeout(timeoutId);
          
          if (downloadRes.status === 404) {
            if (process.env.ALLOW_MISSING_PREV_APK === 'true') {
              console.warn(`⚠ Previous APK at ${prevApkUrl} returned 404 (Not Found). Bypassing check since ALLOW_MISSING_PREV_APK=true.`);
            } else {
              console.error(`\x1b[31mERROR: Previous APK at ${prevApkUrl} returned 404 (Not Found).\x1b[0m`);
              console.error(`Live Firebase version is ${prevVersion}, but the corresponding GitHub release APK is missing.`);
              console.error(`To prevent signing certificate mismatch or version regression for existing users, this release is blocked.`);
              console.error(`If you need to bypass this check, set the environment variable ALLOW_MISSING_PREV_APK=true.`);
              process.exit(EXIT_CODES.RELEASE_VALIDATION);
            }
          } else if (!downloadRes.ok) {
            console.error(`\x1b[31mERROR: Failed to download previous APK (HTTP Status ${downloadRes.status}).\x1b[0m`);
            process.exit(EXIT_CODES.PREV_APK_DOWNLOAD);
          } else {
            const reader = downloadRes.body.getReader();
            const fileStream = fs.createWriteStream(tempApkPath);

            fileStream.on('error', (err) => {
              console.error(`\x1b[31mWriteStream error on ${tempApkPath}: ${err.message}\x1b[0m`);
              cleanupTemp();
              process.exit(EXIT_CODES.PATH_TEMP_FILE);
            });

            try {
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                fileStream.write(Buffer.from(value));
              }
              fileStream.end();
              // Wait for fileStream to finish flushing to disk
              await new Promise((resolve, reject) => {
                fileStream.on('finish', resolve);
                fileStream.on('error', reject);
              });
              console.log(`✓ Previous APK downloaded to ${tempApkPath}`);
            } catch (err) {
              fileStream.destroy();
              cleanupTemp();
              console.error(`\x1b[31mERROR: Failed to write downloaded APK chunks: ${err.message}\x1b[0m`);
              process.exit(EXIT_CODES.PATH_TEMP_FILE);
            }
            
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
            
            // Clean up temp file immediately after we got its details
            cleanupTemp();
          }
        } catch (err) {
          clearTimeout(timeoutId);
          cleanupTemp();
          if (err.name === 'AbortError') {
            console.error(`\x1b[31mERROR: Download of previous APK timed out after 60 seconds.\x1b[0m`);
          } else {
            console.error(`\x1b[31mERROR: Failed during previous APK fetch: ${err.message}\x1b[0m`);
          }
          process.exit(EXIT_CODES.PREV_APK_DOWNLOAD);
        }
      } else {
        console.log(`Previous version is same as current version (${currentVersion}). Skipping download.`);
      }
    } else {
      console.warn(`⚠ Could not fetch version.json from Firebase (Status ${versionRes.status}). Skipping previous APK comparison.`);
    }
  } catch (err) {
    console.warn(`⚠ Failed during previous APK fetch/analysis: ${err.message}. Skipping previous APK comparison.`);
  }
}

if (fs.existsSync(paths.apkPath)) {
  const appVersionPath = path.join(repoRoot, 'packages/studio-core/src/lib/appVersion.ts');
  const appVersionSrc = fs.readFileSync(appVersionPath, 'utf8');

  // A. Verify non-debuggable and package manifest attributes
  try {
    const aapt2 = getAndroidTool('aapt2');
    console.log(`Verifying release APK manifest via ${aapt2}...`);
    const manifestXml = execSync(`${aapt2} dump xmltree --file AndroidManifest.xml "${paths.apkPath}"`, { encoding: 'utf8' });
    
    // 1. Debuggable check
    if (manifestXml.includes('http://schemas.android.com/apk/res/android:debuggable') && manifestXml.includes('true')) {
      assert(false, 'The release APK is compiled as debuggable (android:debuggable="true")!', EXIT_CODES.RELEASE_VALIDATION);
    }
    console.log('✓ APK is confirmed to be non-debuggable.');

    // 2. Package name check
    const packageMatch = manifestXml.match(/package="([^"]+)"/);
    assert(packageMatch && packageMatch[1] === 'com.chordex.app', `Package name mismatch! Expected com.chordex.app but found: ${packageMatch ? packageMatch[1] : 'null'}`, EXIT_CODES.RELEASE_VALIDATION);
    if (prevPackageName) {
      assert(packageMatch[1] === prevPackageName, `Package name changed! Previous: ${prevPackageName}, Current: ${packageMatch[1]}`, EXIT_CODES.RELEASE_VALIDATION);
    }
    console.log('✓ APK package name is com.chordex.app.');

    // 3. VersionCode check
    const codeMatch = manifestXml.match(/versionCode\([^)]+\)=(\d+|0x[0-9a-f]+)/i);
    assert(codeMatch, 'Could not parse versionCode from APK manifest!', EXIT_CODES.RELEASE_VALIDATION);
    const versionCodeVal = codeMatch[1].startsWith('0x') ? parseInt(codeMatch[1], 16) : parseInt(codeMatch[1], 10);
    assert(versionCodeVal > 0, `Invalid versionCode parsed: ${versionCodeVal}`, EXIT_CODES.RELEASE_VALIDATION);
    if (prevVersionCode) {
      if (versionCodeVal <= prevVersionCode) {
        if (isDevPreview) {
          console.warn(`⚠ Development warning: versionCode (${versionCodeVal}) is not greater than previous (${prevVersionCode}). Proceeding since --development-preview is enabled.`);
        } else {
          assert(false, `Release blocked: versionCode must increase! Installed/Previous: ${prevVersionCode}, Current: ${versionCodeVal}. Please increment versionCode in build.gradle.`, EXIT_CODES.RELEASE_VALIDATION);
        }
      }
    }
    console.log(`✓ APK versionCode is ${versionCodeVal}.`);

    // 4. VersionName check
    const nameMatch = manifestXml.match(/versionName\([^)]+\)="([^"]+)"/i);
    assert(nameMatch, 'Could not parse versionName from APK manifest!', EXIT_CODES.RELEASE_VALIDATION);
    const versionNameVal = nameMatch[1];
    
    const nativeVersionMatches = [...appVersionSrc.matchAll(/export\s+const\s+NATIVE_VERSION\s*=\s*['"]([^'"]+)['"]/g)];
    if (nativeVersionMatches.length !== 1) {
      assert(false, 'Unable to resolve NATIVE_VERSION from appVersion.ts', EXIT_CODES.RELEASE_VALIDATION);
    }
    const expectedVersionName = nativeVersionMatches[0][1];
    
    if (versionNameVal !== expectedVersionName) {
      if (isDevPreview) {
        console.warn(`⚠ Development warning: VersionName mismatch! Expected ${expectedVersionName} but found: ${versionNameVal}. Proceeding since --development-preview is enabled.`);
      } else {
        assert(false, `VersionName mismatch! Expected ${expectedVersionName} but found: ${versionNameVal}`, EXIT_CODES.RELEASE_VALIDATION);
      }
    }
    console.log(`✓ APK versionName is ${versionNameVal} (matches expected ${expectedVersionName}).`);

    // 5. Verify inner web assets version matches
    const zip = new AdmZip(paths.apkPath);
    const versionEntry = zip.getEntry('assets/public/version.json');
    assert(versionEntry, 'Web assets not bundled correctly: assets/public/version.json is missing in the APK!', EXIT_CODES.RELEASE_VALIDATION);
    
    let innerVersionJson;
    try {
      innerVersionJson = JSON.parse(versionEntry.getData().toString('utf8'));
    } catch (e) {
      assert(false, `Failed to parse assets/public/version.json inside APK: ${e.message}`, EXIT_CODES.RELEASE_VALIDATION);
    }
    
    assert(
      innerVersionJson && innerVersionJson.version === expectedVersionName,
      `Web assets version mismatch! Expected version ${expectedVersionName} inside version.json, but found ${innerVersionJson ? innerVersionJson.version : 'null'}`,
      EXIT_CODES.RELEASE_VALIDATION
    );
    assert(
      innerVersionJson && innerVersionJson.versionCode === versionCodeVal,
      `Web assets versionCode mismatch! Expected versionCode ${versionCodeVal} inside version.json, but found ${innerVersionJson ? innerVersionJson.versionCode : 'null'}`,
      EXIT_CODES.RELEASE_VALIDATION
    );
    console.log(`✓ APK web assets version is ${innerVersionJson.version} (versionCode ${innerVersionJson.versionCode}) matches wrapper version.`);

  } catch (err) {
    assert(false, `Failed to verify manifest configuration: ${err.message}`, EXIT_CODES.RELEASE_VALIDATION);
  }

  // B. Verify signature status
  try {
    const apksigner = getAndroidTool('apksigner');
    console.log(`Verifying release APK signature status via ${apksigner}...`);
    const signInfoVerbose = execSync(`${apksigner} verify --verbose --print-certs "${paths.apkPath}"`, { encoding: 'utf8' });
    if (!signInfoVerbose.includes('SHA-256 digest')) {
      assert(false, 'The release APK is not signed!', EXIT_CODES.RELEASE_VALIDATION);
    }
    console.log('✓ APK is successfully signed.');

    // 1. Signature Scheme Check (V2 or V3 must be true)
    const v2Scheme = /Verified using v2 scheme.*:\s*true/i.test(signInfoVerbose);
    const v3Scheme = /Verified using v3 scheme.*:\s*true/i.test(signInfoVerbose);
    assert(v2Scheme || v3Scheme, 'APK is not signed with a modern signature scheme (V2 or V3 must be true)!', EXIT_CODES.RELEASE_VALIDATION);
    console.log('✓ APK signature scheme (V2/V3) verified successfully.');

    const sha256Match = signInfoVerbose.match(/certificate SHA-256 digest:\s+([a-fA-F0-9:]+)/i);
    const currentSignature = sha256Match ? sha256Match[1].replace(/:/g, '').toLowerCase() : '';
    
    // Check signature consistency with previous release
    const expectedSigMatch = appVersionSrc.match(/export\s+const\s+PRODUCTION_SIGNING_SHA256\s*=\s*['"]([^'"]+)['"]/);
    const expectedProdSignature = expectedSigMatch ? expectedSigMatch[1].toLowerCase().replace(/:/g, '').trim() : '';
    const oldProdSignature = "58b9bf2de5064c62ac3ca181b5608fe135c6894a8359ff6588e19218cd384764";

    if (prevSignature) {
      if (currentSignature !== prevSignature) {
        if (isDevPreview) {
          console.warn(`⚠ Development warning: signing certificate signature fingerprint changed! Previous: ${prevSignature}, Current: ${currentSignature}. Proceeding since --development-preview is enabled.`);
        } else {
          if (process.env.REINSTALL_REQUIRED === 'true') {
            assert(
              prevSignature === oldProdSignature && currentSignature === expectedProdSignature,
              `Controlled reset mismatch! Reset is only allowed from old signature (${oldProdSignature}) to new signature (${expectedProdSignature}). Found previous: ${prevSignature}, current: ${currentSignature}`,
              EXIT_CODES.RELEASE_VALIDATION
            );
            console.log(`✓ Controlled signature reset allowed: upgrading from old cert (${prevSignature}) to new cert (${currentSignature})`);
          } else {
            assert(false, `Release blocked: signing certificate signature fingerprint changed! Previous: ${prevSignature}, Current: ${currentSignature}. (For controlled reset, set REINSTALL_REQUIRED=true)`, EXIT_CODES.RELEASE_VALIDATION);
          }
        }
      }
    }
    
    // Check signature consistency with expected production key
    if (currentSignature !== expectedProdSignature) {
      if (isDevPreview) {
        console.warn(`⚠ Development warning: APK is not signed with the production certificate. Expected: ${expectedProdSignature}, Found: ${currentSignature}`);
      } else {
        assert(false, `Release blocked: APK is not signed with the production certificate! Expected: ${expectedProdSignature}, Found: ${currentSignature}`, EXIT_CODES.RELEASE_VALIDATION);
      }
    }
    console.log('✓ APK signing certificate validation check passed.');

    // 2. Certificate Details Check (Owner, Issuer, Validity)
    try {
      console.log('Verifying certificate Owner, Issuer, and Validity via keytool...');
      const keytoolOut = execSync(`keytool -printcert -jarfile "${paths.apkPath}"`, { encoding: 'utf8' });
      
      const ownerMatch = keytoolOut.match(/Owner:\s*(.*)/i);
      const issuerMatch = keytoolOut.match(/Issuer:\s*(.*)/i);
      const validMatch = keytoolOut.match(/Valid from:\s*(.*?)\s+until:\s*(.*)/i);
      
      assert(ownerMatch, 'Could not parse certificate Owner (Subject) from keytool!', EXIT_CODES.RELEASE_VALIDATION);
      assert(issuerMatch, 'Could not parse certificate Issuer from keytool!', EXIT_CODES.RELEASE_VALIDATION);
      assert(validMatch, 'Could not parse certificate Validity range from keytool!', EXIT_CODES.RELEASE_VALIDATION);
      
      const owner = ownerMatch[1].trim();
      const issuer = issuerMatch[1].trim();
      const validFromStr = validMatch[1].trim();
      const validUntilStr = validMatch[2].trim();
      
      console.log(`Certificate Owner:  ${owner}`);
      console.log(`Certificate Issuer: ${issuer}`);
      console.log(`Validity Window:    ${validFromStr} to ${validUntilStr}`);
      
      assert(owner.length > 0, 'Certificate Owner cannot be empty', EXIT_CODES.RELEASE_VALIDATION);
      assert(issuer.length > 0, 'Certificate Issuer cannot be empty', EXIT_CODES.RELEASE_VALIDATION);
      
      const validFrom = new Date(validFromStr);
      const validUntil = new Date(validUntilStr);
      const now = new Date();
      
      assert(now >= validFrom && now <= validUntil, `Certificate is outside its validity range! Valid from: ${validFromStr} until: ${validUntilStr}`, EXIT_CODES.RELEASE_VALIDATION);
      console.log('✓ Certificate Validity check passed.');
    } catch (err) {
      assert(false, `Failed to verify certificate fields using keytool: ${err.message}`, EXIT_CODES.RELEASE_VALIDATION);
    }

    // 3. Verify local app-release.json matches the generated APK SHA-256
    const appReleasePath = path.join(repoRoot, 'firebase-public/app-release.json');
    if (fs.existsSync(appReleasePath)) {
      try {
        const metadata = JSON.parse(fs.readFileSync(appReleasePath, 'utf8'));
        
        if (metadata.version === expectedVersionName) {
          console.log('Verifying local app-release.json matches the APK SHA-256...');
          
          const crypto = await import('node:crypto');
          const fileBuffer = fs.readFileSync(paths.apkPath);
          const hashSum = crypto.createHash('sha256');
          hashSum.update(fileBuffer);
          const localApkSha = hashSum.digest('hex');
          
          if (metadata.sha256 && metadata.sha256 !== localApkSha) {
            assert(false, `Local metadata SHA-256 (${metadata.sha256}) does not match APK SHA-256 (${localApkSha})!`, EXIT_CODES.RELEASE_VALIDATION);
          }
          console.log('✓ Local app-release.json SHA-256 matches APK hash.');
        } else {
          console.log(`Skipping local app-release.json SHA check because metadata version (${metadata.version}) differs from APK version (${expectedVersionName}). It will be updated later in the pipeline.`);
        }
      } catch (e) {
        console.warn(`⚠ Could not verify app-release.json match: ${e.message}`);
      }
    }

  } catch (err) {
    assert(false, `Failed to verify APK signature: ${err.message}`, EXIT_CODES.RELEASE_VALIDATION);
  }
}

console.log('\x1b[32m=== APPINSTALLER CONTRACT VALIDATION PASSED ===\x1b[0m');
process.exit(0);
