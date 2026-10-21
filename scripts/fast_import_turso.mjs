// scripts/fast_import_turso.mjs
import fs from 'node:fs';
import path from 'node:path';
import { TURSO_TOKEN } from '../tgcloud/lib/constants/secrets.js';

const TURSO_URL = 'https://queasy-db-xamidullayev-i.aws-eu-north-1.turso.io';
const BASE_HOST = 'https://kiut-nm-test.uz';
const MISSING_FILE = path.join(process.cwd(), 'scratch/missing_in_turso.json');
const CHECKPOINT_FILE = path.join(process.cwd(), 'scratch/turso_import_checkpoint.json');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function tursoPipeline(requests, maxRetries = 3) {
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
      console.warn(`    ⚠️ Turso xato (urinish ${attempt}/${maxRetries}): ${err.message}`);
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

async function main() {
  console.log('🚀 Fast Turso Importer ishga tushdi...');

  const missingList = JSON.parse(fs.readFileSync(MISSING_FILE, 'utf8'));

  let startIndex = 0;
  if (fs.existsSync(CHECKPOINT_FILE)) {
    try {
      const cp = JSON.parse(fs.readFileSync(CHECKPOINT_FILE, 'utf8'));
      startIndex = cp.lastIndex || 0;
    } catch {}
  }

  console.log(`📋 Qolgan testlar: #${startIndex + 1} dan #${missingList.length} gacha (Jami: ${missingList.length - startIndex} ta)\n`);

  // 1-QADAM: Barcha qolgan testlarning kontentini tezkor parallel yuklab olamiz (concurrency = 10)
  console.log('📥 1. Serverdan barcha test kontentlarini parallel yuklab olish boshlandi...');
  const testPayloads = [];

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
          return { item, globalIdx, questions: qs };
        }
      } catch (e) {
        console.warn(`  ⚠️ Fetch xatolik: ${item.title}`);
      }
      return null;
    });

    const results = await Promise.all(promises);
    for (const r of results) {
      if (r && r.questions.length > 0) testPayloads.push(r);
    }
    process.stdout.write(`  Yuklandi: ${testPayloads.length}/${missingList.length - startIndex}\r`);
  }
  console.log(`\n✅ Barcha ${testPayloads.length} ta test kontenti xotiraga yuklandi!\n`);

  // 2-QADAM: Turso ga pipelining orqali tezkor yuklash
  // Har bir test uchun: 1 ta query da Quiz yaratish va uning barcha savollarini yuborish
  console.log('⚡ 2. Turso Cloud ga tezkor yuklash boshlandi...');

  for (let p = 0; p < testPayloads.length; p++) {
    const { item, globalIdx, questions } = testPayloads[p];
    const t0 = Date.now();

    let category = item.fullTitle || (item.pathParts ? item.pathParts.join(' / ') : item.form);
    if (category.endsWith(` / ${item.title}`)) {
      category = category.slice(0, -(` / ${item.title}`).length);
    }

    try {
      // 1. Create Quiz
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

      // 2. Batch insert all questions in chunks of 100
      const CHUNK = 100;
      for (let c = 0; c < questions.length; c += CHUNK) {
        const slice = questions.slice(c, c + CHUNK);
        const reqs = slice.map((q, idx) => ({
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

      const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
      console.log(`[${p + 1}/${testPayloads.length}] (#${globalIdx + 1}) ✅ Quiz ${quizId}: ${questions.length} savol (${elapsed}s) - ${item.title.slice(0, 40)}`);

      fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify({ lastIndex: globalIdx + 1 }, null, 2));
    } catch (err) {
      console.error(`❌ Xatolik (#${globalIdx + 1}):`, err.message);
    }
  }

  console.log('\n🎉 Barcha testlar Turso Cloud ga muvaffaqiyatli yuklandi!');
  if (fs.existsSync(CHECKPOINT_FILE)) fs.unlinkSync(CHECKPOINT_FILE);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
