import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve('c:/Users/ayuda/.gemini/antigravity/scratch/Studio');

const SCAN_DIRS = [
  path.join(repoRoot, 'packages', 'ui-shared', 'src'),
  path.join(repoRoot, 'packages', 'ui-android', 'src'),
  path.join(repoRoot, 'apps', 'studio-android', 'src'),
];

const IGNORE_FILES = new Set([
  'index.ts',
  'setupTests.ts',
  'EmergencyDebugOverlay.tsx',
  'DevToolsDashboard.tsx',
]);

const MATERIAL_ICONS = new Set([
  'check', 'add', 'delete', 'close', 'arrow_back', 'play_arrow', 'volume_up',
  'swap_horiz', 'tune', 'graphic_eq', 'edit', 'video_library', 'add_circle',
  'science', 'sort', 'mic', 'mic_off', 'insights', 'gavel', 'policy', 'bug_report',
  'info', 'terminal', 'download', 'settings', 'palette', 'language', 'account_circle',
  'contact_support', 'article', 'install_desktop', 'keyboard', 'tune', 'schema',
  'dashboard', 'psychology', 'search', 'cancel', 'done', 'save', 'warning', 'info',
  'error', 'help', 'menu', 'more_vert', 'more_horiz', 'chevron_right', 'chevron_left',
  'expand_more', 'expand_less', 'star', 'star_border', 'bookmark', 'bookmark_border',
  'lock', 'lock_open', 'person', 'email', 'phone', 'cloud', 'cloud_done', 'cloud_off',
  'sync', 'refresh', 'history', 'arrow_upward', 'arrow_downward', 'share', 'reply',
  'send', 'mic_none', 'volume_down', 'volume_mute', 'volume_off', 'skip_next',
  'skip_previous', 'pause', 'stop', 'fast_forward', 'fast_rewind', 'loop', 'shuffle',
  'playlist_add', 'playlist_add_check', 'queue_music', 'music_note', 'album',
  'radio', 'hearing', 'speed', 'timer', 'alarm', 'watch', 'calendar_today',
  'event', 'map', 'pin_drop', 'room', 'home', 'work', 'school', 'local_cafe',
  'local_bar', 'restaurant', 'shopping_cart', 'store', 'credit_card', 'attach_file',
  'attach_money', 'euro_symbol', 'insert_drive_file', 'description', 'folder',
  'folder_open', 'create_new_folder', 'image', 'photo_camera', 'videocam',
  'camera_alt', 'mic_external_on', 'piano', 'music_video', 'lyrics', 'format_list_bulleted'
]);

const ATTRIBUTE_REGEX = /\b(placeholder|label|title|aria-label|description|text|header|subject|body|message)\s*=\s*["']([^"'{<>]+[a-zA-Z]{2,}[^"'{<>]*?)["']/g;
const JSX_TEXT_REGEX = />([^<{>\r\n]*?[a-zA-Z]{3,}[^<{>\r\n]*?)</g;
const LANG_CHECK_REGEX = /\b(language|lang)\s*===?\s*['"]es['"]/g;

// Static string arrays/objects outside components (declared with const/let/var outside function declarations)
const STATIC_DECLARATION_REGEX = /^(?:const|let|var)\s+([A-Z_0-9]+|[a-zA-Z]+Options|[a-zA-Z]+Labels|[a-zA-Z]+Items|[a-zA-Z]+Data)\b[\s\S]*?=[\s\S]*?(?:\[[\s\S]*?\{[\s\S]*?["'][a-zA-Z]{3,}["'][\s\S]*?\}[\s\S]*?\]|\{[\s\S]*?["'][a-zA-Z]{3,}["'][\s\S]*?\})/gm;

let totalIssues = 0;
const results = [];

function scanFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const relPath = path.relative(repoRoot, filePath);
  const fileIssues = [];

  // Remove single line and block comments to avoid false positives
  const cleanContent = content
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*/g, '');

  // 1. Check for hardcoded attributes
  let match;
  ATTRIBUTE_REGEX.lastIndex = 0;
  while ((match = ATTRIBUTE_REGEX.exec(cleanContent)) !== null) {
    const [full, attr, value] = match;
    // Skip if it looks like an icon name or routing link
    if (attr === 'title' && value.length < 5 && /^[A-Z]/.test(value)) continue; // likely chord name/key
    if (value.startsWith('/') || value.includes('://')) continue;
    if (/^[a-z]+[A-Z]/.test(value) && !value.includes(' ')) continue; // camelCase key
    if (MATERIAL_ICONS.has(value.toLowerCase().trim())) continue;
    
    // Find line number
    const lineNum = content.substring(0, match.index).split('\n').length;
    fileIssues.push({
      type: 'Hardcoded Attribute',
      line: lineNum,
      detail: `Attribute '${attr}' is set to hardcoded string: "${value}"`,
    });
  }

  // 2. Check for JSX text
  JSX_TEXT_REGEX.lastIndex = 0;
  while ((match = JSX_TEXT_REGEX.exec(cleanContent)) !== null) {
    const [full, text] = match;
    const trimmed = text.trim();
    if (!trimmed) continue;
    // Skip if it looks like a variable inside brackets, or only special characters
    if (/^\{.*\}$/.test(trimmed)) continue;
    if (/^[0-9\s.:\-\/+*%#|&?!()]+$/.test(trimmed)) continue; // numbers/symbols
    if (/^[A-G][b#]?(?:maj|min|m|dim|aug|sus|add)?\d*$/.test(trimmed)) continue; // chord name
    if (MATERIAL_ICONS.has(trimmed.toLowerCase())) continue;
    if (trimmed.length < 3) continue;

    const lineNum = content.substring(0, match.index).split('\n').length;
    fileIssues.push({
      type: 'Hardcoded JSX Text',
      line: lineNum,
      detail: `JSX element contains hardcoded text: "${trimmed}"`,
    });
  }

  // 3. Check for inline language checks (e.g., lang === 'es')
  LANG_CHECK_REGEX.lastIndex = 0;
  while ((match = LANG_CHECK_REGEX.exec(cleanContent)) !== null) {
    const lineNum = content.substring(0, match.index).split('\n').length;
    fileIssues.push({
      type: 'Hardcoded Language Check',
      line: lineNum,
      detail: `Found inline language conditional: "${match[0]}"`,
    });
  }

  // 4. Check for static declarations containing text strings outside React component scope
  let staticMatch;
  STATIC_DECLARATION_REGEX.lastIndex = 0;
  while ((staticMatch = STATIC_DECLARATION_REGEX.exec(content)) !== null) {
    const [fullDecl, name] = staticMatch;
    // Check if the declaration contains t( or useT
    if (fullDecl.includes('t(') || fullDecl.includes('.t(')) continue;
    // Filter out obviously safe ones
    if (name.toUpperCase() === name && !fullDecl.includes(' ') && fullDecl.length < 200) continue; 
    
    const lineNum = content.substring(0, staticMatch.index).split('\n').length;
    fileIssues.push({
      type: 'Static Non-Reactive Constant',
      line: lineNum,
      detail: `Constant '${name}' is declared outside component and contains text strings.`,
    });
  }

  if (fileIssues.length > 0) {
    results.push({ file: relPath, issues: fileIssues });
    totalIssues += fileIssues.length;
  }
}

function walkDir(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkDir(fullPath);
    } else if (entry.isFile() && (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts'))) {
      if (IGNORE_FILES.has(entry.name)) continue;
      scanFile(fullPath);
    }
  }
}

console.log('=== STARTING I18N VALIDATION SCAN ===');
for (const scanDir of SCAN_DIRS) {
  if (fs.existsSync(scanDir)) {
    walkDir(scanDir);
  }
}

console.log(`Total files with issues: ${results.length}`);
console.log(`Total localization issues: ${totalIssues}\n`);

for (const res of results) {
  console.log(`File: ${res.file} (${res.issues.length} issues)`);
  for (const issue of res.issues) {
    console.log(`  Line ${issue.line} [${issue.type}]: ${issue.detail}`);
  }
  console.log('----------------------------------------------------');
}
