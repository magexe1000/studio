import fs from 'node:fs';

async function main() {
  const tokenFile = 'C:\\Users\\ayuda\\.config\\configstore\\firebase-tools.json';
  if (!fs.existsSync(tokenFile)) {
    console.error('Firebase token file does not exist at:', tokenFile);
    return;
  }
  const tokenData = JSON.parse(fs.readFileSync(tokenFile, 'utf8'));
  const accessToken = tokenData.tokens.access_token;
  
  const headers = {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json'
  };

  const projectId = 'stage-core-22ec0';
  const queryUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:runQuery`;

  const queryBody = {
    structuredQuery: {
      from: [
        {
          collectionId: 'devices',
          allDescendants: true
        }
      ]
    }
  };

  console.log(`\n--- QUERYING ALL DEVICES ACROSS DATABASE (${projectId}) ---`);
  try {
    const res = await fetch(queryUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(queryBody)
    });
    if (!res.ok) {
      console.error('Query failed:', res.status, res.statusText, await res.text());
    } else {
      const data = await res.json();
      console.log('Query result:');
      console.log(JSON.stringify(data, null, 2));
    }
  } catch (err) {
    console.error('Query error:', err);
  }
}

main();
