// scripts/turbo_import_turso.mjs
import fs from 'node:fs';
import path from 'node:path';
import { TURSO_TOKEN } from '../tgcloud/lib/constants/secrets.js';

const TURSO_URL = 'https://queasy-db-xamidullayev-i.aws-eu-north-1.turso.io';
const BASE_HOST = 'https://kiut-nm-test.uz';
const MISSING_FILE = path.join(process.cwd(), 'scratch/missing_in_turso.json');
const CHECKPOINT_FILE = path.join(process.cwd(), 'scratch/turso_import_checkpoint.json');
const CONCURRENCY = 4; // 4 parallel workers

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

// Ultra-fast multi-row question insert
async function insertQuizWithQuestions(item, questions) {
  let category = item.fullTitle || (item.pathParts ? item.pathParts.join(' / ') : item.form);
  if (category.endsWith(` / ${item.title}`)) {
    category = category.slice(0, -(` / ${item.title}`).length);
  }

  // 1. Insert Quiz
  const qRes = await tursoPipeline([
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

  const quizId = Number(qRes.results[0]?.response?.result?.rows[0][0]?.value);
  if (!quizId) throw new Error(`Quiz ID olinmadi: ${item.title}`);

  // 2. Multi-row batch insert: 100 questions per statement!
  const CHUNK_SIZE = 100;
  for (let c = 0; c < questions.length; c += CHUNK_SIZE) {
    const slice = questions.slice(c, c + CHUNK_SIZE);
    const valuePlaceholders = [];
    const args = [];

    for (let idx = 0; idx < slice.length; idx++) {
      const q = slice[idx];
      valuePlaceholders.push(`(?, ?, ?, ?, ?, NULL, NULL, NULL)`);
      args.push({ type: 'integer', value: String(quizId) });
      args.push({ type: 'integer', value: String(c + idx) });
      args.push({ type: 'text', value: q.questionText });
      args.push({ type: 'text', value: JSON.stringify(q.options) });
      args.push({ type: 'integer', value: String(q.correctOptionId) });
    }

    const sql = `INSERT INTO questions (quiz_id, order_index, question_text, options_json, correct_option_id, explanation, photo_file_id, photo_caption) VALUES ${valuePlaceholders.join(',')}`;
    await tursoPipeline([{ type: 'execute', stmt: { sql, args } }]);
  }

  return quizId;
}

async function main() {
  console.log('🚀 Turbo Multi-Threaded Turso Importer ishga tushdi...\n');

  const missingList = JSON.parse(fs.readFileSync(MISSING_FILE, 'utf8'));

  let startIndex = 0;
  if (fs.existsSync(CHECKPOINT_FILE)) {
    try {
      const cp = JSON.parse(fs.readFileSync(CHECKPOINT_FILE, 'utf8'));
      startIndex = cp.lastIndex || 0;
    } catch {}
  }

  const remaining = missingList.slice(startIndex);
  console.log(`📋 Qolgan testlar soni: ${remaining.length} ta (#${startIndex + 1} dan #${missingList.length} gacha)\n`);

  // Pre-fetch all remaining test contents in parallel
  console.log('📥 1. Test kontentlarini parallel yuklab olish...');
  const queue = [];

  const BATCH_FETCH = 10;
  for (let i = startIndex; i < missingList.length; i += BATCH_FETCH) {
    const batch = missingList.slice(i, i + BATCH_FETCH);
    const promises = batch.map(async (item, batchIdx) => {
      const globalIdx = i + batchIdx;
      try {
        const testUrl = `${BASE_HOST}/api/test-content?path=${encodeURIComponent(item.relPath)}`;
        const res = await fetch(testUrl).then((r) => r.json());
        if (res.success && res.content) {
          const qs = parseLegacyQuiz(res.content);
          if (qs.length > 0) {
            return { item, globalIdx, questions: qs };
          }
        }
      } catch (e) {}
      return null;
    });

    const results = await Promise.all(promises);
    for (const r of results) {
      if (r) queue.push(r);
    }
  }

  console.log(`✅ ${queue.length} ta test kontenti to'liq tayyor!\n`);

  // Multi-worker parallel Turso insert
  console.log(`⚡ 2. Turso Cloud ga ${CONCURRENCY} ta parallel oqimda yuklash boshlandi...`);
  let completed = 0;
  let totalQuestions = 0;
  let queueIndex = 0;

  const workers = Array.from({ length: CONCURRENCY }, async (_, workerId) => {
    while (true) {
      let task;
      if (queueIndex >= queue.length) break;
      task = queue[queueIndex++];

      const t0 = Date.now();
      try {
        const quizId = await insertQuizWithQuestions(task.item, task.questions);
        const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
        completed++;
        totalQuestions += task.questions.length;

        console.log(`  [${completed}/${queue.length}] ✅ #${task.globalIdx + 1} Quiz ${quizId}: ${task.questions.length} savol (${elapsed}s) - ${task.item.title.slice(0, 38)}`);
        fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify({ lastIndex: task.globalIdx + 1 }, null, 2));
      } catch (err) {
        console.error(`  ❌ Worker #${workerId} xatolik (#${task.globalIdx + 1}):`, err.message);
      }
    }
  });

  await Promise.all(workers);

  console.log(`\n🎉 Barcha testlar Turso Cloud ga muvaffaqiyatli parallel yuklandi!`);
  console.log(`📊 Jami qo'shilgan savollar: ${totalQuestions} ta`);
  if (fs.existsSync(CHECKPOINT_FILE)) fs.unlinkSync(CHECKPOINT_FILE);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
