// scripts/ingest_kiut_tests.mjs
import fs from 'fs';
import path from 'path';
import { resolveToken } from 'file:///C:/Users/Islombek/AppData/Local/npm-cache/_npx/5ffcbfb9bb9c789b/node_modules/@tgcloud/cli/src/core/credentials.js';
import { scanFiles } from 'file:///C:/Users/Islombek/AppData/Local/npm-cache/_npx/5ffcbfb9bb9c789b/node_modules/@tgcloud/cli/src/core/scanner.js';
import { pathToModule } from 'file:///C:/Users/Islombek/AppData/Local/npm-cache/_npx/5ffcbfb9bb9c789b/node_modules/@tgcloud/cli/src/core/snapshot.js';
import { readWd } from 'file:///C:/Users/Islombek/AppData/Local/npm-cache/_npx/5ffcbfb9bb9c789b/node_modules/@tgcloud/cli/src/core/workdir.js';
import { runFunction } from 'file:///C:/Users/Islombek/AppData/Local/npm-cache/_npx/5ffcbfb9bb9c789b/node_modules/@tgcloud/cli/src/api/endpoints.js';
import { parseQuizInput } from '../tgcloud/lib/parsers/parser_engine.js';

const ROOT_DIR = 'd:/Serverless/BARCHA TESTLAR';
const MAX_BATCH_COUNT = 10;
const MAX_BATCH_BYTES = 600 * 1024; // 600 KB safe limit
const CHECKPOINT_FILE = path.join(process.cwd(), 'scripts', '.ingest_checkpoint.json');

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  console.log('🚀 KIUT Testlarini bazaga yuklash (davomi)...');
  const token = await resolveToken();
  const allFiles = scanFiles();
  const sources = {};
  for (const f of allFiles) {
    sources[pathToModule(f)] = readWd(f);
  }

  // 1. Scan all docx files
  console.log('📁 Test fayllari qidirilmoqda...');
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
  scan(ROOT_DIR);
  console.log(`✅ Jami ${filesList.length} ta .docx fayl mavjud.`);

  // Load checkpoint
  let startIndex = 0;
  let totalUploaded = 0;
  if (fs.existsSync(CHECKPOINT_FILE)) {
    try {
      const cp = JSON.parse(fs.readFileSync(CHECKPOINT_FILE, 'utf-8'));
      startIndex = cp.lastIndex || 0;
      totalUploaded = cp.totalUploaded || 0;
      console.log(`📌 To'xtagan joyidan davom ettirilmoqda: index #${startIndex}, yuklangan: ${totalUploaded} ta test`);
    } catch {}
  }

  let batch = [];
  let currentBatchBytes = 0;
  let batchIndex = Math.floor(startIndex / MAX_BATCH_COUNT) + 1;

  async function sendBatch(batchToSend, fileIndex) {
    let uploaded = false;
    while (!uploaded) {
      try {
        const res = await runFunction(token, 'endpoints/ingest_kiut_batch', sources, {
          secret: 'KIUT_QUEASY_SECRET_2026',
          quizzes: batchToSend,
        });

        if (res?.result?.success) {
          totalUploaded += res.result.insertedCount || batchToSend.length;
          uploaded = true;
          console.log(`[#${batchIndex}] +${res.result.insertedCount || batchToSend.length} test yuklandi. Jami: ${totalUploaded} ta (${((fileIndex / filesList.length) * 100).toFixed(1)}%) [${fileIndex + 1}/${filesList.length}]`);

          // Save checkpoint
          fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify({
            lastIndex: fileIndex + 1,
            totalUploaded,
            timestamp: new Date().toISOString(),
          }));

          await sleep(3500);
        } else {
          console.error(`[#${batchIndex}] Xatolik:`, res?.result?.error || res);
          await sleep(5000);
        }
      } catch (err) {
        const errMsg = err.message || '';
        const match = errMsg.match(/retry after (\d+)/i);
        if (match) {
          const waitSec = Number(match[1]) + 1;
          console.log(`[#${batchIndex}] ⏳ Rate limit: ${waitSec} soniya kutilmoqda...`);
          await sleep(waitSec * 1000);
        } else {
          console.error(`[#${batchIndex}] Server xatosi:`, errMsg);
          await sleep(5000);
        }
      }
    }
    batchIndex++;
  }

  for (let i = startIndex; i < filesList.length; i++) {
    const filePath = filesList[i];
    const fileName = path.basename(filePath);
    const relDir = path.relative(ROOT_DIR, path.dirname(filePath));
    const category = relDir.split(path.sep).join(' / ');

    try {
      const buf = fs.readFileSync(filePath);
      const parsed = parseQuizInput(buf, fileName);

      if (parsed.success && Array.isArray(parsed.questions) && parsed.questions.length > 0) {
        const quizObj = {
          title: parsed.title,
          category,
          description: `KIUT ${category}`,
          timeLimit: 30,
          questions: parsed.questions,
        };
        const approxBytes = JSON.stringify(quizObj).length;

        // If adding this exceeds bytes limit and batch not empty, flush current batch first
        if (currentBatchBytes + approxBytes > MAX_BATCH_BYTES && batch.length > 0) {
          await sendBatch(batch, i - 1);
          batch = [];
          currentBatchBytes = 0;
        }

        batch.push(quizObj);
        currentBatchBytes += approxBytes;
      }
    } catch (e) {
      console.warn(`⚠️ O'qishda xatolik: ${fileName}: ${e.message}`);
    }

    // If batch reached max count or end of files
    if (batch.length >= MAX_BATCH_COUNT || (i === filesList.length - 1 && batch.length > 0)) {
      await sendBatch(batch, i);
      batch = [];
      currentBatchBytes = 0;
    }
  }

  // Clear checkpoint on completion
  if (fs.existsSync(CHECKPOINT_FILE)) {
    fs.unlinkSync(CHECKPOINT_FILE);
  }

  console.log(`\n🎉 Barcha KIUT testlari to'liq yuklandi! Jami muvaffaqiyatli yuklangan testlar: ${totalUploaded}`);
}

main().catch(console.error);
