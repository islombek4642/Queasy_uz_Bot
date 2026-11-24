// scripts/master_import_all_new_tests.mjs
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import https from 'node:https';
import dns from 'node:dns';
import sqlite3 from 'node:sqlite';
import { TURSO_TOKEN } from '../tgcloud/lib/constants/secrets.js';
import { parseQuizInput } from '../tgcloud/lib/parsers/parser_engine.js';

try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch {}

const TURSO_URL = 'https://queasy-db-xamidullayev-i.aws-eu-north-1.turso.io';
const BASE_HOST = 'https://kiut-nm-test.uz';
const MISSING_FILE = path.join(process.cwd(), 'scratch/missing_in_turso.json');
const TRACKED_CHECKPOINT_FILE = path.join(process.cwd(), 'scripts/import_checkpoint.json');
const CHECKPOINT_FILE = fs.existsSync(TRACKED_CHECKPOINT_FILE)
  ? TRACKED_CHECKPOINT_FILE
  : path.join(process.cwd(), 'scratch/turso_import_checkpoint.json');
const DB_FILE = path.join(process.cwd(), 'queasy_ready.sqlite');
const QUIZLARIM_DIR = fs.existsSync('D:/Serverless/QUIZLARIM')
  ? 'D:/Serverless/QUIZLARIM'
  : path.join(process.cwd(), 'scratch/QUIZLARIM');
const DOCX_DIR = path.join(QUIZLARIM_DIR, 'TESTLAR_DOCX');
const INDEX_FILE = path.join(QUIZLARIM_DIR, 'index.json');
if (!fs.existsSync(DOCX_DIR)) fs.mkdirSync(DOCX_DIR, { recursive: true });
if (!fs.existsSync(INDEX_FILE)) {
  fs.mkdirSync(path.dirname(INDEX_FILE), { recursive: true });
  fs.writeFileSync(INDEX_FILE, '[]', 'utf8');
}

const USER_INIT_DATA = 'query_id=AAGqKOcJBAAAAKoo5wmVig9v&user=%7B%22id%22%3A8756078762%2C%22first_name%22%3A%22Islombek%22%2C%22last_name%22%3A%22Xamidullayev%20%EF%A3%BF%22%2C%22username%22%3A%22xamidullayev_i%22%2C%22language_code%22%3A%22uz%22%2C%22allows_write_to_pm%22%3Atrue%2C%22photo_url%22%3A%22https%3A%5C%2F%5C%2Ft.me%5C%2Fi%5C%2Fuserpic%5C%2F320%5C%2FqjtWAJtvr95hsltjS4uN9B7Mwhl1ztXx3SN2YuHMWO8yX219KAFSZE0XcQI4yvTa.svg%22%7D&auth_date=1795517600&signature=n6QRpLP4q2pl3ETYnSQJi3Z4LvyF3i1JnNWtVn8OS-1_ReyETc5I55NkO_4PqbObPUmo5g_x6ItuVJPn_qDDBQ&hash=b12eedffd80b09525dc37a7f0f3ae6f6ae14fc9c5b8a39cd7c28810a821c8181';
const INIT_DATA = process.env.INIT_DATA || process.argv[2] || USER_INIT_DATA;

const CONCURRENCY = 5; // 5 parallel streams
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function tursoPipeline(requests, maxRetries = 4) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(`${TURSO_URL}/v2/pipeline`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${TURSO_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requests: [...requests, { type: 'close' }],
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text}`);
      }

      const data = await res.json();
      for (const r of data.results || []) {
        if (r.type === 'error') {
          throw new Error(`Turso Query Error: ${r.error?.message}`);
        }
      }
      return data;
    } catch (err) {
      if (attempt === maxRetries) throw err;
      await sleep(1000 * attempt);
    }
  }
}

function parseLegacyQuiz(content) {
  const lines = (content || '').split(/\r?\n/);
  const questions = [];
  let currentQuestion = null;
  let currentOptions = [];
  let currentCorrect = 0;

  function commit() {
    if (currentQuestion && currentQuestion.trim() && currentOptions.length >= 2) {
      questions.push({
        questionText: currentQuestion.trim(),
        options: currentOptions,
        correctOptionId: currentCorrect,
      });
    }
    currentQuestion = null;
    currentOptions = [];
    currentCorrect = 0;
  }

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith('?')) {
      commit();
      currentQuestion = trimmed.slice(1).trim();
    } else if (trimmed.startsWith('+')) {
      if (currentQuestion !== null) {
        currentOptions.push(trimmed.slice(1).trim());
        currentCorrect = currentOptions.length - 1;
      }
    } else if (trimmed.startsWith('=')) {
      if (currentQuestion !== null) {
        currentOptions.push(trimmed.slice(1).trim());
      }
    } else if (currentOptions.length > 0) {
      currentOptions[currentOptions.length - 1] += ` ${trimmed}`;
    } else if (currentQuestion !== null) {
      currentQuestion += ` ${trimmed}`;
    }
  }
  commit();
  return questions;
}

function escapeXml(unsafe) {
  return String(unsafe || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function createDocx(text) {
  const lines = (text || '').split(/\r?\n/);
  const pList = [];
  for (const line of lines) {
    if (!line.trim()) {
      pList.push('<w:p/>');
    } else {
      pList.push(`<w:p><w:r><w:t xml:space="preserve">${escapeXml(line)}</w:t></w:r></w:p>`);
    }
  }

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>` +
    pList.join('') +
    `</w:body></w:document>`;

  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
    `<Default Extension="xml" ContentType="application/xml"/>` +
    `<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>` +
    `</Types>`;

  const relsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>` +
    `</Relationships>`;

  const files = [
    { name: '[Content_Types].xml', content: Buffer.from(contentTypesXml, 'utf8') },
    { name: '_rels/.rels', content: Buffer.from(relsXml, 'utf8') },
    { name: 'word/document.xml', content: Buffer.from(documentXml, 'utf8') },
  ];

  const lfhList = [];
  const cdhList = [];
  let offset = 0;

  for (const f of files) {
    const compressed = zlib.deflateRawSync(f.content);
    const crc = zlib.crc32(f.content);
    const nameBuf = Buffer.from(f.name, 'utf8');

    const lfh = Buffer.alloc(30 + nameBuf.length);
    lfh.writeUInt32LE(0x04034b50, 0);
    lfh.writeUInt16LE(20, 4);
    lfh.writeUInt16LE(0, 6);
    lfh.writeUInt16LE(8, 8);
    lfh.writeUInt32LE(0, 10);
    lfh.writeUInt32LE(crc, 14);
    lfh.writeUInt32LE(compressed.length, 18);
    lfh.writeUInt32LE(f.content.length, 22);
    lfh.writeUInt16LE(nameBuf.length, 26);
    lfh.writeUInt16LE(0, 28);
    nameBuf.copy(lfh, 30);

    lfhList.push(lfh, compressed);

    const cdh = Buffer.alloc(46 + nameBuf.length);
    cdh.writeUInt32LE(0x02014b50, 0);
    cdh.writeUInt16LE(20, 4);
    cdh.writeUInt16LE(20, 6);
    cdh.writeUInt16LE(0, 8);
    cdh.writeUInt16LE(8, 10);
    cdh.writeUInt32LE(0, 12);
    cdh.writeUInt32LE(crc, 16);
    cdh.writeUInt32LE(compressed.length, 20);
    cdh.writeUInt32LE(f.content.length, 24);
    cdh.writeUInt16LE(nameBuf.length, 28);
    cdh.writeUInt16LE(0, 30);
    cdh.writeUInt16LE(0, 32);
    cdh.writeUInt16LE(0, 34);
    cdh.writeUInt16LE(0, 36);
    cdh.writeUInt32LE(0, 38);
    cdh.writeUInt32LE(offset, 42);
    nameBuf.copy(cdh, 46);

    cdhList.push(cdh);
    offset += lfh.length + compressed.length;
  }

  const cdhConcat = Buffer.concat(cdhList);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(files.length, 8);
  eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(cdhConcat.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...lfhList, cdhConcat, eocd]);
}

async function processQuiz(item, index, total, existingMap, localDb) {
  let category = item.fullTitle || (item.pathParts ? item.pathParts.join(' / ') : item.form);
  if (category.endsWith(` / ${item.title}`)) {
    category = category.slice(0, -(` / ${item.title}`).length);
  }

  const existing = existingMap.get(`${item.title}:::${category}`);
  if (existing && existing.questionCount > 0) {
    return { quizId: existing.id, questionsCount: existing.questionCount, skipped: true };
  }

  // 1. Fetch test content
  const testUrl = `${BASE_HOST}/api/test-content?path=${encodeURIComponent(item.relPath)}${INIT_DATA ? `&initData=${encodeURIComponent(INIT_DATA)}` : ''}`;
  let res;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      res = await fetch(testUrl).then(r => r.json());
      break;
    } catch (e) {
      if (attempt === 3) throw e;
      await sleep(1000 * attempt);
    }
  }

  if (!res || !res.success || !res.content) {
    console.warn(`  ⚠️ [${index + 1}/${total}] Kontent olinmadi: ${item.title} (${res?.error || 'Nomaʼlum'})`);
    return { quizId: null, questionsCount: 0, skipped: true };
  }

  // 2. Save .docx locally
  try {
    const docxPath = path.join(DOCX_DIR, item.relPath);
    fs.mkdirSync(path.dirname(docxPath), { recursive: true });
    const docxBuffer = createDocx(res.content);
    fs.writeFileSync(docxPath, docxBuffer);
  } catch (err) {
    console.warn(`  ⚠️ Docx saqlashda xato (${item.title}):`, err.message);
  }

  // 3. Parse questions (Universal Hybrid with Legacy fallback)
  let questions = parseLegacyQuiz(res.content);
  if (!questions || questions.length === 0) {
    try {
      const parsed = parseQuizInput(res.content, `${item.title}.txt`);
      if (parsed.success && Array.isArray(parsed.questions) && parsed.questions.length > 0) {
        questions = parsed.questions;
      }
    } catch {}
  }

  if (!questions || questions.length === 0) {
    console.warn(`  ⚠️ [${index + 1}/${total}] Savollar topilmadi: ${item.title}`);
    return { quizId: null, questionsCount: 0, skipped: true };
  }

  let finalQuizId = existing?.id;

  // 4. Save to local SQLite if available
  if (localDb) {
    try {
      let localQuiz = localDb.prepare('SELECT id FROM quizzes WHERE title = ? AND category = ?').get(item.title, category);
      let lQuizId = localQuiz?.id;
      if (!lQuizId) {
        const ins = localDb.prepare(`
          INSERT INTO quizzes (owner_id, title, description, category, is_public, time_limit, shuffle_options, created_at)
          VALUES (0, ?, '', ?, 1, 30, 1, unixepoch())
        `).run(item.title, category);
        lQuizId = Number(ins.lastInsertRowid);
      }
      finalQuizId = finalQuizId || lQuizId;

      // Check questions count in local DB
      const existingQCount = localDb.prepare('SELECT count(*) as count FROM questions WHERE quiz_id = ?').get(lQuizId)?.count || 0;
      if (existingQCount === 0) {
        const insQ = localDb.prepare(`
          INSERT INTO questions (quiz_id, order_index, question_text, options_json, correct_option_id, explanation, photo_file_id, photo_caption)
          VALUES (?, ?, ?, ?, ?, NULL, NULL, NULL)
        `);
        localDb.exec('BEGIN TRANSACTION;');
        for (let idx = 0; idx < questions.length; idx++) {
          const q = questions[idx];
          insQ.run(lQuizId, idx, q.questionText, JSON.stringify(q.options), q.correctOptionId);
        }
        localDb.exec('COMMIT;');
      }

      // Categories
      const insCat = localDb.prepare(`INSERT OR IGNORE INTO categories (path) VALUES (?)`);
      const parts = category.split(' / ');
      for (let i = 1; i <= parts.length; i++) {
        insCat.run(parts.slice(0, i).join(' / '));
      }
    } catch (localErr) {
      console.warn(`  ⚠️ Lokal bazaga yozishda xato (${item.title}):`, localErr.message);
    }
  }

  // 5. Save to Turso Cloud if token is available
  if (TURSO_TOKEN) {
    let quizId = existing?.id;
    if (!quizId) {
      const insertQuizRes = await tursoPipeline([
        {
          type: 'execute',
          stmt: {
            sql: `INSERT INTO quizzes (owner_id, title, description, category, is_public, time_limit, shuffle_options, created_at)
                  VALUES (0, ?, '', ?, 1, 30, 1, unixepoch())
                  RETURNING id`,
            args: [
              { type: 'text', value: item.title },
              { type: 'text', value: category },
            ],
          },
        },
      ]);

      quizId = Number(insertQuizRes.results[0]?.response?.result?.rows[0][0]?.value);
      if (!quizId) {
        throw new Error(`Quiz ID olinmadi: ${item.title}`);
      }
    }
    finalQuizId = finalQuizId || quizId;

    // Batch insert questions in chunks of 50
    try {
      const CHUNK_SIZE = 50;
      for (let c = 0; c < questions.length; c += CHUNK_SIZE) {
        const chunk = questions.slice(c, c + CHUNK_SIZE);
        const reqs = chunk.map((q, idx) => ({
          type: 'execute',
          stmt: {
            sql: `INSERT INTO questions (quiz_id, order_index, question_text, options_json, correct_option_id, explanation, photo_file_id, photo_caption)
                  VALUES (?, ?, ?, ?, ?, NULL, NULL, NULL)`,
            args: [
              { type: 'integer', value: String(quizId) },
              { type: 'integer', value: String(c + idx) },
              { type: 'text', value: q.questionText },
              { type: 'text', value: JSON.stringify(q.options) },
              { type: 'integer', value: String(q.correctOptionId) },
            ],
          },
        }));
        await tursoPipeline(reqs);
      }
    } catch (err) {
      if (!existing?.id) {
        try {
          await tursoPipeline([
            { type: 'execute', stmt: { sql: 'DELETE FROM quizzes WHERE id = ?', args: [{ type: 'integer', value: String(quizId) }] } }
          ]);
        } catch {}
      }
      throw err;
    }

    // Ensure category paths in Turso
    const parts = category.split(' / ');
    const catReqs = [];
    for (let i = 1; i <= parts.length; i++) {
      const p = parts.slice(0, i).join(' / ');
      catReqs.push({
        type: 'execute',
        stmt: {
          sql: `INSERT OR IGNORE INTO categories (path) VALUES (?)`,
          args: [{ type: 'text', value: p }],
        },
      });
    }
    await tursoPipeline(catReqs);
  }

  existingMap.set(`${item.title}:::${category}`, { id: finalQuizId, questionCount: questions.length });

  console.log(`  ⚡ [${index + 1}/${total}] Saqlandi! ID: ${finalQuizId} (${questions.length} savol) - ${item.title.slice(0, 45)}...`);
  return { quizId: finalQuizId, questionsCount: questions.length, skipped: false };
}

async function main() {
  console.log('🚀 Yangi testlarni Turso Cloud va Mahalliy Repozitoriyga yuklash boshlandi...');
  console.log(`⚡ Parallel oqimlar: ${CONCURRENCY}\n`);

  if (!fs.existsSync(MISSING_FILE)) {
    const siteIndexFile = path.join(process.cwd(), 'kiut_site_index.json');
    if (fs.existsSync(siteIndexFile)) {
      console.log(`ℹ️ ${MISSING_FILE} topilmadi. kiut_site_index.json asosida avtomatik shakllantirilmoqda...`);
      const siteData = JSON.parse(fs.readFileSync(siteIndexFile, 'utf8'));
      if (!fs.existsSync(path.dirname(MISSING_FILE))) {
        fs.mkdirSync(path.dirname(MISSING_FILE), { recursive: true });
      }
      fs.writeFileSync(MISSING_FILE, JSON.stringify(siteData, null, 2));
    } else {
      console.error(`❌ Na ${MISSING_FILE} na kiut_site_index.json topildi!`);
      process.exit(1);
    }
  }

  const missingList = JSON.parse(fs.readFileSync(MISSING_FILE, 'utf8'));

  if (!TURSO_TOKEN) {
    console.warn('⚠️ DIQQAT: process.env.TURSO_TOKEN bo\'sh! Turso Cloud ga so\'rov yuborish uchun token talab qilinadi.');
    console.warn('   Ishga tushirish misoli: $env:TURSO_TOKEN="..."; node scripts/master_import_all_new_tests.mjs\n');
  }

  const existingMap = new Map();

  let localDb = null;
  try {
    localDb = new sqlite3.DatabaseSync(DB_FILE);
    localDb.exec(`
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
      CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        path TEXT NOT NULL UNIQUE
      );
      CREATE INDEX IF NOT EXISTS idx_quizzes_owner_id ON quizzes (owner_id);
      CREATE INDEX IF NOT EXISTS idx_quizzes_category ON quizzes (category);
      CREATE INDEX IF NOT EXISTS idx_questions_quiz_id ON questions (quiz_id);
    `);
    const localRows = localDb.prepare(`
      SELECT q.id, q.title, q.category, count(qst.id) as question_count
      FROM quizzes q
      LEFT JOIN questions qst ON qst.quiz_id = q.id
      GROUP BY q.id
    `).all();
    for (const r of localRows) {
      existingMap.set(`${r.title}:::${r.category}`, { id: r.id, questionCount: r.question_count });
    }
    if (localRows.length > 0) {
      console.log(`Lokal SQLite bazadagi mavjud testlar soni: ${localRows.length}`);
    }
  } catch (err) {
    console.warn('⚠️ Lokal SQLite bazani ochishda xato:', err.message);
  }

  if (TURSO_TOKEN) {
    try {
      // Get current quizzes with question counts from Turso
      const curRes = await tursoPipeline([
        {
          type: 'execute',
          stmt: {
            sql: 'SELECT q.id, q.title, q.category, count(qst.id) as question_count FROM quizzes q LEFT JOIN questions qst ON qst.quiz_id = q.id GROUP BY q.id',
          },
        },
      ]);
      const rows = curRes.results[0]?.response?.result?.rows || [];
      for (const r of rows) {
        const id = Number(r[0].value);
        const title = r[1].value;
        const cat = r[2].value;
        const qCount = Number(r[3]?.value || 0);
        existingMap.set(`${title}:::${cat}`, { id, questionCount: qCount });
      }
      console.log(`Turso dagi mavjud testlar soni: ${existingMap.size}`);
    } catch (err) {
      console.warn('⚠️ Turso ga ulanishda xato:', err.message);
    }
  }

  let totalImportedQuizzes = 0;
  let totalImportedQuestions = 0;
  let totalSkipped = 0;

  let currentIndex = 0;
  if (fs.existsSync(CHECKPOINT_FILE)) {
    try {
      const cp = JSON.parse(fs.readFileSync(CHECKPOINT_FILE, 'utf8'));
      if (typeof cp.lastIndex === 'number' && cp.lastIndex > 0 && cp.lastIndex < missingList.length) {
        currentIndex = cp.lastIndex;
        console.log(`📌 Oldingi checkpoint topildi: ${currentIndex}-testdan (${currentIndex + 1}/${missingList.length}) davom ettirilmoqda...\n`);
      }
    } catch {}
  }
  const workers = Array.from({ length: CONCURRENCY }, async (_, workerId) => {
    while (true) {
      if (currentIndex >= missingList.length) break;
      const idx = currentIndex++;
      const item = missingList[idx];

      try {
        const result = await processQuiz(item, idx, missingList.length, existingMap, localDb);
        if (result.skipped) {
          totalSkipped++;
        } else {
          totalImportedQuizzes++;
          totalImportedQuestions += result.questionsCount;
        }

        fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify({ lastIndex: idx + 1 }, null, 2));
      } catch (err) {
        console.error(`  ❌ Worker #${workerId} xatolik (#${idx + 1}):`, err.message);
      }
    }
  });

  await Promise.all(workers);

  console.log('\n=============================================');
  console.log(`🎉 Barcha yangi testlar to'liq yuklandi!`);
  console.log(`✅ Yangi qo'shilgan testlar: ${totalImportedQuizzes} ta`);
  console.log(`✅ Yangi qo'shilgan savollar: ${totalImportedQuestions} ta`);
  console.log(`⏭️ O'tkazib yuborilgan (allaqachon bor): ${totalSkipped} ta`);
  console.log('=============================================\n');

  // Update QUIZLARIM/index.json
  if (fs.existsSync(INDEX_FILE)) {
    const existingIndex = JSON.parse(fs.readFileSync(INDEX_FILE, 'utf8'));
    const indexRelPaths = new Set(existingIndex.map(i => i.relPath));
    let newlyAddedToIndex = 0;

    for (const m of missingList) {
      if (!indexRelPaths.has(m.relPath)) {
        existingIndex.push(m);
        indexRelPaths.add(m.relPath);
        newlyAddedToIndex++;
      }
    }

    fs.writeFileSync(INDEX_FILE, JSON.stringify(existingIndex, null, 2));
    console.log(`📁 QUIZLARIM/index.json yangilandi: +${newlyAddedToIndex} ta test qo'shildi. Jami: ${existingIndex.length}`);
  }

  if (fs.existsSync(CHECKPOINT_FILE)) fs.unlinkSync(CHECKPOINT_FILE);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

