// scripts/sanitize_all_kiut_database.mjs
// Automated runner that sanitizes all KIUT tests in the database in safe batches
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const CHECKPOINT_FILE = path.join(process.cwd(), 'scripts', '.sanitize_checkpoint.json');
const ARGS_FILE = path.join(process.cwd(), 'scripts', '.sanitize_args.json');
const BATCH_SIZE = 25;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log('🚀 KIUT testlarini tozalash va formatlash boshlandi...\n');

  let currentQuizId = 3;
  let totalProcessedQuizzes = 0;
  let totalQuestionsScanned = 0;
  let totalQuestionsUpdated = 0;
  let batchNum = 1;

  if (fs.existsSync(CHECKPOINT_FILE)) {
    try {
      const cp = JSON.parse(fs.readFileSync(CHECKPOINT_FILE, 'utf-8'));
      if (cp.currentQuizId) {
        currentQuizId = cp.currentQuizId;
        totalProcessedQuizzes = cp.totalProcessedQuizzes || 0;
        totalQuestionsScanned = cp.totalQuestionsScanned || 0;
        totalQuestionsUpdated = cp.totalQuestionsUpdated || 0;
        batchNum = cp.batchNum || 1;
        console.log(`📌 To'xtagan joyidan davom ettirilmoqda: Quiz ID #${currentQuizId}, oldin tuzatilgan: ${totalQuestionsUpdated} ta savol\n`);
      }
    } catch {}
  }

  let isDone = false;

  while (!isDone) {
    fs.writeFileSync(ARGS_FILE, JSON.stringify({ startQuizId: currentQuizId, batchSize: BATCH_SIZE }), 'utf-8');
    const cmd = `npx @tgcloud/cli run endpoints/sanitize_kiut_batch (Get-Content "${ARGS_FILE}" -Raw)`;

    let success = false;
    let attempts = 0;

    while (!success && attempts < 3) {
      attempts++;
      try {
        const rawOutput = execSync(cmd, {
          shell: 'powershell.exe',
          encoding: 'utf-8',
          timeout: 60000,
          stdio: ['pipe', 'pipe', 'pipe'],
        });

        const startIdx = rawOutput.indexOf('< {');
        if (startIdx === -1) {
          throw new Error('Natija formati aniqlanmadi: ' + rawOutput.slice(0, 200));
        }

        const jsonPart = rawOutput.slice(startIdx + 2);
        const endIdx = jsonPart.lastIndexOf('}');
        if (endIdx === -1) {
          throw new Error('Yopuvchi qavs topilmadi: ' + rawOutput.slice(0, 200));
        }

        const cleanObjStr = jsonPart.slice(0, endIdx + 1);
        const res = eval(`(${cleanObjStr})`);

        if (!res.success) {
          throw new Error(res.error || 'Noma\'lum xatolik');
        }

        totalProcessedQuizzes += res.quizzesProcessed || 0;
        totalQuestionsScanned += res.questionsScanned || 0;
        totalQuestionsUpdated += res.questionsUpdated || 0;

        console.log(
          `[#${batchNum}] Quizzes: ${res.currentBatch || currentQuizId} | Savollar: ${res.questionsScanned} ta | Tuzatildi: +${res.questionsUpdated} ta (Jami: ${totalQuestionsUpdated})`
        );

        if (res.isDone || !res.nextQuizId) {
          isDone = true;
          break;
        }

        currentQuizId = res.nextQuizId;
        batchNum++;
        success = true;

        // Save checkpoint
        fs.writeFileSync(
          CHECKPOINT_FILE,
          JSON.stringify(
            {
              currentQuizId,
              totalProcessedQuizzes,
              totalQuestionsScanned,
              totalQuestionsUpdated,
              batchNum,
              timestamp: new Date().toISOString(),
            },
            null,
            2
          )
        );

        await sleep(300);
      } catch (err) {
        console.error(`⚠️ [#${batchNum}] Xatolik (urinish ${attempts}/3):`, err.message || err);
        await sleep(3000);
      }
    }

    if (!success && !isDone) {
      console.error(`❌ Batch #${batchNum} da 3 ta urinish muvaffaqiyatsiz bo'ldi. To'xtatildi.`);
      break;
    }
  }

  console.log('\n=============================================');
  console.log(`✅ Tozalash muvaffaqiyatli yakunlandi!`);
  console.log(`📊 Jami tekshirilgan testlar: ${totalProcessedQuizzes} ta`);
  console.log(`📝 Jami ko'rib chiqilgan savollar: ${totalQuestionsScanned} ta`);
  console.log(`✨ Barcha xato yozuvlari tuzatilgan savollar: ${totalQuestionsUpdated} ta`);
  console.log('=============================================\n');

  if (fs.existsSync(CHECKPOINT_FILE)) fs.unlinkSync(CHECKPOINT_FILE);
  if (fs.existsSync(ARGS_FILE)) fs.unlinkSync(ARGS_FILE);
}

main().catch(console.error);
