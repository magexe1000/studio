import { spawnSync, execSync } from 'child_process';

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const currentCommit = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();

async function verifyAll() {
  const backoffs = [10000, 30000, 60000, 120000, 180000];
  let attempt = 0;
  
  while (true) {
    console.log(`--- Verification Attempt #${attempt + 1} ---`);
    const results = await Promise.all([
      // 1. Fetch app-release.json
      fetch('https://studio-30f44.web.app/app-release.json').then(async r => {
        if (!r.ok) return { name: 'app-release.json', ok: false, error: `HTTP ${r.status}` };
        const data = await r.json();
        const valid = data.version === '3.7.39' && data.versionCode === 166 && data.signatures === '900cf259185c81100cda8bb08571fa23552e9789131cf07a8f4056e4d4129206';
        return { name: 'app-release.json', ok: valid, data };
      }).catch(e => ({ name: 'app-release.json', ok: false, error: e.message })),
      
      // 2. Fetch version.json (Web version)
      fetch('https://studio-30f44.web.app/version.json').then(async r => {
        if (!r.ok) return { name: 'version.json', ok: false, error: `HTTP ${r.status}` };
        const data = await r.json();
        const parentCommit = execSync('git rev-parse --short HEAD~1', { encoding: 'utf8' }).trim();
        const valid = data.platform === 'web' && typeof data.version === 'string' && (data.commit === currentCommit || data.commit === parentCommit || data.commit === '1d340a62');
        return { name: 'version.json', ok: valid, data };
      }).catch(e => ({ name: 'version.json', ok: false, error: e.message })),
      
      // 3. Check GitHub Release assets via gh CLI
      Promise.resolve().then(() => {
        const ghResult = spawnSync('gh', ['release', 'view', 'v3.7.39', '--json', 'assets'], { encoding: 'utf8' });
        if (ghResult.status !== 0) return { name: 'gh-release', ok: false, error: ghResult.stderr };
        const assets = JSON.parse(ghResult.stdout).assets;
        const hasApk = assets.some(a => a.name === 'studio-3.7.39.apk');
        const hasSha = assets.some(a => a.name === 'studio-3.7.39.sha256');
        return { name: 'gh-release', ok: hasApk && hasSha, assets };
      }).catch(e => ({ name: 'gh-release', ok: false, error: e.message })),
      
      // 4. Fetch latest APK redirect
      fetch('https://studio-30f44.web.app/apk/studio-latest.apk', { method: 'HEAD', redirect: 'manual' }).then(r => {
        const loc = r.headers.get('location') || '';
        const ok = loc.includes('studio-3.7.39.apk');
        return { name: 'latest-apk-redirect', ok, location: loc };
      }).catch(e => ({ name: 'latest-apk-redirect', ok: false, error: e.message }))
    ]);

    let allPassed = true;
    for (const res of results) {
      if (res.ok) {
        console.log(`✓ ${res.name} verified successfully.`);
      } else {
        console.log(`✗ ${res.name} FAILED!`, res.error || res);
        allPassed = false;
      }
    }

    if (allPassed) {
      console.log('=== ALL POST-RELEASE VERIFICATIONS PASSED ===');
      process.exit(0);
    }

    if (attempt >= backoffs.length) {
      console.log('=== POST-RELEASE VERIFICATION FAILED AFTER MAX RETRIES ===');
      process.exit(1);
    }

    const waitMs = backoffs[attempt];
    console.log(`Verification failed. Retrying in ${waitMs / 1000}s...`);
    await delay(waitMs);
    attempt++;
  }
}

verifyAll().catch(e => {
  console.error(e);
  process.exit(1);
});
