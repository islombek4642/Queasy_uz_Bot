import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { TURSO_TOKEN } from '../tgcloud/lib/constants/secrets.js';

const TURSO_URL = 'https://queasy-db-xamidullayev-i.aws-eu-north-1.turso.io';
const BASE_HOST = 'https://kiut-nm-test.uz';
const USER_INIT_DATA = 'query_id=AAGqKOcJBAAAAKoo5wmVig9v&user=%7B%22id%22%3A8756078762%2C%22first_name%22%3A%22Islombek%22%2C%22last_name%22%3A%22Xamidullayev%20%EF%A3%BF%22%2C%22username%22%3A%22xamidullayev_i%22%2C%22language_code%22%3A%22uz%22%2C%22allows_write_to_pm%22%3Atrue%2C%22photo_url%22%3A%22https%3A%5C%2F%5C%2Ft.me%5C%2Fi%5C%2Fuserpic%5C%2F320%5C%2FqjtWAJtvr95hsltjS4uN9B7Mwhl1ztXx3SN2YuHMWO8yX219KAFSZE0XcQI4yvTa.svg%22%7D&auth_date=1795517600&signature=n6QRpLP4q2pl3ETYnSQJi3Z4LvyF3i1JnNWtVn8OS-1_ReyETc5I55NkO_4PqbObPUmo5g_x6ItuVJPn_qDDBQ&hash=b12eedffd80b09525dc37a7f0f3ae6f6ae14fc9c5b8a39cd7c28810a821c8181';
const INIT_DATA = process.env.INIT_DATA || process.argv[2] || USER_INIT_DATA;

async function tursoPipeline(requests, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(`${TURSO_URL}/v2/pipeline`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${TURSO_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ requests: [...requests, { type: 'close' }] }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      const data = await res.json();
      for (const r of data.results || []) {
        if (r.type === 'error') throw new Error(`Turso Error: ${r.error?.message}`);
      }
      return data;
    } catch (err) {
      if (attempt === maxRetries) throw err;
      await new Promise(r => setTimeout(r, 1000 * attempt));
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

async function test() {
  const missingFile = fs.existsSync('scratch/missing_in_turso.json') ? 'scratch/missing_in_turso.json' : 'kiut_site_index.json';
  const missingList = JSON.parse(fs.readFileSync(missingFile, 'utf8'));
  const item = missingList[0];
  console.log('Testing single quiz:', item.title);

  let category = item.fullTitle || (item.pathParts ? item.pathParts.join(' / ') : item.form);
  if (category.endsWith(` / ${item.title}`)) {
    category = category.slice(0, -(` / ${item.title}`).length);
  }

  const testUrl = `${BASE_HOST}/api/test-content?path=${encodeURIComponent(item.relPath)}&initData=${encodeURIComponent(INIT_DATA)}`;
  const res = await fetch(testUrl).then(r => r.json());
  console.log('Fetch result: success =', res.success, 'content len =', res.content?.length);

  const questions = parseLegacyQuiz(res.content);
  console.log('Parsed questions count:', questions.length);

  // Check if already in Turso
  const checkRes = await tursoPipeline([
    {
      type: 'execute',
      stmt: {
        sql: "SELECT id FROM quizzes WHERE title = ? AND category = ?",
        args: [{ type: 'text', value: item.title }, { type: 'text', value: category }]
      }
    }
  ]);
  const rows = checkRes.results[0]?.response?.result?.rows || [];
  if (rows.length > 0) {
    console.log('Already in Turso with ID:', rows[0][0].value);
  } else {
    // Insert quiz
    const insertRes = await tursoPipeline([
      {
        type: 'execute',
        stmt: {
          sql: `INSERT INTO quizzes (owner_id, title, description, category, is_public, time_limit, shuffle_options, created_at)
                VALUES (0, ?, '', ?, 1, 30, 1, unixepoch())
                RETURNING id`,
          args: [{ type: 'text', value: item.title }, { type: 'text', value: category }]
        }
      }
    ]);
    const quizId = Number(insertRes.results[0]?.response?.result?.rows[0][0]?.value);
    console.log('Inserted Quiz ID:', quizId);

    // Batch insert questions
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
    console.log(`Inserted ${questions.length} questions into Turso!`);

    // Sync categories
    const parts = category.split(' / ');
    const catReqs = [];
    for (let i = 1; i <= parts.length; i++) {
      const p = parts.slice(0, i).join(' / ');
      catReqs.push({
        type: 'execute',
        stmt: {
          sql: `INSERT OR IGNORE INTO categories (path) VALUES (?)`,
          args: [{ type: 'text', value: p }]
        }
      });
    }
    await tursoPipeline(catReqs);
    console.log(`Category paths ensured: ${parts.length} levels.`);
  }
}

test().catch(console.error);

