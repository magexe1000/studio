import { S3Client, PutObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { readdir, readFile, stat } from 'fs/promises';
import { join } from 'path';

const ACCOUNT_ID = 'cb1b58df3cb1fc8322d8ad24f4024b5f';
const ACCESS_KEY = '2a635b804682c1d82df2baf2806c53c3';
const SECRET_KEY = '420a8c168aa4976c602e83ca531d59d7c0d5be7d418f4927a1ab5510445fb4d3';
const BUCKET = 'chordex-stems';
const STEMS_DIR = join(process.cwd(), 'artifacts', 'api-server', 'public', 'stems');
const CONCURRENCY = 5;

const client = new S3Client({
  region: 'auto',
  endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: ACCESS_KEY,
    secretAccessKey: SECRET_KEY,
  },
});

async function listExisting() {
  const existing = new Set();
  let token;
  do {
    const res = await client.send(new ListObjectsV2Command({
      Bucket: BUCKET,
      ContinuationToken: token,
    }));
    for (const obj of res.Contents ?? []) {
      existing.add(obj.Key);
    }
    token = res.NextContinuationToken;
  } while (token);
  return existing;
}

async function uploadFile(key, filePath) {
  const body = await readFile(filePath);
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await client.send(new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        Body: body,
        ContentType: 'audio/ogg',
      }));
      return { key, size: body.length, ok: true };
    } catch (err) {
      if (attempt === 2) return { key, ok: false, error: err.message };
      await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
    }
  }
}

async function runPool(tasks, concurrency) {
  let idx = 0;
  let uploaded = 0;
  let errors = 0;
  const total = tasks.length;

  async function worker() {
    while (idx < tasks.length) {
      const i = idx++;
      const task = tasks[i];
      const result = await task();
      if (result.ok) {
        uploaded++;
        console.log(`[${uploaded + errors}/${total}] ✓ ${result.key} (${(result.size / 1024 / 1024).toFixed(1)} MB)`);
      } else {
        errors++;
        console.log(`[${uploaded + errors}/${total}] ✗ ${result.key}: ${result.error}`);
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  return { uploaded, errors };
}

async function main() {
  console.log('Checking existing files in R2...');
  const existing = await listExisting();
  console.log(`Found ${existing.size} files already in bucket\n`);

  const songs = (await readdir(STEMS_DIR)).sort();
  const tasks = [];

  for (const song of songs) {
    const songDir = join(STEMS_DIR, song);
    const s = await stat(songDir);
    if (!s.isDirectory()) continue;

    const files = await readdir(songDir);
    for (const file of files.filter(f => f.endsWith('.ogg'))) {
      const key = `stems/${song}/${file}`;
      if (existing.has(key)) continue;
      const filePath = join(songDir, file);
      tasks.push(() => uploadFile(key, filePath));
    }
  }

  if (tasks.length === 0) {
    console.log('All files already uploaded! Nothing to do.');
    return;
  }

  console.log(`Uploading ${tasks.length} files with ${CONCURRENCY} concurrent workers...\n`);
  const { uploaded, errors } = await runPool(tasks, CONCURRENCY);
  console.log(`\nDone! Uploaded: ${uploaded}, Errors: ${errors}, Already existed: ${existing.size}`);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
