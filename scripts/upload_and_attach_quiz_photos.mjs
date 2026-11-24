// scripts/upload_and_attach_quiz_photos.mjs
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { extractLinesFromDocx } from '../tgcloud/lib/parsers/docx_reader.js';
import { parseLegacyFormat } from '../tgcloud/lib/parsers/legacy_parser.js';
import { TURSO_TOKEN } from '../tgcloud/lib/constants/secrets.js';

const TURSO_URL = 'https://queasy-db-xamidullayev-i.aws-eu-north-1.turso.io';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function collectSources(dir = 'tgcloud') {
  const sources = {};
  function walk(current, base = '') {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      const rel = path.posix.join(base, entry.name);
      if (entry.isDirectory()) {
        walk(full, rel);
      } else if (entry.name.endsWith('.js')) {
        const mod = rel.replace(/\\/g, '/').replace(/\.js$/, '');
        sources[mod] = fs.readFileSync(full, 'utf8');
      }
    }
  }
  walk(dir);
  return sources;
}

const creds = JSON.parse(fs.readFileSync('.tgcloud/credentials', 'utf8'));
const token = creds.token;
const tgcloudSources = collectSources('tgcloud');

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

function norm(s) {
  return (s || '').toLowerCase().replace(/<[^>]*>/g, '').replace(/[^a-z0-9]/gi, '').trim();
}

async function uploadBatchDirect(items) {
  if (!items || items.length === 0) return {};

  const payload = {
    module: 'endpoints/upload_media_batch',
    sources: tgcloudSources,
    args: {
      secret: 'KIUT_QUEASY_SECRET_2026',
      items: items.map((it) => ({
        id: String(it.id),
        base64: it.base64,
        mimeType: it.mimeType,
        caption: it.caption,
      })),
    },
  };

  const res = await fetch('https://cloud.telegram.org/app8869835041/manage/run', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const txt = await res.text();
    console.error(`TgCloud manage/run error (HTTP ${res.status}):`, txt);
    return {};
  }

  const data = await res.json();
  const innerRes = data?.result?.result;
  if (innerRes?.success && Array.isArray(innerRes.results)) {
    const map = {};
    for (const r of innerRes.results) {
      if (r.id && r.fileId) {
        map[r.id] = r.fileId;
      } else if (r.error) {
        console.error(`  ❌ Item ${r.id} error:`, r.error);
      }
    }
    return map;
  } else {
    console.error('TgCloud execution returned failure:', data?.result || data);
    return {};
  }
}

async function processQuiz1899() {
  console.log('🚀 Processing Quiz 1899: NAMANGAN COMPUTER 2...');
  const docxPath = 'KIUT_TEST/SIRTQI TA\'LIM/N23 (2023-2027 O\'QUV YIL)/(B.A.) HISTORY (BY COUNTRIES AND DIRECTIONS) (TARIX)/2-SEMESTR/NAMANGAN COMPUTER 2 (HSTP,PREP,PRIP,PSYP)(2023-2024)(UZ).docx';

  if (!fs.existsSync(docxPath)) {
    throw new Error('Docx file not found: ' + docxPath);
  }

  const buf = fs.readFileSync(docxPath);
  const lines = extractLinesFromDocx(buf);
  const docxQuestions = parseLegacyFormat(lines);

  const db = new DatabaseSync('queasy_ready.sqlite');
  const dbQuestions = db.prepare('SELECT id, question_text, options_json, photo_file_id FROM questions WHERE quiz_id = 1899 ORDER BY id ASC').all();

  const matched = [];
  const matchedDbIds = new Set();

  for (let dIdx = 0; dIdx < docxQuestions.length; dIdx++) {
    const dq = docxQuestions[dIdx];
    if (!dq.photoFileId) continue;

    const dqOpts = (dq.options || []).map(norm).sort().join('|');

    let bestMatch = null;
    for (const dbq of dbQuestions) {
      if (matchedDbIds.has(dbq.id)) continue;
      const dbOpts = JSON.parse(dbq.options_json || '[]').map(norm).sort().join('|');

      if (dqOpts && dbOpts && dqOpts === dbOpts) {
        bestMatch = dbq;
        break;
      }
    }

    if (bestMatch) {
      matchedDbIds.add(bestMatch.id);
      if (bestMatch.photo_file_id) {
        continue; // Already has photo_file_id!
      }
      const dataUriMatch = dq.photoFileId.match(/^data:([^;]+);base64,(.+)$/);
      if (dataUriMatch) {
        matched.push({
          id: bestMatch.id,
          questionText: bestMatch.question_text.replace(/<img[^>]*>/gi, '').trim(),
          mimeType: dataUriMatch[1],
          base64: dataUriMatch[2],
          caption: `📝 Savol ID: ${bestMatch.id}`,
        });
      }
    }
  }

  console.log(`📸 Matched ${matched.length} questions with embedded images!`);

  // Batch upload items in chunks of 5
  const CHUNK_SIZE = 5;
  const idToFileIdMap = {};

  for (let i = 0; i < matched.length; i += CHUNK_SIZE) {
    const chunk = matched.slice(i, i + CHUNK_SIZE);
    console.log(`  Uploading batch [${i + 1}-${Math.min(i + CHUNK_SIZE, matched.length)}/${matched.length}] via direct TgCloud HTTP...`);
    const results = await uploadBatchDirect(chunk);
    for (const [k, v] of Object.entries(results)) {
      if (v) idToFileIdMap[k] = v;
    }
    await sleep(350);
  }

  const totalUploaded = Object.keys(idToFileIdMap).length;
  console.log(`✅ Successfully uploaded ${totalUploaded}/${matched.length} images to Media Channel!`);

  // Update SQLite
  console.log('🔄 Updating SQLite queasy_ready.sqlite...');
  const updateStmt = db.prepare('UPDATE questions SET photo_file_id = ?, question_text = ? WHERE id = ?');
  for (const item of matched) {
    const fileId = idToFileIdMap[String(item.id)];
    if (fileId) {
      updateStmt.run(fileId, item.questionText, item.id);
    }
  }

  // Update Turso Cloud
  console.log('🔄 Updating Turso Cloud Database...');
  const tursoReqs = [];
  for (const item of matched) {
    const fileId = idToFileIdMap[String(item.id)];
    if (fileId) {
      tursoReqs.push({
        type: 'execute',
        stmt: {
          sql: 'UPDATE questions SET photo_file_id = ?, question_text = ? WHERE id = ?',
          args: [
            { type: 'text', value: fileId },
            { type: 'text', value: item.questionText },
            { type: 'integer', value: String(item.id) },
          ],
        },
      });
    }
  }

  if (tursoReqs.length > 0) {
    await tursoPipeline(tursoReqs);
  }

  console.log('🎉 Quiz 1899 updated with all photo_file_ids in SQLite and Turso!');
}

processQuiz1899().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
