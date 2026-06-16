import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkgRoot = path.resolve(__dirname, '..');

const searchDirs = [
  path.join(pkgRoot, 'src'),
  path.join(pkgRoot, 'public'),
];

const iconSet = new Set([
  // Basic fallback icons
  'settings', 'close', 'logout', 'delete_forever', 'warning', 'content_copy',
  'photo_camera', 'emoji_emotions', 'check', 'send', 'mark_email_read', 'block',
  'lock_reset', 'verified', 'delete', 'cloud_off', 'progress_activity', 'history',
  'chevron_right', 'search', 'edit', 'add_circle', 'horizontal_rule', 'restart_alt',
  'music_note', 'auto_fix_high', 'chevron_left', 'person'
]);

// Add known avatar icons directly
const AVATAR_ICONS = [
  'person', 'face', 'face_2', 'face_3', 'face_4', 'face_5', 'face_6', 
  'mood', 'sentiment_very_satisfied', 'self_improvement', 'music_note', 'headphones'
];
for (const icon of AVATAR_ICONS) {
  iconSet.add(icon);
}

function scanFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  
  // 1. Static text children: <span className="material-symbols-outlined">settings</span>
  const staticSpanRegex = /<span\s+[^>]*class(?:Name)?=["'][^"']*material-symbols-outlined[^"']*["'][^>]*>\s*([a-z0-9_]{3,30})\s*<\/span>/gi;
  let match;
  while ((match = staticSpanRegex.exec(content)) !== null) {
    iconSet.add(match[1].trim().toLowerCase());
  }

  // 2. Dynamic children expression: <span className="material-symbols-outlined">{...}</span>
  const dynamicSpanRegex = /<span\s+[^>]*class(?:Name)?=["'][^"']*material-symbols-outlined[^"']*["'][^>]*>\s*{([\s\S]*?)}\s*<\/span>/gi;
  while ((match = dynamicSpanRegex.exec(content)) !== null) {
    const expr = match[1];
    const quoteRegex = /['"]([a-z0-9_]{3,30})['"]/gi;
    let qMatch;
    while ((qMatch = quoteRegex.exec(expr)) !== null) {
      iconSet.add(qMatch[1].trim().toLowerCase());
    }
  }

  // 3. Static i elements: <i class="material-symbols-outlined">settings</i>
  const staticIRegex = /<i\s+[^>]*class(?:Name)?=["'][^"']*material-symbols-outlined[^"']*["'][^>]*>\s*([a-z0-9_]{3,30})\s*<\/i>/gi;
  while ((match = staticIRegex.exec(content)) !== null) {
    iconSet.add(match[1].trim().toLowerCase());
  }

  // 4. Dynamic i elements: <i class="material-symbols-outlined">{...}</i>
  const dynamicIRegex = /<i\s+[^>]*class(?:Name)?=["'][^"']*material-symbols-outlined[^"']*["'][^>]*>\s*{([\s\S]*?)}\s*<\/i>/gi;
  while ((match = dynamicIRegex.exec(content)) !== null) {
    const expr = match[1];
    const quoteRegex = /['"]([a-z0-9_]{3,30})['"]/gi;
    let qMatch;
    while ((qMatch = quoteRegex.exec(expr)) !== null) {
      iconSet.add(qMatch[1].trim().toLowerCase());
    }
  }
}

function scanDir(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== 'dist' && entry.name !== '.git') {
        scanDir(fullPath);
      }
    } else if (entry.isFile()) {
      if (/\.(tsx|ts|html|js|css)$/.test(entry.name)) {
        scanFile(fullPath);
      }
    }
  }
}

// Run scan
for (const sDir of searchDirs) {
  if (fs.existsSync(sDir)) {
    scanDir(sDir);
  }
}

// Clean list of icons
const validIcons = Array.from(iconSet).filter(icon => {
  if (!/^[a-z0-9_]{2,30}$/.test(icon)) return false;
  if (/^\d+$/.test(icon)) return false;
  const excludes = new Set(['absolute', 'relative', 'button', 'import', 'from', 'const', 'export', 'class', 'className', 'flex', 'null', 'undefined', 'true', 'false', 'width', 'height', 'color', 'style']);
  return !excludes.has(icon);
});

console.log(`download-subset: → Scan complete. Subsetting ${validIcons.length} unique icon names.`);

// Join and url encode
const textParam = encodeURIComponent(validIcons.join(' ') + ' abcdefghijklmnopqrstuvwxyz_0123456789');
const fontUrl = `https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:FILL@0..1&text=${textParam}`;

function getUrl(url, headers = {}) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    https.get(url, (res) => {
      res.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', (err) => {
      fs.unlinkSync(destPath);
      reject(err);
    });
  });
}

async function run() {
  try {
    const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    const cssContent = await getUrl(fontUrl, { 'User-Agent': userAgent });
    
    // Extract woff2 url
    const woff2Regex = /url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/;
    const match = cssContent.match(woff2Regex);
    if (!match) {
      throw new Error(`Failed to find woff2 URL in CSS: \n${cssContent}`);
    }
    
    const woff2Url = match[1];
    
    const destDir = path.join(pkgRoot, 'public', 'stage-core', 'fonts');
    const destName = 'kJESBvYX7BgnkSrUwT8OhrdQw4oELdPIeeII9v6oDMzBwG-RpA6RzaxHMO1W.woff2';
    const destPath = path.join(destDir, destName);
    
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }
    
    const sizeBefore = fs.existsSync(destPath) ? fs.statSync(destPath).size : 0;
    await downloadFile(woff2Url, destPath);
    const sizeAfter = fs.statSync(destPath).size;
    console.log(`download-subset: ✓ Font optimized: ${(sizeBefore / 1024 / 1024).toFixed(2)} MB → ${(sizeAfter / 1024).toFixed(1)} KB`);
  } catch (err) {
    console.warn('download-subset: ⚠ Failed to optimize font (continuing with existing font for offline build):', err.message || err);
    process.exit(0);
  }
}

run();
