import fs from 'fs';
import path from 'path';
import { DatabaseSync } from 'node:sqlite';

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

async function execSQL(sql) {
  return tursoPipeline([{ type: 'execute', stmt: { sql } }]);
}

async function main() {
  console.log('🚀 Starting Full Migration from queasy_ready.sqlite to Turso Cloud...');
  const localDb = new DatabaseSync(LOCAL_DB_PATH);

  console.log('\n1. Creating Schema in Turso...');
  const schemaStatements = [
    `CREATE TABLE IF NOT EXISTS users (
      telegram_id INTEGER PRIMARY KEY,
      first_name TEXT NOT NULL,
      last_name TEXT,
      username TEXT,
      lang TEXT NOT NULL DEFAULT 'UZ',
      is_blocked INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER DEFAULT (unixepoch()),
      last_active_at INTEGER
    )`,
    `CREATE INDEX IF NOT EXISTS idx_users_created_at ON users (created_at)`,

    `CREATE TABLE IF NOT EXISTS "groups" (
      group_id INTEGER PRIMARY KEY,
      title TEXT NOT NULL,
      username TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER DEFAULT (unixepoch())
    )`,
    `CREATE INDEX IF NOT EXISTS idx_groups_created_at ON "groups" (created_at)`,
    `CREATE INDEX IF NOT EXISTS idx_groups_is_active ON "groups" (is_active)`,

    `CREATE TABLE IF NOT EXISTS quizzes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      owner_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      category TEXT,
      is_public INTEGER NOT NULL DEFAULT 0,
      time_limit INTEGER NOT NULL DEFAULT 30,
      shuffle_options INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER DEFAULT (unixepoch())
    )`,
    `CREATE INDEX IF NOT EXISTS idx_quizzes_owner_id ON quizzes (owner_id)`,
    `CREATE INDEX IF NOT EXISTS idx_quizzes_category ON quizzes (category)`,
    `CREATE INDEX IF NOT EXISTS idx_quizzes_is_public ON quizzes (is_public)`,

    `CREATE TABLE IF NOT EXISTS questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quiz_id INTEGER NOT NULL,
      order_index INTEGER NOT NULL DEFAULT 0,
      question_text TEXT NOT NULL,
      options_json TEXT NOT NULL,
      correct_option_id INTEGER NOT NULL,
      explanation TEXT,
      photo_file_id TEXT,
      photo_caption TEXT
    )`,
    `CREATE INDEX IF NOT EXISTS idx_questions_quiz_id ON questions (quiz_id)`,

    `CREATE TABLE IF NOT EXISTS user_mistakes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      question_text TEXT NOT NULL,
      options_json TEXT NOT NULL,
      correct_option_id INTEGER NOT NULL,
      explanation TEXT,
      photo_file_id TEXT,
      original_quiz_id INTEGER,
      original_num INTEGER,
      created_at INTEGER DEFAULT (unixepoch())
    )`,
    `CREATE INDEX IF NOT EXISTS idx_mistakes_user_id ON user_mistakes (user_id)`,

    `CREATE TABLE IF NOT EXISTS quiz_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quiz_id INTEGER NOT NULL,
      chat_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      is_group INTEGER NOT NULL DEFAULT 0,
      mode TEXT NOT NULL DEFAULT 'full',
      current_index INTEGER NOT NULL DEFAULT 0,
      total_questions INTEGER NOT NULL,
      correct_count INTEGER NOT NULL DEFAULT 0,
      wrong_count INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      last_poll_id TEXT,
      last_poll_msg_id INTEGER,
      last_poll_sent_at INTEGER,
      selected_questions_json TEXT,
      started_at INTEGER DEFAULT (unixepoch())
    )`,
    `CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON quiz_sessions (user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_sessions_is_active ON quiz_sessions (is_active)`,

    `CREATE TABLE IF NOT EXISTS group_answers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL,
      poll_id TEXT NOT NULL,
      user_id INTEGER NOT NULL,
      user_name TEXT NOT NULL,
      question_index INTEGER NOT NULL,
      is_correct INTEGER NOT NULL,
      time_taken INTEGER DEFAULT 0,
      answered_at INTEGER DEFAULT (unixepoch())
    )`,

    `CREATE TABLE IF NOT EXISTS required_channels (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      channel_id TEXT NOT NULL,
      channel_username TEXT,
      title TEXT NOT NULL,
      invite_link TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER DEFAULT (unixepoch())
    )`,

    `CREATE TABLE IF NOT EXISTS user_states (
      user_id INTEGER PRIMARY KEY,
      state TEXT NOT NULL,
      context_data_json TEXT,
      updated_at INTEGER DEFAULT (unixepoch())
    )`,

    `CREATE TABLE IF NOT EXISTS bot_settings (
      "key" TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at INTEGER DEFAULT (unixepoch())
    )`,

    `CREATE TABLE IF NOT EXISTS group_lobbies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id INTEGER NOT NULL,
      message_id INTEGER,
      quiz_id INTEGER NOT NULL,
      owner_id INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'waiting',
      ready_users_json TEXT NOT NULL DEFAULT '[]',
      created_at INTEGER DEFAULT (unixepoch())
    )`,

    `CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      path TEXT NOT NULL UNIQUE
    )`,

    `CREATE TABLE IF NOT EXISTS group_tournaments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quiz_id INTEGER NOT NULL,
      creator_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      share_code TEXT NOT NULL UNIQUE,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER DEFAULT (unixepoch())
    )`,

    `CREATE TABLE IF NOT EXISTS tournament_participants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tournament_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      user_name TEXT NOT NULL,
      user_avatar TEXT,
      score INTEGER NOT NULL DEFAULT 0,
      total_questions INTEGER NOT NULL,
      total_time_seconds INTEGER NOT NULL DEFAULT 0,
      finished_at INTEGER DEFAULT (unixepoch())
    )`,

    `CREATE TABLE IF NOT EXISTS live_rooms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      room_code TEXT NOT NULL UNIQUE,
      quiz_id INTEGER NOT NULL,
      host_id INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'waiting',
      current_question_index INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER DEFAULT (unixepoch())
    )`,

    `CREATE TABLE IF NOT EXISTS room_players (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      room_code TEXT NOT NULL,
      user_id INTEGER NOT NULL,
      user_name TEXT NOT NULL,
      score INTEGER NOT NULL DEFAULT 0,
      joined_at INTEGER DEFAULT (unixepoch())
    )`
  ];

  for (const stmt of schemaStatements) {
    await execSQL(stmt);
  }
  console.log('  ✓ All 16 tables and indexes created in Turso.');

  // Helper to migrate a table
  async function migrateTable(tableName, columns, rowMapper) {
    const rows = localDb.prepare(`SELECT * FROM "${tableName}"`).all();
    console.log(`\n📦 Migrating ${tableName} (${rows.length} rows)...`);
    if (rows.length === 0) return;

    const placeholders = columns.map(() => '?').join(', ');
    const colsStr = columns.map(c => `"${c}"`).join(', ');
    const insertSQL = `INSERT OR REPLACE INTO "${tableName}" (${colsStr}) VALUES (${placeholders})`;

    const batchSize = 100;
    for (let i = 0; i < rows.length; i += batchSize) {
      const slice = rows.slice(i, i + batchSize);
      const requests = slice.map(row => ({
        type: 'execute',
        stmt: {
          sql: insertSQL,
          args: rowMapper(row).map(val => {
            if (val === null || val === undefined) return { type: 'null' };
            if (typeof val === 'number') return { type: Number.isInteger(val) ? 'integer' : 'float', value: String(val) };
            return { type: 'text', value: String(val) };
          })
        }
      }));
      await tursoPipeline(requests);
    }
    console.log(`  ✓ ${tableName} migrated.`);
  }

  // 1. users
  await migrateTable('users', ['telegram_id', 'first_name', 'last_name', 'username', 'lang', 'is_blocked', 'created_at', 'last_active_at'], r => [
    r.telegram_id, r.first_name, r.last_name, r.username, r.lang, r.is_blocked, r.created_at, r.last_active_at
  ]);

  // 2. groups
  await migrateTable('groups', ['group_id', 'title', 'username', 'is_active', 'created_at'], r => [
    r.group_id, r.title, r.username, r.is_active, r.created_at
  ]);

  // 3. quizzes
  await migrateTable('quizzes', ['id', 'owner_id', 'title', 'description', 'category', 'is_public', 'time_limit', 'shuffle_options', 'created_at'], r => [
    r.id, r.owner_id, r.title, r.description, r.category, r.is_public, r.time_limit, r.shuffle_options, r.created_at
  ]);

  // 4. categories
  await migrateTable('categories', ['id', 'path'], r => [r.id, r.path]);

  // 5. user_mistakes
  await migrateTable('user_mistakes', ['id', 'user_id', 'question_text', 'options_json', 'correct_option_id', 'explanation', 'photo_file_id', 'original_quiz_id', 'original_num', 'created_at'], r => [
    r.id, r.user_id, r.question_text, r.options_json, r.correct_option_id, r.explanation, r.photo_file_id, r.original_quiz_id, r.original_num, r.created_at
  ]);

  // 6. group_answers
  await migrateTable('group_answers', ['id', 'session_id', 'poll_id', 'user_id', 'user_name', 'question_index', 'is_correct', 'time_taken', 'answered_at'], r => [
    r.id, r.session_id, r.poll_id, r.user_id, r.user_name, r.question_index, r.is_correct, r.time_taken, r.answered_at
  ]);

  // 7. group_tournaments
  await migrateTable('group_tournaments', ['id', 'quiz_id', 'creator_id', 'title', 'share_code', 'is_active', 'created_at'], r => [
    r.id, r.quiz_id, r.creator_id, r.title, r.share_code, r.is_active, r.created_at
  ]);

  // 8. tournament_participants
  await migrateTable('tournament_participants', ['id', 'tournament_id', 'user_id', 'user_name', 'user_avatar', 'score', 'total_questions', 'total_time_seconds', 'finished_at'], r => [
    r.id, r.tournament_id, r.user_id, r.user_name, r.user_avatar, r.score, r.total_questions, r.total_time_seconds, r.finished_at
  ]);

  // 9. live_rooms
  await migrateTable('live_rooms', ['id', 'room_code', 'quiz_id', 'host_id', 'status', 'current_question_index', 'created_at'], r => [
    r.id, r.room_code, r.quiz_id, r.host_id, r.status, r.current_question_index, r.created_at
  ]);

  // 10. room_players
  await migrateTable('room_players', ['id', 'room_code', 'user_id', 'user_name', 'score', 'joined_at'], r => [
    r.id, r.room_code, r.user_id, r.user_name, r.score, r.joined_at
  ]);

  // 11. group_lobbies
  await migrateTable('group_lobbies', ['id', 'chat_id', 'message_id', 'quiz_id', 'owner_id', 'status', 'ready_users_json', 'created_at'], r => [
    r.id, r.chat_id, r.message_id, r.quiz_id, r.owner_id, r.status, r.ready_users_json, r.created_at
  ]);

  // 12. user_states
  await migrateTable('user_states', ['user_id', 'state', 'context_data_json', 'updated_at'], r => [
    r.user_id, r.state, r.context_data_json, r.updated_at
  ]);

  // 13. bot_settings
  await migrateTable('bot_settings', ['key', 'value', 'updated_at'], r => [
    r.key, r.value, r.updated_at
  ]);

  // 14. questions - Stream in fast pipeline chunks
  const totalQRow = localDb.prepare('SELECT count(*) as count FROM questions').get();
  const totalQ = totalQRow.count;
  console.log(`\n📚 Streaming questions table (${totalQ} rows)...`);

  const qBatchSize = 500;
  let offset = 0;
  const insQSQL = 'INSERT INTO questions (id, quiz_id, order_index, question_text, options_json, correct_option_id, explanation, photo_file_id, photo_caption) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)';

  while (offset < totalQ) {
    const qRows = localDb.prepare(`SELECT * FROM questions LIMIT ${qBatchSize} OFFSET ${offset}`).all();
    if (qRows.length === 0) break;

    const requests = qRows.map(r => ({
      type: 'execute',
      stmt: {
        sql: insQSQL,
        args: [
          { type: 'integer', value: String(r.id) },
          { type: 'integer', value: String(r.quiz_id) },
          { type: 'integer', value: String(r.order_index || 0) },
          { type: 'text', value: String(r.question_text || '') },
          { type: 'text', value: String(r.options_json || '[]') },
          { type: 'integer', value: String(r.correct_option_id || 0) },
          r.explanation ? { type: 'text', value: String(r.explanation) } : { type: 'null' },
          r.photo_file_id ? { type: 'text', value: String(r.photo_file_id) } : { type: 'null' },
          r.photo_caption ? { type: 'text', value: String(r.photo_caption) } : { type: 'null' },
        ]
      }
    }));

    await tursoPipeline(requests);
    offset += qRows.length;
    process.stdout.write(`\r  Progress: ${offset}/${totalQ} questions (${((offset/totalQ)*100).toFixed(1)}%)...`);
  }

  console.log('\n\n✅ MIGRATION TO TURSO CLOUD COMPLETE!');
  
  // Verify row counts in Turso
  const testTables = ['users', 'quizzes', 'questions', 'categories', 'user_mistakes', 'bot_settings'];
  console.log('\n🔍 Verifying Turso Cloud Table Counts:');
  for (const t of testTables) {
    const res = await tursoPipeline([{ type: 'execute', stmt: { sql: `SELECT count(*) as count FROM "${t}"` } }]);
    const count = res.results[0].response.result.rows[0][0].value;
    console.log(`  - ${t}: ${count} rows`);
  }
}

main().catch(err => {
  console.error('\n❌ Migration failed:', err);
  process.exit(1);
});
