// scripts/import_missing_tests.mjs
import fs from 'node:fs';
import path from 'node:path';
import sqlite3 from 'node:sqlite';
import { spawnSync } from 'node:child_process';

const INDEX_FILE = 'D:/Serverless/QUIZLARIM/index.json';
const DB_FILE = 'D:/Serverless/Queasy_uz_Bot/queasy_ready.sqlite';
const CHECKPOINT_FILE = 'D:/Serverless/Queasy_uz_Bot/scripts/.import_checkpoint.json';
const BASE_HOST = 'https://kiut-nm-test.uz';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Run tgcloud endpoint to upload images
function uploadImagesBatch(urls) {
  if (!urls || urls.length === 0) return {};
  const argStr = JSON.stringify({ urls });
  
  const res = spawnSync('npx.cmd', ['--yes', '@tgcloud/cli', 'run', 'endpoints/upload_media_batch', `"${argStr.replace(/"/g, '\\"')}"`], {
    encoding: 'utf8',
    shell: true,
  });

  const output = res.stdout || '';
  // parse JSON output from tgcloud: < { success: true, results: ... }
  const match = output.match(/<\s*(\{[\s\S]*\})\s*\d+ms/);
  if (match) {
    try {
      // tgcloud output uses unquoted keys or JS object format sometimes, or standard JSON
      const jsonStr = match[1].replace(/([a-zA-Z0-9_]+):/g, '"$1":').replace(/'/g, '"');
      const parsed = JSON.parse(jsonStr);
      return parsed.results || {};
    } catch {
      try {
        const parsed = eval(`(${match[1]})`);
        return parsed.results || {};
      } catch (err) {
        console.error('Failed to parse tgcloud output:', err.message);
      }
    }
  }
  return {};
}

// Parse Legacy quiz format (?Question, +Correct, =Wrong)
function parseLegacyQuiz(content) {
  const lines = (content || '').split(/\r?\n/);
  const questions = [];
  let currentQuestion = null;
  let currentOptions = [];
  let currentCorrect = 0;
  let currentImgUrl = null;

  function commit() {
    if (currentQuestion && currentQuestion.trim() && currentOptions.length >= 2) {
      // Extract img tag if present in question text
      let text = currentQuestion.trim();
      const imgMatch = text.match(/<img[^>]*src=["']([^"']+)["'][^>]*>/i);
      let imgUrl = currentImgUrl;
      if (imgMatch) {
        imgUrl = imgMatch[1];
        text = text.replace(/<img[^>]*>/gi, '').trim();
      }

      questions.push({
        questionText: text,
        options: currentOptions,
        correctOptionId: currentCorrect,
        rawImgUrl: imgUrl,
      });
    }
    currentQuestion = null;
    currentOptions = [];
    currentCorrect = 0;
    currentImgUrl = null;
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
  console.log('🚀 QUIZLARIM dan Queasy_uz_Bot ga yangi testlarni import qilish boshlandi...\n');

  const quizlarim = JSON.parse(fs.readFileSync(INDEX_FILE, 'utf8'));
  const db = new sqlite3.DatabaseSync(DB_FILE);

  const existingRows = db.prepare('SELECT title FROM quizzes WHERE owner_id = 0').all();
  const existingTitles = new Set(existingRows.map((r) => r.title.trim().toLowerCase()));

  const missing = quizlarim.filter((q) => !existingTitles.has(q.title.trim().toLowerCase()));
  console.log(`📋 Jami qo'shilishi kerak bo'lgan testlar: ${missing.length} ta`);

  // Load checkpoint
  let startIndex = 0;
  if (fs.existsSync(CHECKPOINT_FILE)) {
    try {
      const cp = JSON.parse(fs.readFileSync(CHECKPOINT_FILE, 'utf8'));
      startIndex = cp.lastIndex || 0;
      console.log(`📌 To'xtagan joyidan davom ettirilmoqda: #${startIndex} indeksdan\n`);
    } catch {}
  }

  const insertQuizStmt = db.prepare(`
    INSERT INTO quizzes (owner_id, title, description, category, is_public, time_limit, shuffle_options, created_at)
    VALUES (0, ?, '', ?, 1, 30, 1, unixepoch())
  `);

  const insertQStmt = db.prepare(`
    INSERT INTO questions (quiz_id, order_index, question_text, options_json, correct_option_id, explanation, photo_file_id, photo_caption)
    VALUES (?, ?, ?, ?, ?, NULL, ?, NULL)
  `);

  const insertCategoryStmt = db.prepare(`
    INSERT OR IGNORE INTO categories (path) VALUES (?)
  `);

  let totalImportedQuizzes = 0;
  let totalImportedQuestions = 0;
  let totalImportedImages = 0;

  for (let i = startIndex; i < missing.length; i++) {
    const item = missing[i];
    console.log(`\n[${i + 1}/${missing.length}] Yuklanmoqda: ${item.title}`);

    // Category determination
    let category = item.fullTitle || (item.pathParts ? item.pathParts.join(' / ') : item.form);
    // Remove the title itself from category if it's appended at the end
    if (category.endsWith(` / ${item.title}`)) {
      category = category.slice(0, -(` / ${item.title}`).length);
    }

    try {
      // 1. Fetch raw test content from server
      const testUrl = `${BASE_HOST}/api/test-content?path=${encodeURIComponent(item.relPath)}`;
      const res = await fetch(testUrl).then((r) => r.json());

      if (!res.success || !res.content) {
        console.warn(`  ⚠️ Serverda test kontenti topilmadi: ${item.title}`);
        continue;
      }

      // 2. Parse questions
      const parsedQuestions = parseLegacyQuiz(res.content);
      if (parsedQuestions.length === 0) {
        console.warn(`  ⚠️ Savollar ajratib olinmadi (0 ta).`);
        continue;
      }

      // 3. Find images to upload
      const imgUrlsToUpload = [];
      for (const q of parsedQuestions) {
        if (q.rawImgUrl) {
          const fullImgUrl = q.rawImgUrl.startsWith('http') ? q.rawImgUrl : `${BASE_HOST}${q.rawImgUrl}`;
          imgUrlsToUpload.push(fullImgUrl);
        }
      }

      // 4. Batch upload images to Media Channel via tgcloud
      let urlToFileIdMap = {};
      if (imgUrlsToUpload.length > 0) {
        console.log(`  🖼️ ${imgUrlsToUpload.length} ta rasm Media kanalga yuklanmoqda...`);
        // Upload in chunks of 15
        for (let c = 0; c < imgUrlsToUpload.length; c += 15) {
          const chunk = imgUrlsToUpload.slice(c, c + 15);
          const mapChunk = uploadImagesBatch(chunk);
          urlToFileIdMap = { ...urlToFileIdMap, ...mapChunk };
          await sleep(500);
        }
        totalImportedImages += Object.keys(urlToFileIdMap).length;
      }

      // 5. Database transaction: Insert Quiz and Questions
      db.exec('BEGIN TRANSACTION');
      try {
        // Insert category
        insertCategoryStmt.run(category);

        // Insert quiz
        const quizRes = insertQuizStmt.run(item.title, category);
        const quizId = quizRes.lastInsertRowid;

        // Insert questions
        for (let qIdx = 0; qIdx < parsedQuestions.length; qIdx++) {
          const q = parsedQuestions[qIdx];
          let photoFileId = null;
          if (q.rawImgUrl) {
            const fullImgUrl = q.rawImgUrl.startsWith('http') ? q.rawImgUrl : `${BASE_HOST}${q.rawImgUrl}`;
            photoFileId = urlToFileIdMap[fullImgUrl] || null;
          }

          insertQStmt.run(
            quizId,
            qIdx,
            q.questionText,
            JSON.stringify(q.options),
            q.correctOptionId,
            photoFileId
          );
        }

        db.exec('COMMIT');
        totalImportedQuizzes++;
        totalImportedQuestions += parsedQuestions.length;

        console.log(`  ✅ Muvaffaqiyatli qo'shildi: ${parsedQuestions.length} ta savol (Quiz ID: ${quizId})`);
      } catch (dbErr) {
        db.exec('ROLLBACK');
        console.error(`  ❌ DB xatolik:`, dbErr.message);
      }

      // Update checkpoint
      fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify({ lastIndex: i + 1, totalImportedQuizzes, totalImportedQuestions }));
      await sleep(100);
    } catch (fetchErr) {
      console.error(`  ❌ Xatolik yuz berdi:`, fetchErr.message);
    }
  }

  // Cleanup checkpoint upon completion
  if (fs.existsSync(CHECKPOINT_FILE)) {
    fs.unlinkSync(CHECKPOINT_FILE);
  }

  console.log('\n==========================================');
  console.log('🎉 BARCHA YANGI TESTLAR IMPORTI YAKUNLANDI!');
  console.log(`📊 Jami qo'shilgan testlar: ${totalImportedQuizzes} ta`);
  console.log(`❓ Jami qo'shilgan savollar: ${totalImportedQuestions} ta`);
  console.log(`🖼️ Jami yuklangan rasmlar: ${totalImportedImages} ta`);
  console.log('==========================================\n');
}

main().catch(console.error);
