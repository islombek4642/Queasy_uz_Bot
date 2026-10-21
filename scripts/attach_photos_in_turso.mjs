// scripts/attach_photos_in_turso.mjs
import { spawnSync } from 'node:child_process';
import { TURSO_TOKEN } from '../tgcloud/lib/constants/secrets.js';

const TURSO_URL = 'https://queasy-db-xamidullayev-i.aws-eu-north-1.turso.io';
const BASE_HOST = 'https://kiut-nm-test.uz';

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
      console.warn(`  ⚠️ Turso pipeline error (attempt ${attempt}/${maxRetries}):`, err.message);
      if (attempt === maxRetries) throw err;
      await sleep(1500 * attempt);
    }
  }
}

// Upload batch of URLs via tgcloud to Media Channel -1004332354841
function uploadImagesBatch(urls) {
  if (!urls || urls.length === 0) return {};
  
  // Format as single-quoted string to avoid PowerShell JSON escaping issues
  const urlListStr = urls.map((u) => `'${u}'`).join(',');
  const inputArg = `"{urls:[${urlListStr}]}"`;

  const res = spawnSync('npx.cmd', ['--yes', '@tgcloud/cli', 'run', 'endpoints/upload_media_batch', inputArg], {
    encoding: 'utf8',
    shell: true,
  });

  const output = res.stdout || '';
  const match = output.match(/<\s*(\{[\s\S]*\})\s*\d+ms/);
  if (match) {
    try {
      const parsed = eval(`(${match[1]})`);
      return parsed.results || {};
    } catch (err) {
      console.error('Failed to parse tgcloud output:', err.message);
    }
  }
  return {};
}

async function main() {
  console.log('🔍 Turso Cloud bazasidan rasmli savollar qidirilmoqda...\n');

  // Find all questions in Turso containing <img> or /api/media
  const res = await tursoPipeline([
    {
      type: 'execute',
      stmt: {
        sql: `SELECT id, quiz_id, question_text, photo_file_id 
              FROM questions 
              WHERE question_text LIKE '%<img%' OR question_text LIKE '%/api/media%'`,
      },
    },
  ]);

  const rows = res.results[0]?.response?.result?.rows || [];
  console.log(`📸 Turso bazasida jami ${rows.length} ta rasmli savol topildi!`);

  if (rows.length === 0) {
    console.log('Rasmli savollar mavjud emas.');
    return;
  }

  // Extract all unique image URLs
  const questionMap = [];
  const allUrls = new Set();

  for (const row of rows) {
    const qId = Number(row[0].value);
    const quizId = Number(row[1].value);
    const qText = row[2].value;
    const existingPhoto = row[3]?.value;

    const imgMatch = qText.match(/<img[^>]*src=["']([^"']+)["'][^>]*>/i);
    if (imgMatch) {
      let rawUrl = imgMatch[1];
      const fullUrl = rawUrl.startsWith('http') ? rawUrl : `${BASE_HOST}${rawUrl}`;
      allUrls.add(fullUrl);

      questionMap.push({
        id: qId,
        quizId,
        fullUrl,
        cleanText: qText.replace(/<img[^>]*>/gi, '').trim(),
      });
    }
  }

  const uniqueUrls = Array.from(allUrls);
  console.log(`🖼️ Jami yuklanishi kerak bo'lgan noyob rasmlar soni: ${uniqueUrls.length} ta\n`);

  // Batch upload images in chunks of 10
  console.log('🚀 tgcloud orqali Media kanalga (-1004332354841) rasmlarni yuklash boshlandi...');
  let urlToFileIdMap = {};

  for (let i = 0; i < uniqueUrls.length; i += 10) {
    const chunk = uniqueUrls.slice(i, i + 10);
    console.log(`  [${i + 1}-${Math.min(i + 10, uniqueUrls.length)}/${uniqueUrls.length}] Yuklanmoqda...`);
    const results = uploadImagesBatch(chunk);
    urlToFileIdMap = { ...urlToFileIdMap, ...results };
    await sleep(400);
  }

  const uploadedCount = Object.keys(urlToFileIdMap).length;
  console.log(`\n✅ Media kanalga yuklangan rasmlar: ${uploadedCount}/${uniqueUrls.length} ta!\n`);

  // Update Turso questions with photo_file_id and clean question_text
  console.log('🔄 Turso bazasidagi savollar photo_file_id bilan yangilanmoqda...');
  let updatedCount = 0;

  const BATCH_UPDATE_SIZE = 50;
  for (let i = 0; i < questionMap.length; i += BATCH_UPDATE_SIZE) {
    const chunk = questionMap.slice(i, i + BATCH_UPDATE_SIZE);
    const reqs = [];

    for (const item of chunk) {
      const fileId = urlToFileIdMap[item.fullUrl];
      if (fileId) {
        reqs.push({
          type: 'execute',
          stmt: {
            sql: `UPDATE questions 
                  SET photo_file_id = ?, question_text = ? 
                  WHERE id = ?`,
            args: [
              { type: 'text', value: fileId },
              { type: 'text', value: item.cleanText },
              { type: 'integer', value: String(item.id) },
            ],
          },
        });
        updatedCount++;
      }
    }

    if (reqs.length > 0) {
      await tursoPipeline(reqs);
      console.log(`  Yangilandi: ${Math.min(i + BATCH_UPDATE_SIZE, questionMap.length)}/${questionMap.length}`);
    }
  }

  console.log(`\n🎉 Turso bazasida ${updatedCount} ta savolga rasm (photo_file_id) muvaffaqiyatli ulandi!`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
