import fs from 'fs';
import { DatabaseSync } from 'node:sqlite';
import { TURSO_TOKEN } from '../tgcloud/lib/constants/secrets.js';

async function syncToTurso() {
  const currentDb = new DatabaseSync('queasy_ready.sqlite');
  const backupDb = new DatabaseSync('queasy_ready.sqlite.backup_20261110');

  console.log('Comparing current SQLite with backup to identify modified questions...');
  
  const currentRows = currentDb.prepare('SELECT id, question_text, options_json, correct_option_id FROM questions').all();
  const backupMap = new Map();
  const bRows = backupDb.prepare('SELECT id, question_text, options_json, correct_option_id FROM questions').all();
  for (const r of bRows) {
    backupMap.set(r.id, r);
  }

  const modified = [];
  for (const c of currentRows) {
    const b = backupMap.get(c.id);
    if (!b) continue;
    if (b.options_json !== c.options_json || b.question_text !== c.question_text || b.correct_option_id !== c.correct_option_id) {
      modified.push(c);
    }
  }

  console.log(`Total modified questions to sync to Turso: ${modified.length}`);

  const TURSO_URL = 'https://queasy-db-xamidullayev-i.aws-eu-north-1.turso.io';
  const httpsUrl = TURSO_URL.replace(/^libsql:\/\//, 'https://');

  const batchSize = 100;
  let synced = 0;

  for (let i = 0; i < modified.length; i += batchSize) {
    const batch = modified.slice(i, i + batchSize);
    const requests = batch.map(q => ({
      type: 'execute',
      stmt: {
        sql: 'UPDATE questions SET question_text = ?, options_json = ?, correct_option_id = ? WHERE id = ?',
        args: [
          { type: 'text', value: q.question_text },
          { type: 'text', value: q.options_json },
          { type: 'integer', value: String(q.correct_option_id) },
          { type: 'integer', value: String(q.id) }
        ]
      }
    }));
    requests.push({ type: 'close' });

    let attempts = 0;
    while (attempts < 3) {
      try {
        const res = await fetch(`${httpsUrl}/v2/pipeline`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${TURSO_TOKEN}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ requests })
        });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${await res.text()}`);
        }
        synced += batch.length;
        process.stdout.write(`Synced ${synced} / ${modified.length} questions to Turso...\r`);
        break;
      } catch (err) {
        attempts++;
        console.warn(`Retry attempt ${attempts} for batch ${i / batchSize}...`, err.message);
        await new Promise(r => setTimeout(r, 1000));
        if (attempts >= 3) throw err;
      }
    }
  }

  console.log(`\nSuccessfully synced all ${synced} updated questions to Turso Cloud!`);
  currentDb.close();
  backupDb.close();
}

syncToTurso().catch(console.error);
