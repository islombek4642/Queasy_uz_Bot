import fs from 'fs';
import path from 'path';
import { DatabaseSync } from 'node:sqlite';
import { parseQuizInput } from '../tgcloud/lib/parsers/parser_engine.js';

const DB_PATH = path.join(process.cwd(), 'queasy_ready.sqlite');
const DUMP_DIR = path.join(process.cwd(), 'scratch', 'tg_dump');
const ROOT_TEST_DIR = 'd:/Serverless/BARCHA TESTLAR';

async function main() {
  console.log('🚀 Building queasy_ready.sqlite locally...');

  // Remove old database file if exists
  if (fs.existsSync(DB_PATH)) {
    fs.unlinkSync(DB_PATH);
  }

  const db = new DatabaseSync(DB_PATH);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA synchronous = NORMAL;');

  console.log('📦 Creating schema for all 16 tables...');
  db.exec(`
    -- 1. Users
    CREATE TABLE IF NOT EXISTS users (
      telegram_id INTEGER PRIMARY KEY,
      first_name TEXT NOT NULL,
      last_name TEXT,
      username TEXT,
      lang TEXT NOT NULL DEFAULT 'UZ',
      is_blocked INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER DEFAULT (unixepoch()),
      last_active_at INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_users_created_at ON users (created_at);

    -- 2. Connected Groups
    CREATE TABLE IF NOT EXISTS "groups" (
      group_id INTEGER PRIMARY KEY,
      title TEXT NOT NULL,
      username TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER DEFAULT (unixepoch())
    );
    CREATE INDEX IF NOT EXISTS idx_groups_created_at ON "groups" (created_at);
    CREATE INDEX IF NOT EXISTS idx_groups_is_active ON "groups" (is_active);

    -- 3. Quizzes
    CREATE TABLE IF NOT EXISTS quizzes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      owner_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      category TEXT,
      is_public INTEGER NOT NULL DEFAULT 0,
      time_limit INTEGER NOT NULL DEFAULT 30,
      shuffle_options INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER DEFAULT (unixepoch())
    );
    CREATE INDEX IF NOT EXISTS idx_quizzes_owner_id ON quizzes (owner_id);
    CREATE INDEX IF NOT EXISTS idx_quizzes_category ON quizzes (category);
    CREATE INDEX IF NOT EXISTS idx_quizzes_is_public ON quizzes (is_public);

    -- 4. Questions
    CREATE TABLE IF NOT EXISTS questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quiz_id INTEGER NOT NULL,
      order_index INTEGER NOT NULL DEFAULT 0,
      question_text TEXT NOT NULL,
      options_json TEXT NOT NULL,
      correct_option_id INTEGER NOT NULL,
      explanation TEXT,
      photo_file_id TEXT,
      photo_caption TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_questions_quiz_id ON questions (quiz_id);

    -- 5. User Mistakes
    CREATE TABLE IF NOT EXISTS user_mistakes (
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
    );
    CREATE INDEX IF NOT EXISTS idx_mistakes_user_id ON user_mistakes (user_id);

    -- 6. Quiz Sessions
    CREATE TABLE IF NOT EXISTS quiz_sessions (
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
    );
    CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON quiz_sessions (user_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_is_active ON quiz_sessions (is_active);

    -- 7. Group Multiplayer Answers
    CREATE TABLE IF NOT EXISTS group_answers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL,
      poll_id TEXT NOT NULL,
      user_id INTEGER NOT NULL,
      user_name TEXT NOT NULL,
      question_index INTEGER NOT NULL,
      is_correct INTEGER NOT NULL,
      time_taken INTEGER DEFAULT 0,
      answered_at INTEGER DEFAULT (unixepoch())
    );

    -- 8. Required Channels
    CREATE TABLE IF NOT EXISTS required_channels (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      channel_id TEXT NOT NULL,
      channel_username TEXT,
      title TEXT NOT NULL,
      invite_link TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER DEFAULT (unixepoch())
    );

    -- 9. User States
    CREATE TABLE IF NOT EXISTS user_states (
      user_id INTEGER PRIMARY KEY,
      state TEXT NOT NULL,
      context_data_json TEXT,
      updated_at INTEGER DEFAULT (unixepoch())
    );

    -- 10. Bot Settings
    CREATE TABLE IF NOT EXISTS bot_settings (
      "key" TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at INTEGER DEFAULT (unixepoch())
    );

    -- 11. Group Lobbies
    CREATE TABLE IF NOT EXISTS group_lobbies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id INTEGER NOT NULL,
      message_id INTEGER,
      quiz_id INTEGER NOT NULL,
      owner_id INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'waiting',
      ready_users_json TEXT NOT NULL DEFAULT '[]',
      created_at INTEGER DEFAULT (unixepoch())
    );

    -- 12. Categories
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      path TEXT NOT NULL UNIQUE
    );

    -- 13. Group Tournaments
    CREATE TABLE IF NOT EXISTS group_tournaments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quiz_id INTEGER NOT NULL,
      creator_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      share_code TEXT NOT NULL UNIQUE,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER DEFAULT (unixepoch())
    );

    -- 14. Tournament Participants
    CREATE TABLE IF NOT EXISTS tournament_participants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tournament_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      user_name TEXT NOT NULL,
      user_avatar TEXT,
      score INTEGER NOT NULL DEFAULT 0,
      total_questions INTEGER NOT NULL,
      total_time_seconds INTEGER NOT NULL DEFAULT 0,
      finished_at INTEGER DEFAULT (unixepoch())
    );

    -- 15. Live Multiplayer Rooms
    CREATE TABLE IF NOT EXISTS live_rooms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      room_code TEXT NOT NULL UNIQUE,
      quiz_id INTEGER NOT NULL,
      host_id INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'waiting',
      current_question_index INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER DEFAULT (unixepoch())
    );

    -- 16. Live Room Players
    CREATE TABLE IF NOT EXISTS room_players (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      room_code TEXT NOT NULL,
      user_id INTEGER NOT NULL,
      user_name TEXT NOT NULL,
      score INTEGER NOT NULL DEFAULT 0,
      joined_at INTEGER DEFAULT (unixepoch())
    );
  `);

  // Helper to load dumped JSON
  function loadDump(name) {
    const p = path.join(DUMP_DIR, `${name}.json`);
    if (fs.existsSync(p)) {
      return JSON.parse(fs.readFileSync(p, 'utf8'));
    }
    return [];
  }

  // 1. Users
  console.log('📥 Importing users...');
  const users = loadDump('users');
  const insUser = db.prepare(`
    INSERT OR REPLACE INTO users (telegram_id, first_name, last_name, username, lang, is_blocked, created_at, last_active_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  db.exec('BEGIN TRANSACTION;');
  for (const u of users) {
    insUser.run(
      u.telegramId,
      u.firstName || '',
      u.lastName || null,
      u.username || null,
      u.lang || 'UZ',
      u.isBlocked ? 1 : 0,
      typeof u.createdAt === 'number' ? u.createdAt : Math.floor(Date.now() / 1000),
      typeof u.lastActiveAt === 'number' ? u.lastActiveAt : null
    );
  }
  db.exec('COMMIT;');
  console.log(`  ✓ ${users.length} users imported.`);

  // 2. Groups
  console.log('📥 Importing groups...');
  const groups = loadDump('groups');
  const insGroup = db.prepare(`
    INSERT OR REPLACE INTO "groups" (group_id, title, username, is_active, created_at)
    VALUES (?, ?, ?, ?, ?)
  `);
  db.exec('BEGIN TRANSACTION;');
  for (const g of groups) {
    insGroup.run(g.groupId, g.title, g.username || null, g.isActive ? 1 : 0, typeof g.createdAt === 'number' ? g.createdAt : Math.floor(Date.now() / 1000));
  }
  db.exec('COMMIT;');
  console.log(`  ✓ ${groups.length} groups imported.`);

  // 3. Quizzes
  console.log('📥 Importing quizzes...');
  const quizzes = loadDump('quizzes');
  const insQuiz = db.prepare(`
    INSERT OR REPLACE INTO quizzes (id, owner_id, title, description, category, is_public, time_limit, shuffle_options, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const quizIdMap = new Map(); // key -> id
  db.exec('BEGIN TRANSACTION;');
  for (const q of quizzes) {
    insQuiz.run(
      q.id,
      q.ownerId || 0,
      q.title,
      q.description || null,
      q.category || null,
      q.isPublic ? 1 : 0,
      q.timeLimit || 30,
      q.shuffleOptions ? 1 : 0,
      typeof q.createdAt === 'number' ? q.createdAt : Math.floor(Date.now() / 1000)
    );
    const key = `${(q.category || '').trim().toLowerCase()}|||${(q.title || '').trim().toLowerCase()}`;
    quizIdMap.set(key, q.id);
  }
  db.exec('COMMIT;');
  console.log(`  ✓ ${quizzes.length} quizzes imported.`);

  // 4. Categories
  console.log('📥 Importing categories...');
  const categories = loadDump('categories');
  const insCat = db.prepare(`INSERT OR REPLACE INTO categories (id, path) VALUES (?, ?)`);
  db.exec('BEGIN TRANSACTION;');
  for (const c of categories) {
    insCat.run(c.id, c.path);
  }
  db.exec('COMMIT;');
  console.log(`  ✓ ${categories.length} categories imported.`);

  // 5. User Mistakes
  console.log('📥 Importing user mistakes...');
  const mistakes = loadDump('userMistakes');
  const insMistake = db.prepare(`
    INSERT OR REPLACE INTO user_mistakes (id, user_id, question_text, options_json, correct_option_id, explanation, photo_file_id, original_quiz_id, original_num, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  db.exec('BEGIN TRANSACTION;');
  for (const m of mistakes) {
    insMistake.run(
      m.id,
      m.userId,
      m.questionText,
      m.optionsJson,
      m.correctOptionId,
      m.explanation || null,
      m.photoFileId || null,
      m.originalQuizId || null,
      m.originalNum || null,
      typeof m.createdAt === 'number' ? m.createdAt : Math.floor(Date.now() / 1000)
    );
  }
  db.exec('COMMIT;');
  console.log(`  ✓ ${mistakes.length} mistakes imported.`);

  // 6. Group Answers
  console.log('📥 Importing group answers...');
  const gAnswers = loadDump('groupAnswers');
  const insGAnswer = db.prepare(`
    INSERT OR REPLACE INTO group_answers (id, session_id, poll_id, user_id, user_name, question_index, is_correct, time_taken, answered_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  db.exec('BEGIN TRANSACTION;');
  for (const a of gAnswers) {
    insGAnswer.run(a.id, a.sessionId, a.pollId, a.userId, a.userName, a.questionIndex, a.isCorrect ? 1 : 0, a.timeTaken || 0, typeof a.answeredAt === 'number' ? a.answeredAt : Math.floor(Date.now() / 1000));
  }
  db.exec('COMMIT;');
  console.log(`  ✓ ${gAnswers.length} group answers imported.`);

  // 7. Group Tournaments
  console.log('📥 Importing group tournaments...');
  const tournaments = loadDump('groupTournaments');
  const insTour = db.prepare(`
    INSERT OR REPLACE INTO group_tournaments (id, quiz_id, creator_id, title, share_code, is_active, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  db.exec('BEGIN TRANSACTION;');
  for (const t of tournaments) {
    insTour.run(t.id, t.quizId, t.creatorId, t.title, t.shareCode, t.isActive ? 1 : 0, typeof t.createdAt === 'number' ? t.createdAt : Math.floor(Date.now() / 1000));
  }
  db.exec('COMMIT;');
  console.log(`  ✓ ${tournaments.length} group tournaments imported.`);

  // 8. Live Rooms & Players & Lobbies & Settings
  const liveRooms = loadDump('liveRooms');
  const insLiveRoom = db.prepare(`
    INSERT OR REPLACE INTO live_rooms (id, room_code, quiz_id, host_id, status, current_question_index, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  db.exec('BEGIN TRANSACTION;');
  for (const r of liveRooms) {
    insLiveRoom.run(r.id, r.roomCode, r.quizId, r.hostId, r.status || 'waiting', r.currentQuestionIndex || 0, typeof r.createdAt === 'number' ? r.createdAt : Math.floor(Date.now() / 1000));
  }
  db.exec('COMMIT;');

  const roomPlayers = loadDump('roomPlayers');
  const insPlayer = db.prepare(`
    INSERT OR REPLACE INTO room_players (id, room_code, user_id, user_name, score, joined_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  db.exec('BEGIN TRANSACTION;');
  for (const p of roomPlayers) {
    insPlayer.run(p.id, p.roomCode, p.userId, p.userName, p.score || 0, typeof p.joinedAt === 'number' ? p.joinedAt : Math.floor(Date.now() / 1000));
  }
  db.exec('COMMIT;');

  const lobbies = loadDump('groupLobbies');
  const insLobby = db.prepare(`
    INSERT OR REPLACE INTO group_lobbies (id, chat_id, message_id, quiz_id, owner_id, status, ready_users_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  db.exec('BEGIN TRANSACTION;');
  for (const l of lobbies) {
    insLobby.run(l.id, l.chatId, l.messageId || null, l.quizId, l.ownerId, l.status || 'waiting', l.readyUsersJson || '[]', typeof l.createdAt === 'number' ? l.createdAt : Math.floor(Date.now() / 1000));
  }
  db.exec('COMMIT;');

  const settings = loadDump('botSettings');
  const insSetting = db.prepare(`INSERT OR REPLACE INTO bot_settings ("key", value, updated_at) VALUES (?, ?, ?)`);
  db.exec('BEGIN TRANSACTION;');
  for (const s of settings) {
    insSetting.run(s.key, s.value, typeof s.updatedAt === 'number' ? s.updatedAt : Math.floor(Date.now() / 1000));
  }
  db.exec('COMMIT;');
  console.log('  ✓ Lobbies, settings, live rooms imported.');

  // 9. Scan docx files and populate questions
  console.log('📚 Scanning docx test files for questions...');
  const filesList = [];
  function scan(dir) {
    const items = fs.readdirSync(dir, { withFileTypes: true });
    for (const item of items) {
      const full = path.join(dir, item.name);
      if (item.isDirectory()) {
        scan(full);
      } else if (item.name.toLowerCase().endsWith('.docx')) {
        filesList.push(full);
      }
    }
  }
  scan(ROOT_TEST_DIR);
  console.log(`  Found ${filesList.length} docx files to process.`);

  const insQ = db.prepare(`
    INSERT INTO questions (quiz_id, order_index, question_text, options_json, correct_option_id, explanation, photo_file_id, photo_caption)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let totalQuestionsInserted = 0;
  let skippedQuizzes = 0;
  let batchCount = 0;

  db.exec('BEGIN TRANSACTION;');

  for (let i = 0; i < filesList.length; i++) {
    const filePath = filesList[i];
    const fileName = path.basename(filePath);
    const relDir = path.relative(ROOT_TEST_DIR, path.dirname(filePath));
    const category = relDir.split(path.sep).join(' / ');

    try {
      const buf = fs.readFileSync(filePath);
      const parsed = parseQuizInput(buf, fileName);

      if (parsed.success && Array.isArray(parsed.questions) && parsed.questions.length > 0) {
        // Find matching quiz id
        const key = `${category.trim().toLowerCase()}|||${(parsed.title || '').trim().toLowerCase()}`;
        let qId = quizIdMap.get(key);

        if (!qId) {
          // Fallback title match
          for (const [k, id] of quizIdMap.entries()) {
            if (k.endsWith(`|||${(parsed.title || '').trim().toLowerCase()}`)) {
              qId = id;
              break;
            }
          }
        }

        if (qId) {
          for (let qIdx = 0; qIdx < parsed.questions.length; qIdx++) {
            const q = parsed.questions[qIdx];
            insQ.run(
              qId,
              qIdx,
              q.questionText,
              JSON.stringify(q.options || []),
              typeof q.correctOptionId === 'number' ? q.correctOptionId : 0,
              q.explanation || null,
              q.photoFileId || null,
              q.photoCaption || null
            );
            totalQuestionsInserted++;
          }
        } else {
          skippedQuizzes++;
        }
      }
    } catch (err) {
      // ignore individual malformed docx
    }

    batchCount++;
    if (batchCount >= 200) {
      db.exec('COMMIT;');
      db.exec('BEGIN TRANSACTION;');
      batchCount = 0;
      process.stdout.write(`\r  Progress: ${i + 1}/${filesList.length} files (${totalQuestionsInserted} questions)...`);
    }
  }

  db.exec('COMMIT;');
  console.log(`\n  ✓ Processed ${filesList.length} docx files. Total questions inserted: ${totalQuestionsInserted} (Skipped quizzes without ID: ${skippedQuizzes})`);

  // Final count verification
  console.log('\n📊 Final Table Row Counts:');
  const tables = [
    'users', 'groups', 'quizzes', 'questions', 'categories', 'user_mistakes',
    'group_answers', 'group_tournaments', 'live_rooms', 'room_players',
    'group_lobbies', 'bot_settings'
  ];
  for (const t of tables) {
    const row = db.prepare(`SELECT count(*) as count FROM "${t}"`).get();
    console.log(`  - ${t}: ${row.count} rows`);
  }

  const stat = fs.statSync(DB_PATH);
  console.log(`\n🎉 Success! Database built at: ${DB_PATH}`);
  console.log(`   File size: ${(stat.size / (1024 * 1024)).toFixed(2)} MB`);
}

main().catch(console.error);
