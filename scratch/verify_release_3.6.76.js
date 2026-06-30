import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

async function verify() {
  const version = '3.6.76';
  const apkUrl = `https://github.com/MAGEXE1000/Studio/releases/download/v${version}/studio-${version}.apk`;
  const shaUrl = `https://github.com/MAGEXE1000/Studio/releases/download/v${version}/studio-${version}.apk.sha256`;

  console.log('Downloading remote .sha256 content...');
  const shaRes = await fetch(shaUrl);
  const shaText = await shaRes.text();
  console.log('Remote .sha256 content:', shaText.trim());

  console.log('Downloading remote APK...');
  const apkRes = await fetch(apkUrl);
  if (!apkRes.ok) {
    throw new Error(`Failed to download APK: ${apkRes.status} ${apkRes.statusText}`);
  }
  const apkBuffer = Buffer.from(await apkRes.arrayBuffer());
  const fileSize = apkBuffer.length;
  console.log('Downloaded file size:', fileSize, 'bytes');

  const magic = apkBuffer.subarray(0, 4).toString('hex');
  console.log('First 4 bytes (hex):', magic);
  console.log('First 4 bytes (ascii):', apkBuffer.subarray(0, 4).toString('ascii'));

  const sha256 = crypto.createHash('sha256').update(apkBuffer).digest('hex');
  console.log('Calculated SHA-256 of downloaded APK:', sha256);
}

verify().catch(console.error);
