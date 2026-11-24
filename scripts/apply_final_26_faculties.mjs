import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import turso from '../tgcloud/lib/turso_client.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const siteIndex = JSON.parse(fs.readFileSync('kiut_site_index.json', 'utf8'));

const siteFaculties = new Set();
for (const item of siteIndex) {
  if (item.pathParts && item.pathParts.length >= 3) {
    siteFaculties.add(item.pathParts.slice(0, 3).join(' / '));
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
        await sleep(attempt * 1000);
      }
    }
  }
}

async function main() {
  console.log('===========================================================');
  console.log('🔄 APPLYING FINAL 26 CANONICAL FACULTY MAPPINGS');
  console.log('===========================================================\n');

  const dbQuizzes = await turso.all('SELECT DISTINCT category FROM quizzes WHERE category IS NOT NULL');
  const directMappings = new Map();

  for (const row of dbQuizzes) {
    const parts = row.category.split(' / ');
    if (parts.length >= 3) {
      const dbFacultyPrefix = parts.slice(0, 3).join(' / ');
      if (!siteFaculties.has(dbFacultyPrefix)) {
        for (const sf of siteFaculties) {
          const sfParts = sf.split(' / ');
          if (sfParts[0] === parts[0] && sfParts[1] === parts[1]) {
            const sfFac = sfParts[2];
            const dbFac = parts[2];
            if (sfFac.startsWith(dbFac) || dbFac.startsWith(sfFac)) {
              directMappings.set(dbFacultyPrefix, sf);
              break;
            }
          }
        }
      }
    }
  }

  console.log(`Found ${directMappings.size} faculty prefixes to update.\n`);

  const localDbPath = path.join(process.cwd(), 'queasy_ready.sqlite');
  const localDb = fs.existsSync(localDbPath) ? new DatabaseSync(localDbPath) : null;
  if (localDb) localDb.exec('BEGIN TRANSACTION');

  let i = 0;
  for (const [oldPrefix, canonicalPrefix] of directMappings.entries()) {
    i++;
    process.stdout.write(`\r[${i}/${directMappings.size}] Renaming: ${oldPrefix.split(' / ')[2]}...`);

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
  console.log('✅ Turso quizzes updated!\n');

  // Rebuild categories table
  console.log('⏳ Rebuilding categories table...');
  const allQuizzes = await turso.all('SELECT DISTINCT category FROM quizzes WHERE is_public = 1 AND category IS NOT NULL');

  const allCategoryPaths = new Set();
  for (const q of allQuizzes) {
    if (!q.category) continue;
    const parts = q.category.split(' / ');
    for (let j = 1; j <= parts.length; j++) {
      allCategoryPaths.add(parts.slice(0, j).join(' / '));
    }
  }

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

  // Turso categories
  console.log('⏳ Syncing categories in Turso Cloud...');
  await turso.run('DELETE FROM categories');
  await batchInsertCategories(orderedCategories, 25);
  console.log('\n✅ Turso categories synchronized!');

  // Local SQLite categories
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
    console.log('✅ Local categories synchronized!');
  }

  // Verification
  console.log('\n🔍 Final Check for SIRTQI TA\'LIM / N23 / HISTORY:');
  const verifyRows = await turso.all(
    "SELECT DISTINCT category FROM quizzes WHERE category LIKE '%SIRTQI TA%LIM / N23%HISTORY%'"
  );
  verifyRows.sort((a, b) => a.category.localeCompare(b.category));
  for (const r of verifyRows) {
    console.log(`  📁 ${r.category}`);
  }

  console.log('\n===========================================================');
  console.log('🎉 100% BIRLASHTIRILDI! HAMMA SEMESTRLAR BIR JOYDA!');
  console.log('===========================================================');
}

main().catch(console.error);

