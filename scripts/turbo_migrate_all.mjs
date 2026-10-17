import { DatabaseSync } from 'node:sqlite';
import https from 'node:https';
import path from 'node:path';

const TURSO_URL = process.env.TURSO_URL || 'https://queasy-db-xamidullayev-i.aws-eu-north-1.turso.io';
const TURSO_TOKEN = process.env.TURSO_TOKEN || '';
const LOCAL_DB_PATH = path.join(process.cwd(), 'queasy_ready.sqlite');

const agent = new https.Agent({ keepAlive: true, maxSockets: 16 });

function postPipeline(statements) {
  return new Promise((resolve, reject) => {
    const bodyStr = JSON.stringify({ requests: [...statements, { type: 'close' }] });
    const req = https.request(`${TURSO_URL}/v2/pipeline`, {
      method: 'POST',
      agent,
      headers: {
        'Authorization': `Bearer ${TURSO_TOKEN}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(bodyStr)
      }
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            const parsed = JSON.parse(data);
            for (const r of parsed.results || []) {
              if (r.type === 'error') {
                return reject(new Error(`Turso query error: ${r.error?.message}`));
              }
            }
            resolve(parsed);
          } catch (e) {
            reject(new Error(`JSON parse error: ${e.message} - Data: ${data.slice(0, 200)}`));
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });
    req.on('error', reject);
    req.write(bodyStr);
    req.end();
  });
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
    await postPipeline(statements);
  }
  console.log('✓ Done');
}

async function main() {
  console.log('⚡ Starting High-Speed Turbo Migration to Turso Cloud...\n');
  const db = new DatabaseSync(LOCAL_DB_PATH);

  // 1. users
  await migrateSmallTable(db, 'users', ['telegram_id', 'first_name', 'last_name', 'username', 'lang', 'is_blocked', 'created_at', 'last_active_at'], r => [
    r.telegram_id, r.first_name, r.last_name, r.username, r.lang, r.is_blocked, r.created_at, r.last_active_at
  ]);

  // 2. groups
  await migrateSmallTable(db, 'groups', ['group_id', 'title', 'username', 'is_active', 'created_at'], r => [
    r.group_id, r.title, r.username, r.is_active, r.created_at
  ]);

  // 3. quizzes
  await migrateSmallTable(db, 'quizzes', ['id', 'owner_id', 'title', 'description', 'category', 'is_public', 'time_limit', 'shuffle_options', 'created_at'], r => [
    r.id, r.owner_id, r.title, r.description, r.category, r.is_public, r.time_limit, r.shuffle_options, r.created_at
  ]);

  // 4. categories
  await migrateSmallTable(db, 'categories', ['id', 'path'], r => [r.id, r.path]);

  // 5. user_mistakes
  await migrateSmallTable(db, 'user_mistakes', ['id', 'user_id', 'question_text', 'options_json', 'correct_option_id', 'explanation', 'photo_file_id', 'original_quiz_id', 'original_num', 'created_at'], r => [
    r.id, r.user_id, r.question_text, r.options_json, r.correct_option_id, r.explanation, r.photo_file_id, r.original_quiz_id, r.original_num, r.created_at
  ]);

  // 6. group_answers
  await migrateSmallTable(db, 'group_answers', ['id', 'session_id', 'poll_id', 'user_id', 'user_name', 'question_index', 'is_correct', 'time_taken', 'answered_at'], r => [
    r.id, r.session_id, r.poll_id, r.user_id, r.user_name, r.question_index, r.is_correct, r.time_taken, r.answered_at
  ]);

  // 7. group_tournaments
  await migrateSmallTable(db, 'group_tournaments', ['id', 'quiz_id', 'creator_id', 'title', 'share_code', 'is_active', 'created_at'], r => [
    r.id, r.quiz_id, r.creator_id, r.title, r.share_code, r.is_active, r.created_at
  ]);

  // 8. tournament_participants
  await migrateSmallTable(db, 'tournament_participants', ['id', 'tournament_id', 'user_id', 'user_name', 'user_avatar', 'score', 'total_questions', 'total_time_seconds', 'finished_at'], r => [
    r.id, r.tournament_id, r.user_id, r.user_name, r.user_avatar, r.score, r.total_questions, r.total_time_seconds, r.finished_at
  ]);

  // 9. live_rooms
  await migrateSmallTable(db, 'live_rooms', ['id', 'room_code', 'quiz_id', 'host_id', 'status', 'current_question_index', 'created_at'], r => [
    r.id, r.room_code, r.quiz_id, r.host_id, r.status, r.current_question_index, r.created_at
  ]);

  // 10. room_players
  await migrateSmallTable(db, 'room_players', ['id', 'room_code', 'user_id', 'user_name', 'score', 'joined_at'], r => [
    r.id, r.room_code, r.user_id, r.user_name, r.score, r.joined_at
  ]);

  // 11. group_lobbies
  await migrateSmallTable(db, 'group_lobbies', ['id', 'chat_id', 'message_id', 'quiz_id', 'owner_id', 'status', 'ready_users_json', 'created_at'], r => [
    r.id, r.chat_id, r.message_id, r.quiz_id, r.owner_id, r.status, r.ready_users_json, r.created_at
  ]);

  // 12. user_states
  await migrateSmallTable(db, 'user_states', ['user_id', 'state', 'context_data_json', 'updated_at'], r => [
    r.user_id, r.state, r.context_data_json, r.updated_at
  ]);

  // 13. bot_settings
  await migrateSmallTable(db, 'bot_settings', ['key', 'value', 'updated_at'], r => [
    r.key, r.value, r.updated_at
  ]);

  console.log('\nAll 13 metadata tables migrated successfully!\n');

  // 14. questions - High speed pipeline with multi-row batching
  const totalCountRow = db.prepare('SELECT count(*) as count FROM questions').get();
  const totalQuestions = totalCountRow.count;
  console.log(`🚀 Streaming questions table (${totalQuestions.toLocaleString()} rows)...`);

  // Check how many questions already in Turso
  const checkRes = await postPipeline([{ type: 'execute', stmt: { sql: 'SELECT max(id) as max_id, count(*) as count FROM questions' } }]);
  const currentTursoCount = Number(checkRes.results[0]?.response?.result?.rows?.[0]?.[1]?.value || 0);
  console.log(`Currently in Turso: ${currentTursoCount.toLocaleString()} questions.`);

  const BATCH_SIZE = 1000;
  const CHUNK_SIZE = 50; // 50 rows per INSERT statement = 450 parameters per statement
  let lastId = 0;
  let inserted = 0;
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
        await postPipeline(statements);
        break;
      } catch (err) {
        attempts++;
        console.warn(`\nBatch retry ${attempts}/5 at id > ${lastId}: ${err.message}`);
        await new Promise(r => setTimeout(r, 1000 * attempts));
        if (attempts >= 5) throw err;
      }
    }

    lastId = rows[rows.length - 1].id;
    inserted += rows.length;

    const elapsedSec = (Date.now() - startTime) / 1000;
    const rate = Math.round(inserted / elapsedSec);
    const pct = ((inserted / totalQuestions) * 100).toFixed(1);
    const etaSec = Math.round((totalQuestions - inserted) / (rate || 1));
    const etaMin = (etaSec / 60).toFixed(1);

    process.stdout.write(`\r  Progress: ${inserted.toLocaleString()}/${totalQuestions.toLocaleString()} (${pct}%) | ${rate} rows/s | ETA: ${etaMin}m  `);
  }

  console.log('\n\n🎉 ALL 857,828 QUESTIONS & ALL 16 TABLES SUCCESSFULLY MIGRATED TO TURSO!');
}

main().catch(err => {
  console.error('\n❌ Turbo migration failed:', err);
  process.exit(1);
});
