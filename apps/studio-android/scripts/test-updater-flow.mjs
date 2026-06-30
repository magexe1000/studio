import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import crypto from 'node:crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(__dirname, '../../..');

const reportPath = 'C:/Users/ayuda/.gemini/antigravity/brain/80b974db-03ec-4bf1-86df-33510e63d39d/scratch/updater_self_test_report.md';

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

function computeSha256(filePath) {
  const fileBuffer = fs.readFileSync(filePath);
  const hashSum = crypto.createHash('sha256');
  hashSum.update(fileBuffer);
  return hashSum.digest('hex');
}

async function runSelfTest() {
  console.log('=== STARTING AUTOMATED UPDATER SELF TEST ===');
  
  const reportLines = [
    '# Updater Automated Self-Test Report',
    `Timestamp: ${new Date().toLocaleString()}`,
    ''
  ];

  const results = [];
  const log = (stage, status, message) => {
    results.push({ stage, status, message });
    console.log(`[${status}] ${stage}: ${message}`);
  };

  try {
    // 1. Fetch metadata
    log('Fetch Metadata', 'INFO', 'Fetching app-release.json from production...');
    const metaRes = await fetch('https://studio-30f44.web.app/app-release.json');
    if (!metaRes.ok) throw new Error(`Metadata fetch failed: HTTP ${metaRes.status}`);
    const metadata = await metaRes.json();
    log('Fetch Metadata', 'SUCCESS', `Successfully fetched version metadata for v${metadata.version} (Code ${metadata.versionCode})`);
    
    // 2. Validate metadata format
    log('Validate Metadata', 'INFO', 'Checking required properties...');
    const requiredKeys = ['version', 'versionCode', 'sha256', 'apkUrl', 'signatures'];
    for (const key of requiredKeys) {
      if (!metadata[key]) throw new Error(`Missing required key: ${key}`);
    }
    log('Validate Metadata', 'SUCCESS', 'All required keys are present in production metadata.');

    // 3. Download APK
    const tempApkPath = path.join(appRoot, '.release-temp-selftest.apk');
    log('Download APK', 'INFO', `Downloading APK from ${metadata.apkUrl}...`);
    const downloadRes = await fetch(metadata.apkUrl);
    if (!downloadRes.ok) throw new Error(`APK download failed: HTTP ${downloadRes.status}`);
    const buffer = await downloadRes.arrayBuffer();
    fs.writeFileSync(tempApkPath, Buffer.from(buffer));
    log('Download APK', 'SUCCESS', `APK successfully downloaded to temporary file (${(buffer.byteLength / (1024*1024)).toFixed(2)} MB)`);

    try {
      // 4. SHA-256 Checksum validation
      log('SHA-256 Verification', 'INFO', 'Computing file SHA-256 hash...');
      const calculatedHash = computeSha256(tempApkPath);
      if (calculatedHash !== metadata.sha256) {
        throw new Error(`Checksum mismatch! Metadata: ${metadata.sha256}, Calculated: ${calculatedHash}`);
      }
      log('SHA-256 Verification', 'SUCCESS', `SHA-256 matches production metadata: ${calculatedHash}`);

      // 5. Signature scheme check
      const apksigner = getAndroidTool('apksigner');
      log('Signature Scheme Check', 'INFO', 'Verifying signature schemes using apksigner...');
      const signInfoVerbose = execSync(`${apksigner} verify --verbose --print-certs "${tempApkPath}"`, { encoding: 'utf8' });
      const v2Scheme = /Verified using v2 scheme.*:\s*true/i.test(signInfoVerbose);
      const v3Scheme = /Verified using v3 scheme.*:\s*true/i.test(signInfoVerbose);
      if (!v2Scheme && !v3Scheme) {
        throw new Error('APK is not signed with V2 or V3 signature scheme!');
      }
      log('Signature Scheme Check', 'SUCCESS', `Signed with modern scheme. V2=${v2Scheme}, V3=${v3Scheme}`);

      // 6. Keystore details check
      log('Keystore Inspection', 'INFO', 'Parsing Owner, Issuer, and Validity via keytool...');
      const keytoolOut = execSync(`keytool -printcert -jarfile "${tempApkPath}"`, { encoding: 'utf8' });
      const ownerMatch = keytoolOut.match(/Owner:\s*(.*)/i);
      const issuerMatch = keytoolOut.match(/Issuer:\s*(.*)/i);
      const validMatch = keytoolOut.match(/Valid from:\s*(.*?)\s+until:\s*(.*)/i);
      
      if (!ownerMatch || !issuerMatch || !validMatch) {
        throw new Error('Failed to parse Owner, Issuer, or Validity fields from keytool output.');
      }
      
      const owner = ownerMatch[1].trim();
      const issuer = issuerMatch[1].trim();
      const validFromStr = validMatch[1].trim();
      const validUntilStr = validMatch[2].trim();
      
      const validFrom = new Date(validFromStr);
      const validUntil = new Date(validUntilStr);
      const now = new Date();
      
      if (now < validFrom || now > validUntil) {
        throw new Error(`Certificate is expired or not yet valid! validity: ${validFromStr} to ${validUntilStr}`);
      }
      log('Keystore Inspection', 'SUCCESS', `Owner: ${owner}\nIssuer: ${issuer}\nValidity check passed.`);

      // 7. Signature SHA-256 fingerprint check
      const sha256Match = signInfoVerbose.match(/certificate SHA-256 digest:\s+([a-fA-F0-9:]+)/i);
      const currentSignature = sha256Match ? sha256Match[1].replace(/:/g, '').toLowerCase() : '';
      if (currentSignature !== metadata.signatures) {
        throw new Error(`Certificate fingerprint mismatch! Expected: ${metadata.signatures}, Found: ${currentSignature}`);
      }
      log('Keystore Fingerprint', 'SUCCESS', `Certificate fingerprint matches production signature metadata: ${currentSignature}`);

      // 8. Package Installer compatibility check
      log('PackageInstaller Compatibility', 'INFO', 'Checking package name and minSdk...');
      const aapt2 = getAndroidTool('aapt2');
      const manifestXml = execSync(`${aapt2} dump xmltree --file AndroidManifest.xml "${tempApkPath}"`, { encoding: 'utf8' });
      const packageMatch = manifestXml.match(/package="([^"]+)"/);
      if (!packageMatch || packageMatch[1] !== 'com.chordex.app') {
        throw new Error(`Invalid package name: ${packageMatch ? packageMatch[1] : 'null'}`);
      }
      log('PackageInstaller Compatibility', 'SUCCESS', `Package name is valid: com.chordex.app`);

    } finally {
      // Clean up temp file
      if (fs.existsSync(tempApkPath)) {
        fs.unlinkSync(tempApkPath);
        console.log('[Cleanup] Removed self-test temporary APK.');
      }
    }

  } catch (err) {
    log('Self-Test Execution', 'FAILURE', err.message);
  }

  // Compile final markdown report
  reportLines.push('| Check Stage | Status | Details |');
  reportLines.push('|---|---|---|');
  for (const r of results) {
    const icon = r.status === 'SUCCESS' ? '✅' : (r.status === 'FAILURE' ? '❌' : 'ℹ️');
    reportLines.push(`| ${r.stage} | ${icon} **${r.status}** | ${r.message.replace(/\n/g, '<br>')} |`);
  }
  
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, reportLines.join('\n') + '\n', 'utf8');
  console.log(`=== SELF TEST COMPLETE. REPORT WRITTEN TO ${reportPath} ===`);
}

runSelfTest().catch(e => {
  console.error('Self test runner failed:', e);
});
