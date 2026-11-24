import fs from 'node:fs';
import path from 'node:path';
import { turso } from '../tgcloud/lib/turso_client.js';
import { parseQuizInput } from '../tgcloud/lib/parsers/parser_engine.js';
import sqlite3 from 'node:sqlite';

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir, { withFileTypes: true });
  for (const item of list) {
    const fullPath = dir + '/' + item.name;
    if (item.isDirectory()) results = results.concat(walk(fullPath));
    else results.push(fullPath);
  }
  return results;
}

const TARGET_QUIZZES = [
  { id: 2905, title: 'NAMANGAN NAMING THEORY AND PRACTICE (KUNDUZGI) (2025-2026) UZ' },
  { id: 2908, title: 'NAMANGAN RUSSIAN LANGUAGE 1 (2023-2024)(KUNDUZGI)' },
  { id: 3018, title: 'NAMANGAN ARCHAEOLOGY 2 (SIRTQI 2023-2024)' },
  { id: 3019, title: 'NAMANGAN HISTORY OF UZBEKISTAN 2 (SIRTQI 2023-2024)' },
  { id: 3035, title: 'PHILOSOPHY (SIRTQI 2023-2024)' },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function batchWithRetry(statements, maxRetries = 5) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await turso.batch(statements);
    } catch (err) {
      if (attempt === maxRetries) throw err;
      const delay = attempt * 1500;
      console.log(`\n      ⚠️ Ulanishda uzilish (${err.message}). ${delay}ms dan so'ng qayta urinilmoqda (${attempt}/${maxRetries})...`);
      await sleep(delay);
    }
  }
}

async function main() {
  console.log('🚀 5 ta testga savollarni kiritish (resilient mode)...');

  const allDocx = walk('D:/Serverless/QUIZLARIM/TESTLAR_DOCX');
  const docxMap = new Map();
  for (const f of allDocx) {
    const base = path.basename(f, '.docx').trim().toLowerCase();
    docxMap.set(base, f);
  }

  const localDb = fs.existsSync('queasy_ready.sqlite') ? new sqlite3.DatabaseSync('queasy_ready.sqlite') : null;

  for (const target of TARGET_QUIZZES) {
    // Check if already has questions in Turso
    const existing = await turso.get('SELECT count(id) as c FROM questions WHERE quiz_id = ?', [target.id]);
    const existingCount = Number(existing?.c || 0);

    const key = target.title.trim().toLowerCase();
    const filePath = docxMap.get(key);
    if (!filePath) {
      console.error(`❌ Fayl topilmadi: ${target.title}`);
      continue;
    }

    const buf = fs.readFileSync(filePath);
    const parsed = parseQuizInput(buf, path.basename(filePath));

    if (!parsed.success || parsed.questions.length === 0) {
      console.error(`❌ Parse qilishda xatolik: ${parsed.error}`);
      continue;
    }

    if (existingCount >= parsed.questions.length) {
      console.log(`⚡ Quiz #${target.id} da allaqachon ${existingCount} ta savol bor, o'tkazib yuborildi.`);
      continue;
    }

    console.log(`\n⏳ Quiz #${target.id} (${parsed.questions.length} savol): ${path.basename(filePath)}`);

    // Clean old partial
    await turso.run('DELETE FROM questions WHERE quiz_id = ?', [target.id]);
    if (localDb) {
      localDb.prepare('DELETE FROM questions WHERE quiz_id = ?').run(target.id);
    }

    const BATCH_SIZE = 30;
    const questions = parsed.questions;
    console.log(`📤 Turso Cloud ga yuklanmoqda (${questions.length} ta savol, ${BATCH_SIZE} tadan to'plam)...`);

    for (let i = 0; i < questions.length; i += BATCH_SIZE) {
      const slice = questions.slice(i, i + BATCH_SIZE);
      const statements = slice.map((q, idx) => ({
        sql: `INSERT INTO questions (quiz_id, order_index, question_text, options_json, correct_option_id, explanation, photo_file_id, photo_caption) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        params: [
          target.id,
          i + idx + 1,
          q.questionText || '',
          JSON.stringify(q.options || []),
          Number(q.correctOptionId || 0),
          q.explanation || null,
          q.photoFileId || null,
          q.photoCaption || null,
        ]
      }));

      await batchWithRetry(statements);
      process.stdout.write(`   ├── ${Math.min(i + BATCH_SIZE, questions.length)} / ${questions.length} savol yuklandi\r`);
      await sleep(200); // 200ms delay between batches for socket stability
    }
    console.log(`\n   ✅ Turso Cloud ga Quiz #${target.id} savollari to'liq yuklandi!`);

    if (localDb) {
      const insStmt = localDb.prepare(`
        INSERT INTO questions (quiz_id, order_index, question_text, options_json, correct_option_id, explanation, photo_file_id, photo_caption)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (let idx = 0; idx < questions.length; idx++) {
        const q = questions[idx];
        insStmt.run(
          target.id,
          idx + 1,
          q.questionText || '',
          JSON.stringify(q.options || []),
          Number(q.correctOptionId || 0),
          q.explanation || null,
          q.photoFileId || null,
          q.photoCaption || null
        );
      }
      console.log(`   ✅ Mahalliy SQLite ga ham Quiz #${target.id} savollari to'liq kiritildi!`);
    }
  }

  console.log('\n===========================================================');
  console.log('🎉 BARCHA SAVOLLAR YUKLANDI! YAKUNIY VERIFIKATSIYA:');
  console.log('===========================================================');

  for (const target of TARGET_QUIZZES) {
    const countRow = await turso.get('SELECT count(id) as c FROM questions WHERE quiz_id = ?', [target.id]);
    console.log(`Quiz #${target.id} ("${target.title.slice(0, 40)}"): ${countRow?.c} ta savol mavjud.`);
  }
}

main().catch(console.error);
