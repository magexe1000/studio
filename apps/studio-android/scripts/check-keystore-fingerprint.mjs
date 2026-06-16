#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import readline from 'node:readline';
import { Writable } from 'node:stream';

const EXPECTED_SHA256 = '58b9bf2de5064c62ac3ca181b5608fe135c6894a8359ff6588e19218cd384764';

function printUsage() {
  console.log('Usage:');
  console.log('  node apps/studio-android/scripts/check-keystore-fingerprint.mjs --keystore <path> [--alias <alias>]');
  console.log('\nOptions:');
  console.log('  --keystore   Path to the candidate keystore file');
  console.log('  --alias      Key alias (if omitted, lists all aliases in the keystore)');
  console.log('\nAlternative: Set STORE_PASS environment variable to bypass interactive password prompt.');
}

function askPassword(query) {
  return new Promise((resolve) => {
    let muted = false;
    const mutableStdout = new Writable({
      write(chunk, encoding, callback) {
        if (!muted) {
          process.stdout.write(chunk, encoding);
        }
        callback();
      }
    });
    const rl = readline.createInterface({
      input: process.stdin,
      output: mutableStdout,
      terminal: true
    });
    process.stdout.write(query);
    muted = true;
    rl.question('', (answer) => {
      muted = false;
      process.stdout.write('\n');
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function main() {
  const args = process.argv.slice(2);
  let keystorePath = null;
  let alias = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--keystore' && args[i + 1]) {
      keystorePath = args[i + 1];
      i++;
    } else if (args[i] === '--alias' && args[i + 1]) {
      alias = args[i + 1];
      i++;
    }
  }

  if (!keystorePath) {
    printUsage();
    process.exit(1);
  }

  if (!fs.existsSync(keystorePath)) {
    console.error(`Error: Keystore file not found at "${keystorePath}"`);
    process.exit(1);
  }

  let storePass = process.env.STORE_PASS || '';
  if (!storePass) {
    storePass = await askPassword('Enter Keystore Password (input will be masked): ');
  }

  if (!alias) {
    console.log(`\nRetrieving aliases from: ${keystorePath}`);
    const keytoolResult = spawnSync('keytool', [
      '-list',
      '-keystore', keystorePath,
      '-storepass', storePass
    ], { encoding: 'utf8' });

    if (keytoolResult.status !== 0) {
      console.error('\nError: Keytool failed. Incorrect password or invalid keystore.');
      const errOut = (keytoolResult.stderr || '').trim();
      if (errOut) console.error(`Details:\n${errOut}`);
      process.exit(1);
    }

    console.log('\nSuccessful connection! Available aliases:');
    const lines = keytoolResult.stdout.split('\n');
    let foundAlias = false;
    for (const line of lines) {
      if (line.includes(',') && !line.includes('Keystore type:')) {
        console.log(`  - ${line.trim()}`);
        foundAlias = true;
      }
    }
    if (!foundAlias) {
      console.log('  No aliases found or could not parse list. Output:');
      console.log(keytoolResult.stdout);
    }
    console.log('\nTo verify a specific alias, run again with: --alias <aliasName>');
    process.exit(0);
  }

  console.log(`\nChecking alias "${alias}" in keystore: ${keystorePath}`);
  const keytoolResult = spawnSync('keytool', [
    '-list', '-v',
    '-keystore', keystorePath,
    '-alias', alias,
    '-storepass', storePass
  ], { encoding: 'utf8' });

  if (keytoolResult.status !== 0) {
    console.error(`\nError: Keytool failed. Incorrect password, missing alias "${alias}", or invalid keystore.`);
    const errOut = (keytoolResult.stderr || '').trim();
    if (errOut) console.error(`Details:\n${errOut}`);
    process.exit(1);
  }

  const output = keytoolResult.stdout;
  const sha256Match = output.match(/SHA256:\s+([A-Fa-f0-9:]+)/);

  if (!sha256Match) {
    console.error('\nError: Could not extract SHA-256 fingerprint from keytool output.');
    console.log('Sample keytool output lines containing fingerprints:');
    const lines = output.split('\n').filter(l => /sha/i.test(l));
    lines.forEach(l => console.log(`  ${l.trim()}`));
    process.exit(1);
  }

  const fingerprint = sha256Match[1].replace(/:/g, '').toLowerCase().trim();
  const matches = (fingerprint === EXPECTED_SHA256);

  console.log('\n=========================================');
  console.log(`Keystore:    ${keystorePath}`);
  console.log(`Alias:       ${alias}`);
  console.log(`Fingerprint: ${fingerprint}`);
  console.log(`Expected:    ${EXPECTED_SHA256}`);
  console.log(`Match:       ${matches ? 'YES' : 'NO'}`);
  console.log('=========================================');

  if (matches) {
    console.log('\nSuccess! This is the correct production keystore.');
  } else {
    console.log('\nWarning: This keystore/alias does NOT match the production certificate.');
  }
}

main().catch(err => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
