import fs from 'node:fs';

const content = fs.readFileSync('packages/studio-core/src/data/progressions.ts', 'utf8');

// Find all places where id: is defined in objects
const matches = content.match(/id:\s*['"][^'"]+['"]/g);
console.log('Total id tags in progressions.ts:', matches ? matches.length : 0);

// Find the Wonderwall definition to see how it looks
const wonderwallIdx = content.indexOf('wonderwall');
if (wonderwallIdx !== -1) {
  console.log('Wonderwall surrounding code:\n', content.substring(wonderwallIdx - 100, wonderwallIdx + 400));
}
