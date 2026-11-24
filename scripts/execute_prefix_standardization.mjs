import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import turso from '../tgcloud/lib/turso_client.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const siteIndex = JSON.parse(fs.readFileSync('kiut_site_index.json', 'utf8'));

// Build canonical faculty map from site index
const canonicalFaculties = new Map();

for (const item of siteIndex) {
  const p = item.canonicalRelPath || item.relPath || item.path || '';
  const parts = p.split('/');
  if (parts.length >= 3) {
    const top = parts[0];
    const year = parts[1];
    const faculty = parts[2];
    const canonicalPrefix = `${top} / ${year} / ${faculty}`;

    const normFaculty = faculty.replace(/\s*\([^)]*[\u0400-\u04FFa-zA-Z0-9']+\)\s*$/i, '').trim();
    const normPrefix = `${top} / ${year} / ${normFaculty}`;

    if (!canonicalFaculties.has(normPrefix)) {
      canonicalFaculties.set(normPrefix, canonicalPrefix);
    }
  }
}

function formatArg(val) {
  if (val === null || val === undefined) return { type: 'null' };
  if (typeof val === 'number') {
    return { type: Number.isInteger(val) ? 'integer' : 'float', value: String(val) };
  }
  return { type: 'text', value: String(val) };
}

async function batchInsertCategories(categories, batchSize = 25) {
  for (let i = 0; i < categories.length; i += batchSize) {
    const chunk = categories.slice(i, i + batchSize);
    const requests = chunk.map(c => ({
      type: 'execute',
      stmt: {
        sql: 'INSERT INTO categories (id, path) VALUES (?, ?)',
        args: [formatArg(c.id), formatArg(c.path)],
      }
    }));

    for (let attempt = 1; attempt <= 4; attempt++) {
      try {
        await turso.pipeline(requests);
        process.stdout.write(`\r  Inserted ${Math.min(i + batchSize, categories.length)} / ${categories.length} categories...`);
        await sleep(100);
        break;
      } catch (err) {
        if (attempt === 4) throw err;
        console.warn(`\n  ⚠️ Attempt ${attempt} failed: ${err.message}. Retrying in ${attempt * 1000}ms...`);
        await sleep(attempt * 1000);
      }
    }
  }
}

async function main() {
  console.log('===========================================================');
  console.log('🚀 UNIFYING KIUT FACULTY CATEGORIES WITH OFFICIAL SITE');
  console.log('===========================================================\n');

  // 1. Get distinct categories from Turso
  const distinctCategories = await turso.all('SELECT DISTINCT category FROM quizzes WHERE category IS NOT NULL');
  const prefixReplacements = new Map();

  for (const row of distinctCategories) {
    const cat = row.category;
    const parts = cat.split(' / ');
    if (parts.length >= 3) {
      const top = parts[0];
      const year = parts[1];
      const faculty = parts[2];
      const prefix = `${top} / ${year} / ${faculty}`;

      const normFaculty = faculty.replace(/\s*\([^)]*[\u0400-\u04FFa-zA-Z0-9']+\)\s*$/i, '').trim();
      const normPrefix = `${top} / ${year} / ${normFaculty}`;

      const canonical = canonicalFaculties.get(normPrefix);
      if (canonical && canonical !== prefix) {
        prefixReplacements.set(prefix, canonical);
      }
    }
  }

  console.log(`Identified ${prefixReplacements.size} faculty prefixes to unify.\n`);

  // 2. Execute prefix updates on Turso and Local DB
  const localDbPath = path.join(process.cwd(), 'queasy_ready.sqlite');
  const localDb = fs.existsSync(localDbPath) ? new DatabaseSync(localDbPath) : null;
  if (localDb) localDb.exec('BEGIN TRANSACTION');

  let pCount = 0;
  for (const [oldPrefix, canonicalPrefix] of prefixReplacements.entries()) {
    pCount++;
    process.stdout.write(`\r[${pCount}/${prefixReplacements.size}] Unifying: ${oldPrefix.split(' / ')[2]}...`);

    // In Turso
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await turso.run(
          "UPDATE quizzes SET category = REPLACE(category, ?, ?) WHERE category = ? OR category LIKE ?",
          [oldPrefix, canonicalPrefix, oldPrefix, `${oldPrefix} / %`]
        );
        break;
      } catch (err) {
        if (attempt === 3) throw err;
        await sleep(1000 * attempt);
      }
    }

    // In Local SQLite
    if (localDb) {
      const stmt = localDb.prepare(
        "UPDATE quizzes SET category = REPLACE(category, ?, ?) WHERE category = ? OR category LIKE ?"
      );
      stmt.run(oldPrefix, canonicalPrefix, oldPrefix, `${oldPrefix} / %`);
    }

    await sleep(80);
  }

  if (localDb) {
    localDb.exec('COMMIT');
    console.log('\n✅ Local SQLite quizzes updated!');
  }
  console.log('✅ Turso quizzes successfully updated with canonical faculty names!\n');

  // 3. Rebuild clean categories table
  console.log('⏳ Rebuilding categories table from all active public quizzes...');
  const allQuizzes = await turso.all('SELECT DISTINCT category FROM quizzes WHERE is_public = 1 AND category IS NOT NULL');

  const allCategoryPaths = new Set();
  for (const q of allQuizzes) {
    if (!q.category) continue;
    const parts = q.category.split(' / ');
    for (let i = 1; i <= parts.length; i++) {
      allCategoryPaths.add(parts.slice(0, i).join(' / '));
    }
  }

  // Preserve canonical IDs 1-6 for root menus
  const rootOrder = [
    "KUNDUZGI TA'LIM",
    "KUNDUZGI TA'LIM (TIBBIYOT)",
    "SIRTQI TA'LIM",
    "KECHKI TA'LIM",
    "MASOFAVIY TA'LIM",
    "FANLAR FARQI",
  ];

  const orderedCategories = [];
  rootOrder.forEach((p, idx) => {
    orderedCategories.push({ id: idx + 1, path: p });
    allCategoryPaths.delete(p);
  });

  const remaining = Array.from(allCategoryPaths).sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
  );

  let nextId = 7;
  for (const p of remaining) {
    orderedCategories.push({ id: nextId++, path: p });
  }

  console.log(`Total canonical category nodes: ${orderedCategories.length}`);

  // 4. Update Turso categories table
  console.log('⏳ Syncing categories in Turso Cloud...');
  await turso.run('DELETE FROM categories');
  await batchInsertCategories(orderedCategories, 25);
  console.log('\n✅ Turso categories table synchronized!');

  // 5. Update Local SQLite categories table
  if (localDb) {
    console.log('⏳ Syncing categories in local SQLite...');
    localDb.exec('DELETE FROM categories');
    const insCatStmt = localDb.prepare('INSERT INTO categories (id, path) VALUES (?, ?)');
    localDb.exec('BEGIN TRANSACTION');
    for (const c of orderedCategories) {
      insCatStmt.run(c.id, c.path);
    }
    localDb.exec('COMMIT');
    localDb.close();
    console.log('✅ Local categories table synchronized!');
  }

  // 6. Verification: Check History under SIRTQI N23
  console.log('\n🔍 Verification: SIRTQI TA\'LIM / N23 / HISTORY categories in Turso:');
  const checkRows = await turso.all(
    "SELECT DISTINCT category FROM quizzes WHERE category LIKE '%SIRTQI TA%LIM / N23%HISTORY%'"
  );
  checkRows.sort((a, b) => a.category.localeCompare(b.category));
  for (const r of checkRows) {
    console.log(`  📁 ${r.category}`);
  }

  console.log('\n===========================================================');
  console.log('🎉 BARCHA YO\'NALISHLAR SAYT BILAN TO\'LIQ BIRLASHTIRILDI!');
  console.log('===========================================================');
}

main().catch(console.error);

