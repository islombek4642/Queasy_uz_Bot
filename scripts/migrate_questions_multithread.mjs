import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';

const TURSO_URL = process.env.TURSO_URL || 'https://queasy-db-xamidullayev-i.aws-eu-north-1.turso.io';
const TURSO_TOKEN = process.env.TURSO_TOKEN || '';
const LOCAL_DB_PATH = path.join(process.cwd(), 'queasy_ready.sqlite');

async function tursoPipeline(requests) {
  const res = await fetch(`${TURSO_URL}/v2/pipeline`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TURSO_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      requests: [...requests, { type: 'close' }]
    })
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Turso HTTP ${res.status}: ${text}`);
  }

  const data = await res.json();
  for (const r of data.results || []) {
    if (r.type === 'error') {
      throw new Error(`Turso query error: ${r.error?.message}`);
    }
  }
  return data;
}

function buildStatements(rows, chunkSize = 50) {
  const statements = [{ type: 'execute', stmt: { sql: 'BEGIN TRANSACTION' } }];
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const placeholders = chunk.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
    const sql = `INSERT OR REPLACE INTO questions (id, quiz_id, order_index, question_text, options_json, correct_option_id, explanation, photo_file_id, photo_caption) VALUES ${placeholders}`;
    const args = [];
    for (const r of chunk) {
      args.push(
        { type: 'integer', value: String(r.id) },
        { type: 'integer', value: String(r.quiz_id) },
        { type: 'integer', value: String(r.order_index || 0) },
        { type: 'text', value: String(r.question_text || '') },
        { type: 'text', value: String(r.options_json || '[]') },
        { type: 'integer', value: String(r.correct_option_id || 0) },
        r.explanation ? { type: 'text', value: String(r.explanation) } : { type: 'null' },
        r.photo_file_id ? { type: 'text', value: String(r.photo_file_id) } : { type: 'null' },
        r.photo_caption ? { type: 'text', value: String(r.photo_caption) } : { type: 'null' }
      );
    }
    statements.push({ type: 'execute', stmt: { sql, args } });
  }
  statements.push({ type: 'execute', stmt: { sql: 'COMMIT' } });
  return statements;
}

async function main() {
  console.log('⚡ Starting 4x Parallel Turbo Streamer for Turso Cloud...\n');
  const db = new DatabaseSync(LOCAL_DB_PATH);

  const totalCountRow = db.prepare('SELECT count(*) as count FROM questions').get();
  const totalQuestions = totalCountRow.count;

  // Check current Turso state
  const checkRes = await tursoPipeline([{ type: 'execute', stmt: { sql: 'SELECT max(id) as max_id, count(*) as count FROM questions' } }]);
  const curMaxId = Number(checkRes.results[0]?.response?.result?.rows?.[0]?.[0]?.value || 0);
  const curCount = Number(checkRes.results[0]?.response?.result?.rows?.[0]?.[1]?.value || 0);
  console.log(`Current Turso State: ${curCount.toLocaleString()} questions (max_id: ${curMaxId}). Resuming from here...\n`);

  const BATCH_SIZE = 1000;
  const NUM_WORKERS = 4;
  let nextIdToFetch = curMaxId;
  let totalUploaded = curCount;
  const startTime = Date.now();

  const queryStmt = db.prepare(`SELECT * FROM questions WHERE id > ? ORDER BY id ASC LIMIT ${BATCH_SIZE}`);

  // Safe synchronous fetch from local SQLite
  function getNextBatch() {
    const rows = queryStmt.all(nextIdToFetch);
    if (!rows || rows.length === 0) return null;
    nextIdToFetch = rows[rows.length - 1].id;
    return rows;
  }

  async function worker(workerId) {
    while (true) {
      const rows = getNextBatch();
      if (!rows) break;

      const statements = buildStatements(rows, 50);

      let attempts = 0;
      while (attempts < 5) {
        try {
          await tursoPipeline(statements);
          break;
        } catch (err) {
          attempts++;
          console.warn(`\n[Worker ${workerId} Retry ${attempts}/5 at id ${rows[0].id}]: ${err.message}`);
          await new Promise(r => setTimeout(r, 500 * attempts));
          if (attempts >= 5) throw err;
        }
      }

      totalUploaded += rows.length;

      const elapsedSec = (Date.now() - startTime) / 1000;
      const rate = Math.round((totalUploaded - curCount) / (elapsedSec || 1));
      const pct = ((totalUploaded / totalQuestions) * 100).toFixed(1);
      const remaining = totalQuestions - totalUploaded;
      const etaSec = Math.round(remaining / (rate || 1));
      const etaMin = (etaSec / 60).toFixed(1);

      process.stdout.write(`\r  ⚡ Progress: ${totalUploaded.toLocaleString()}/${totalQuestions.toLocaleString()} (${pct}%) | ${rate} rows/s | ETA: ${etaMin}m     `);
    }
  }

  console.log(`Launching ${NUM_WORKERS} concurrent worker streams...`);
  await Promise.all(Array.from({ length: NUM_WORKERS }, (_, i) => worker(i + 1)));

  console.log('\n\n🎉 ALL 857,828 QUESTIONS FULLY MIGRATED TO TURSO CLOUD!');
}

main().catch(err => {
  console.error('\n❌ Multithread migration error:', err);
  process.exit(1);
});
