const TURSO_URL = process.env.TURSO_URL || 'https://queasy-db-xamidullayev-i.aws-eu-north-1.turso.io';
const TURSO_TOKEN = process.env.TURSO_TOKEN || '';

async function test() {
  console.log('Testing connection to Turso Cloud...');
  const res = await fetch(`${TURSO_URL}/v2/pipeline`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TURSO_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      requests: [
        {
          type: 'execute',
          stmt: { sql: 'SELECT 1 + 1 AS sum, sqlite_version() AS version' }
        },
        { type: 'close' }
      ]
    })
  });

  console.log('STATUS:', res.status);
  const data = await res.json();
  console.log('DATA:', JSON.stringify(data, null, 2));
}

test();
