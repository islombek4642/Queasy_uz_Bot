// scripts/import_missing_to_turso.mjs
import fs from 'node:fs';
import path from 'node:path';
import dns from 'node:dns';
import { TURSO_TOKEN } from '../tgcloud/lib/constants/secrets.js';
import { parseQuizInput } from '../tgcloud/lib/parsers/parser_engine.js';

try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch {}

const TURSO_URL = 'https://queasy-db-xamidullayev-i.aws-eu-north-1.turso.io';
const BASE_HOST = 'https://kiut-nm-test.uz';
const MISSING_FILE = path.join(process.cwd(), 'scratch/missing_in_turso.json');
const CHECKPOINT_FILE = path.join(process.cwd(), 'scratch/turso_import_checkpoint.json');
const USER_INIT_DATA = 'query_id=AAGqKOcJBAAAAKoo5wmVig9v&user=%7B%22id%22%3A8756078762%2C%22first_name%22%3A%22Islombek%22%2C%22last_name%22%3A%22Xamidullayev%20%EF%A3%BF%22%2C%22username%22%3A%22xamidullayev_i%22%2C%22language_code%22%3A%22uz%22%2C%22allows_write_to_pm%22%3Atrue%2C%22photo_url%22%3A%22https%3A%5C%2F%5C%2Ft.me%5C%2Fi%5C%2Fuserpic%5C%2F320%5C%2FqjtWAJtvr95hsltjS4uN9B7Mwhl1ztXx3SN2YuHMWO8yX219KAFSZE0XcQI4yvTa.svg%22%7D&auth_date=1795517600&signature=n6QRpLP4q2pl3ETYnSQJi3Z4LvyF3i1JnNWtVn8OS-1_ReyETc5I55NkO_4PqbObPUmo5g_x6ItuVJPn_qDDBQ&hash=b12eedffd80b09525dc37a7f0f3ae6f6ae14fc9c5b8a39cd7c28810a821c8181';
const INIT_DATA = process.env.INIT_DATA || process.argv[2] || USER_INIT_DATA;
const CONCURRENCY = 6; // 6 parallel workers

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

// Process a single quiz
async function processQuiz(item, index, total) {
  let category = item.fullTitle || (item.pathParts ? item.pathParts.join(' / ') : item.form);
  if (category.endsWith(` / ${item.title}`)) {
    category = category.slice(0, -(` / ${item.title}`).length);
  }

  // 1. Fetch test content
  let res;
  try {
    const testUrl = `${BASE_HOST}/api/test-content?path=${encodeURIComponent(item.relPath)}${INIT_DATA ? `&initData=${encodeURIComponent(INIT_DATA)}` : ''}`;
    res = await fetch(testUrl).then((r) => r.json());
  } catch (netErr) {
    console.warn(`  ⚠️ [${index + 1}/${total}] Tarmoq xatoligi: ${netErr.message}`);
    return 0;
  }

  if (!res || !res.success || !res.content) {
    if (res?.needActivation) {
      console.warn(`  ⚠️ [${index + 1}/${total}] Server obuna talab qildi: ${res.error}`);
    } else {
      console.warn(`  ⚠️ [${index + 1}/${total}] Kontent topilmadi: ${item.title}`);
    }
    return 0;
  }

  // 2. Parse questions (Universal Hybrid with Legacy fallback)
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
    return 0;
  }

  // 3. Insert Quiz into Turso
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

  const quizId = Number(insertQuizRes.results[0]?.response?.result?.rows[0][0]?.value);
  if (!quizId) {
    throw new Error(`Quiz ID olinmadi: ${item.title}`);
  }

  // 4. Batch insert questions in chunks of 50
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
    // Clean up empty quiz if questions failed to insert
    try {
      await tursoPipeline([
        { type: 'execute', stmt: { sql: 'DELETE FROM quizzes WHERE id = ?', args: [{ type: 'integer', value: String(quizId) }] } }
      ]);
    } catch {}
    throw err;
  }

  console.log(`  ⚡ [${index + 1}/${total}] Yuklandi! Quiz ID: ${quizId} (${questions.length} ta savol) - ${item.title.slice(0, 45)}...`);
  return questions.length;
}

async function main() {
  console.log(`🚀 Turso Cloud ga PARALLEL (${CONCURRENCY} ta oqim) yuklash boshlandi...\n`);

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

  if (!TURSO_TOKEN) {
    console.warn('⚠️ DIQQAT: process.env.TURSO_TOKEN bo\'sh! Turso Cloud ga so\'rov yuborish uchun token talab qilinadi.');
    console.warn('   Ishga tushirish misoli: $env:TURSO_TOKEN="..."; node scripts/import_missing_to_turso.mjs\n');
  }

  const missingList = JSON.parse(fs.readFileSync(MISSING_FILE, 'utf8'));

  let startIndex = 0;
  if (fs.existsSync(CHECKPOINT_FILE)) {
    try {
      const cp = JSON.parse(fs.readFileSync(CHECKPOINT_FILE, 'utf8'));
      startIndex = cp.lastIndex || 0;
    } catch {}
  }

  const remaining = missingList.slice(startIndex);
  console.log(`📋 Jami qolgan testlar: ${remaining.length} ta (#${startIndex + 1} dan #${missingList.length} gacha)\n`);

  let completed = 0;
  let totalQuestions = 0;

  // Parallel pool executor
  let currentIndex = startIndex;
  const workers = Array.from({ length: CONCURRENCY }, async (_, workerId) => {
    while (true) {
      let idx;
      if (currentIndex >= missingList.length) break;
      idx = currentIndex++;

      const item = missingList[idx];
      try {
        const count = await processQuiz(item, idx, missingList.length);
        totalQuestions += count;
        completed++;

        // Update checkpoint periodically
        fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify({ lastIndex: idx + 1 }, null, 2));
      } catch (err) {
        console.error(`  ❌ Worker #${workerId} xatolik (#${idx + 1}):`, err.message);
      }
    }
  });

  await Promise.all(workers);

  console.log(`\n🎉 Barcha testlar Turso Cloud ga muvaffaqiyatli parallel yuklandi!`);
  console.log(`📊 Jami yuklangan savollar soni: ${totalQuestions} ta`);
  if (fs.existsSync(CHECKPOINT_FILE)) fs.unlinkSync(CHECKPOINT_FILE);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
