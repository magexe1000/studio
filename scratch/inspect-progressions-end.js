import fs from 'node:fs';

const content = fs.readFileSync('packages/studio-core/src/data/progressions.ts', 'utf8');
const lines = content.split('\n');
console.log('Last 80 lines of progressions.ts:\n');
console.log(lines.slice(-80).join('\n'));
