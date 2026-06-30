import fs from 'node:fs';
import path from 'node:path';

const file = 'c:/Users/ayuda/.gemini/antigravity/scratch/Studio/packages/ui-shared/src/components/StudioHub.tsx';
const content = fs.readFileSync(file, 'utf8');

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

// Remove comments
const cleanContent = content
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\/\/.*/g, '');

const issues = [];

let match;
ATTRIBUTE_REGEX.lastIndex = 0;
while ((match = ATTRIBUTE_REGEX.exec(cleanContent)) !== null) {
  const [full, attr, value] = match;
  if (attr === 'title' && value.length < 5 && /^[A-Z]/.test(value)) continue; 
  if (value.startsWith('/') || value.includes('://')) continue;
  if (/^[a-z]+[A-Z]/.test(value) && !value.includes(' ')) continue; 
  if (MATERIAL_ICONS.has(value.toLowerCase().trim())) continue;
  
  const lineNum = content.substring(0, match.index).split('\n').length;
  issues.push({ type: 'Attribute', line: lineNum, detail: `${attr}="${value}"` });
}

JSX_TEXT_REGEX.lastIndex = 0;
while ((match = JSX_TEXT_REGEX.exec(cleanContent)) !== null) {
  const [full, text] = match;
  const trimmed = text.trim();
  if (!trimmed) continue;
  if (/^\{.*\}$/.test(trimmed)) continue;
  if (/^[0-9\s.:\-\/+*%#|&?!()]+$/.test(trimmed)) continue; 
  if (/^[A-G][b#]?(?:maj|min|m|dim|aug|sus|add)?\d*$/.test(trimmed)) continue; 
  if (MATERIAL_ICONS.has(trimmed.toLowerCase())) continue;
  if (trimmed.length < 3) continue;

  const lineNum = content.substring(0, match.index).split('\n').length;
  issues.push({ type: 'JSX Text', line: lineNum, detail: `Text: "${trimmed}"` });
}

LANG_CHECK_REGEX.lastIndex = 0;
while ((match = LANG_CHECK_REGEX.exec(cleanContent)) !== null) {
  const lineNum = content.substring(0, match.index).split('\n').length;
  issues.push({ type: 'Lang Check', line: lineNum, detail: `Conditional: "${match[0]}"` });
}

console.log(`StudioHub.tsx: Found ${issues.length} issues`);
for (const issue of issues) {
  console.log(`Line ${issue.line} [${issue.type}]: ${issue.detail}`);
}
