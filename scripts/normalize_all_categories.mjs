// scripts/normalize_all_categories.mjs
import fs from 'node:fs';
import path from 'node:path';
import { TURSO_TOKEN } from '../tgcloud/lib/constants/secrets.js';

const TURSO_URL = 'https://queasy-db-xamidullayev-i.aws-eu-north-1.turso.io';
const INDEX_FILE = fs.existsSync(path.join(process.cwd(), 'kiut_site_index.json'))
  ? path.join(process.cwd(), 'kiut_site_index.json')
  : path.join(process.cwd(), 'scratch/missing_in_turso.json');

const INTAKE_MAP = {
  "KUNDUZGI TA'LIM (TIBBIYOT)": {
    "N24": "N24 (2024-2030 O'QUV YIL)",
    "N25": "N25 (2025-2031 O'QUV YIL)",
  },
  "FANLAR FARQI": {
    "N23": "N23 (2023-2027 O'QUV YIL)",
    "N24": "N24 (2024-2028 O'QUV YIL)",
  },
  "KUNDUZGI TA'LIM": {
    "N22": "N22 (2022-2026 O'QUV YIL)",
    "N23": "N23 (2023-2027 O'QUV YIL)",
    "N24": "N24 (2024-2028 O'QUV YIL)",
    "N25": "N25 (2025-2029 O'QUV YIL)",
  },
  "SIRTQI TA'LIM": {
    "N22": "N22 (2022-2026 O'QUV YIL)",
    "N23": "N23 (2023-2027 O'QUV YIL)",
    "N24": "N24 (2024-2028 O'QUV YIL)",
    "MAXSUS": "MAXSUS",
  },
  "KECHKI TA'LIM": {
    "N23": "N23 (2023-2027 O'QUV YIL)",
    "N24": "N24 (2024-2028 O'QUV YIL)",
    "N25": "N25 (2025-2029 O'QUV YIL)",
  },
  "MASOFAVIY TA'LIM": {
    "N25": "N25 (2025-2029 O'QUV YIL)",
  }
};

function normalizeCategory(cat) {
  if (!cat) return cat;
  const parts = cat.split(' / ');
  const form = parts[0];
  const intake = parts[1];

  if (INTAKE_MAP[form] && INTAKE_MAP[form][intake]) {
    parts[1] = INTAKE_MAP[form][intake];
    return parts.join(' / ');
  }
  return cat;
}

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
          throw new Error(`Turso Error: ${r.error?.message}`);
        }
      }
      return data;
    } catch (err) {
      if (attempt === maxRetries) throw err;
      await sleep(1000 * attempt);
    }
  }
}

async function main() {
  console.log('🔄 Kategoriyalarni saytdagi kabi yagona o\'quv yili formatiga keltirish boshlandi...\n');

  // 1. Fetch all quizzes
  const res = await tursoPipeline([
    { type: 'execute', stmt: { sql: "SELECT id, category FROM quizzes WHERE category IS NOT NULL" } }
  ]);
  const rows = res.results[0].response.result.rows;
  console.log(`Bazada jami kategoriyali testlar: ${rows.length}`);

  const updates = [];
  const allNewPaths = new Set();

  // Top level forms
  allNewPaths.add("KUNDUZGI TA'LIM");
  allNewPaths.add("KUNDUZGI TA'LIM (TIBBIYOT)");
  allNewPaths.add("SIRTQI TA'LIM");
  allNewPaths.add("KECHKI TA'LIM");
  allNewPaths.add("MASOFAVIY TA'LIM");
  allNewPaths.add("FANLAR FARQI");

  for (const r of rows) {
    const id = Number(r[0].value);
    const oldCat = r[1].value;
    const newCat = normalizeCategory(oldCat);

    if (newCat !== oldCat) {
      updates.push({ id, newCat });
    }

    // Extract all hierarchical sub-paths
    const parts = newCat.split(' / ');
    for (let i = 1; i <= parts.length; i++) {
      allNewPaths.add(parts.slice(0, i).join(' / '));
    }
  }

  console.log(`⚡ Yangilanishi kerak bo'lgan testlar soni: ${updates.length}`);
  console.log(`📁 Yaratiladigan yagona kategoriyalar soni: ${allNewPaths.size}\n`);

  // 2. Batch update quizzes.category in chunks of 100
  const BATCH_SIZE = 100;
  for (let i = 0; i < updates.length; i += BATCH_SIZE) {
    const chunk = updates.slice(i, i + BATCH_SIZE);
    const reqs = chunk.map(u => ({
      type: 'execute',
      stmt: {
        sql: `UPDATE quizzes SET category = ? WHERE id = ?`,
        args: [
          { type: 'text', value: u.newCat },
          { type: 'integer', value: String(u.id) }
        ]
      }
    }));

    await tursoPipeline(reqs);
    process.stdout.write(`  [${Math.min(i + BATCH_SIZE, updates.length)}/${updates.length}] testlar yangilandi...\r`);
  }
  console.log('\n✅ Barcha testlarning kategoriyalari muvaffaqiyatli yangilandi!\n');

  // 3. Rebuild categories table
  console.log('🔄 Categories jadvalini yangilash boshlandi...');
  await tursoPipeline([
    { type: 'execute', stmt: { sql: "DELETE FROM categories" } }
  ]);

  const pathList = Array.from(allNewPaths);
  for (let i = 0; i < pathList.length; i += BATCH_SIZE) {
    const chunk = pathList.slice(i, i + BATCH_SIZE);
    const reqs = chunk.map(p => ({
      type: 'execute',
      stmt: {
        sql: `INSERT OR IGNORE INTO categories (path) VALUES (?)`,
        args: [{ type: 'text', value: p }]
      }
    }));
    await tursoPipeline(reqs);
  }
  console.log(`✅ Categories jadvaliga ${pathList.length} ta yagona toza yo'nalish kiritildi!\n`);

  // 4. Update QUIZLARIM/index.json if exists
  if (fs.existsSync(INDEX_FILE)) {
    const indexData = JSON.parse(fs.readFileSync(INDEX_FILE, 'utf8'));
    let updatedInIndex = 0;
    for (const item of indexData) {
      const oldCat = item.fullTitle || (item.pathParts ? item.pathParts.join(' / ') : item.form);
      const newCat = normalizeCategory(oldCat);
      if (newCat !== oldCat) {
        item.fullTitle = newCat;
        item.pathParts = newCat.split(' / ');
        item.intake = item.pathParts[1];
        updatedInIndex++;
      }
    }
    fs.writeFileSync(INDEX_FILE, JSON.stringify(indexData, null, 2));
    console.log(`✅ QUIZLARIM/index.json yangilandi: ${updatedInIndex} ta test to'g'rilandi.`);
  }

  console.log('\n🎉 Barcha kategoriyalar saytdagi kabi yagona o\'quv yili formatiga to\'liq keltirildi!');
}

main().catch(console.error);

