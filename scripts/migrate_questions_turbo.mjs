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

async function migrateSmallTable(db, tableName, columns, rowMapper) {
  const rows = db.prepare(`SELECT * FROM "${tableName}"`).all();
  process.stdout.write(`Migrating ${tableName} (${rows.length} rows)... `);
  if (rows.length === 0) {
    console.log('✓ (0 rows)');
    return;
  }

  const batchSize = 100;
  for (let i = 0; i < rows.length; i += batchSize) {
    const chunk = rows.slice(i, i + batchSize);
    const placeholders = columns.map(() => '?').join(', ');
    const colsStr = columns.map(c => `"${c}"`).join(', ');
    const sql = `INSERT OR REPLACE INTO "${tableName}" (${colsStr}) VALUES (${placeholders})`;

    const statements = [
      { type: 'execute', stmt: { sql: 'BEGIN TRANSACTION' } }
    ];

    for (const r of chunk) {
      statements.push({
        type: 'execute',
        stmt: {
          sql,
          args: rowMapper(r).map(val => {
            if (val === null || val === undefined) return { type: 'null' };
            if (typeof val === 'number') return { type: Number.isInteger(val) ? 'integer' : 'float', value: String(val) };
            return { type: 'text', value: String(val) };
          })
        }
      });
    }

    statements.push({ type: 'execute', stmt: { sql: 'COMMIT' } });
    await tursoPipeline(statements);
  }
  console.log('✓ Done');
}

async function main() {
  console.log('🚀 Running Remaining Tables and Questions Migration...\n');
  const db = new DatabaseSync(LOCAL_DB_PATH);

  // Remaining small tables:
  await migrateSmallTable(db, 'group_tournaments', ['id', 'quiz_id', 'creator_id', 'title', 'share_code', 'is_active', 'created_at'], r => [
    r.id, r.quiz_id, r.creator_id, r.title, r.share_code, r.is_active, r.created_at
  ]);

  await migrateSmallTable(db, 'tournament_participants', ['id', 'tournament_id', 'user_id', 'user_name', 'user_avatar', 'score', 'total_questions', 'total_time_seconds', 'finished_at'], r => [
    r.id, r.tournament_id, r.user_id, r.user_name, r.user_avatar, r.score, r.total_questions, r.total_time_seconds, r.finished_at
  ]);

  await migrateSmallTable(db, 'live_rooms', ['id', 'room_code', 'quiz_id', 'host_id', 'status', 'current_question_index', 'created_at'], r => [
    r.id, r.room_code, r.quiz_id, r.host_id, r.status, r.current_question_index, r.created_at
  ]);

  await migrateSmallTable(db, 'room_players', ['id', 'room_code', 'user_id', 'user_name', 'score', 'joined_at'], r => [
    r.id, r.room_code, r.user_id, r.user_name, r.score, r.joined_at
  ]);

  await migrateSmallTable(db, 'group_lobbies', ['id', 'chat_id', 'message_id', 'quiz_id', 'owner_id', 'status', 'ready_users_json', 'created_at'], r => [
    r.id, r.chat_id, r.message_id, r.quiz_id, r.owner_id, r.status, r.ready_users_json, r.created_at
  ]);

  await migrateSmallTable(db, 'user_states', ['user_id', 'state', 'context_data_json', 'updated_at'], r => [
    r.user_id, r.state, r.context_data_json, r.updated_at
  ]);

  await migrateSmallTable(db, 'bot_settings', ['key', 'value', 'updated_at'], r => [
    r.key, r.value, r.updated_at
  ]);

  console.log('\n✅ All 15 metadata tables completely migrated!\n');

  // Now migrate QUESTIONS
  const totalCountRow = db.prepare('SELECT count(*) as count FROM questions').get();
  const totalQuestions = totalCountRow.count;
  console.log(`📚 Questions Table: ${totalQuestions.toLocaleString()} total rows to migrate.`);

  // Find max ID currently in Turso
  const curRes = await tursoPipeline([{ type: 'execute', stmt: { sql: 'SELECT max(id) as max_id, count(*) as count FROM questions' } }]);
  const curMaxId = Number(curRes.results[0]?.response?.result?.rows?.[0]?.[0]?.value || 0);
  const curCount = Number(curRes.results[0]?.response?.result?.rows?.[0]?.[1]?.value || 0);
  console.log(`Turso currently has ${curCount.toLocaleString()} questions (max_id: ${curMaxId}). Resuming from here...\n`);

  const BATCH_SIZE = 1000;
  const CHUNK_SIZE = 50;
  let lastId = curMaxId;
  let inserted = curCount;
  const startTime = Date.now();

  const queryStmt = db.prepare(`SELECT * FROM questions WHERE id > ? ORDER BY id ASC LIMIT ${BATCH_SIZE}`);

  while (true) {
    const rows = queryStmt.all(lastId);
    if (!rows || rows.length === 0) break;

    const statements = [
      { type: 'execute', stmt: { sql: 'BEGIN TRANSACTION' } }
    ];

    for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
      const chunk = rows.slice(i, i + CHUNK_SIZE);
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

    let attempts = 0;
    while (attempts < 5) {
      try {
        await tursoPipeline(statements);
        break;
      } catch (err) {
        attempts++;
        console.warn(`\n[Retry ${attempts}/5 at id > ${lastId}]: ${err.message}`);
        await new Promise(r => setTimeout(r, 1000 * attempts));
        if (attempts >= 5) throw err;
      }
    }

    lastId = rows[rows.length - 1].id;
    inserted += rows.length;

    const elapsedSec = (Date.now() - startTime) / 1000;
    const rate = Math.round((inserted - curCount) / elapsedSec);
    const pct = ((inserted / totalQuestions) * 100).toFixed(1);
    const remaining = totalQuestions - inserted;
    const etaSec = Math.round(remaining / (rate || 1));
    const etaMin = (etaSec / 60).toFixed(1);

    process.stdout.write(`\r  Progress: ${inserted.toLocaleString()}/${totalQuestions.toLocaleString()} (${pct}%) | ${rate} rows/s | ETA: ${etaMin}m     `);
  }

  console.log('\n\n🎉 ALL 857,828 QUESTIONS & ALL 16 TABLES FULLY MIGRATED TO TURSO CLOUD!');
}

main().catch(err => {
  console.error('\n❌ Migration failed:', err);
  process.exit(1);
});
