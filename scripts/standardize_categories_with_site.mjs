import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import turso from '../tgcloud/lib/turso_client.js';

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

    // Normalize without uzbek suffix for matching
    const normFaculty = faculty.replace(/\s*\([^)]*[\u0400-\u04FFa-zA-Z0-9']+\)\s*$/i, '').trim();
    const normPrefix = `${top} / ${year} / ${normFaculty}`;

    if (!canonicalFaculties.has(normPrefix)) {
      canonicalFaculties.set(normPrefix, canonicalPrefix);
    }
  }
}

console.log(`Loaded ${canonicalFaculties.size} canonical faculties from kiut_site_index.json`);

function formatArg(val) {
  if (val === null || val === undefined) return { type: 'null' };
  if (typeof val === 'number') {
    return { type: Number.isInteger(val) ? 'integer' : 'float', value: String(val) };
  }
  return { type: 'text', value: String(val) };
}

async function batchExecute(statements, batchSize = 100) {
  for (let i = 0; i < statements.length; i += batchSize) {
    const chunk = statements.slice(i, i + batchSize);
    const requests = chunk.map(s => ({
      type: 'execute',
      stmt: {
        sql: s.sql,
        args: (s.params || []).map(formatArg),
      }
    }));

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await turso.pipeline(requests);
        process.stdout.write(`\r  Processed ${Math.min(i + batchSize, statements.length)} / ${statements.length}...`);
        break;
      } catch (err) {
        if (attempt === 3) throw err;
        await new Promise(r => setTimeout(r, 1000 * attempt));
      }
    }
  }
}

async function main() {
  console.log('===========================================================');
  console.log('🔄 STANDARDIZING CATEGORIES WITH OFFICIAL KIUT SITE INDEX');
  console.log('===========================================================\n');

  // 1. Fetch quizzes from Turso
  const dbQuizzes = await turso.all('SELECT id, category FROM quizzes');
  console.log(`Total quizzes in Turso: ${dbQuizzes.length}`);

  const updates = [];

  for (const q of dbQuizzes) {
    if (!q.category) continue;
    const parts = q.category.split(' / ');
    if (parts.length >= 3) {
      const top = parts[0];
      const year = parts[1];
      const faculty = parts[2];
      const prefix = `${top} / ${year} / ${faculty}`;

      const normFaculty = faculty.replace(/\s*\([^)]*[\u0400-\u04FFa-zA-Z0-9']+\)\s*$/i, '').trim();
      const normPrefix = `${top} / ${year} / ${normFaculty}`;

      const canonical = canonicalFaculties.get(normPrefix);
      if (canonical && canonical !== prefix) {
        const remainder = parts.slice(3).join(' / ');
        const newCategory = remainder ? `${canonical} / ${remainder}` : canonical;
        updates.push({ id: q.id, oldCat: q.category, newCat: newCategory });
      }
    }
  }

  console.log(`Found ${updates.length} quizzes to update to canonical categories.`);

  // 2. Apply updates to Turso Cloud using pipeline batches
  if (updates.length > 0) {
    console.log('\n⏳ Updating quizzes in Turso Cloud via pipeline batch...');
    const stmts = updates.map(u => ({
      sql: 'UPDATE quizzes SET category = ? WHERE id = ?',
      params: [u.newCat, u.id],
    }));
    await batchExecute(stmts, 100);
    console.log('\n✅ Turso quizzes updated successfully!');
  }

  // 3. Apply updates to local SQLite (queasy_ready.sqlite)
  const localDbPath = path.join(process.cwd(), 'queasy_ready.sqlite');
  if (fs.existsSync(localDbPath) && updates.length > 0) {
    console.log('\n⏳ Updating quizzes in local queasy_ready.sqlite...');
    const localDb = new DatabaseSync(localDbPath);
    const updateStmt = localDb.prepare('UPDATE quizzes SET category = ? WHERE id = ?');
    localDb.exec('BEGIN TRANSACTION');
    for (const u of updates) {
      updateStmt.run(u.newCat, u.id);
    }
    localDb.exec('COMMIT');
    localDb.close();
    console.log('✅ Local queasy_ready.sqlite quizzes updated successfully!');
  }

  // 4. Rebuild categories table from all active public quizzes
  console.log('\n⏳ Rebuilding categories table from unified quizzes...');
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

  // Naturally sort the remaining categories
  const remaining = Array.from(allCategoryPaths).sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
  );

  let nextId = 7;
  for (const p of remaining) {
    orderedCategories.push({ id: nextId++, path: p });
  }

  console.log(`Total canonical categories built: ${orderedCategories.length}`);

  // 5. Sync categories into Turso Cloud via pipeline batch
  console.log('\n⏳ Syncing categories table in Turso Cloud...');
  await turso.run('DELETE FROM categories');
  const catStmts = orderedCategories.map(c => ({
    sql: 'INSERT INTO categories (id, path) VALUES (?, ?)',
    params: [c.id, c.path],
  }));
  await batchExecute(catStmts, 100);
  console.log('\n✅ Turso categories table synchronized!');

  // 6. Sync categories into local SQLite
  if (fs.existsSync(localDbPath)) {
    console.log('\n⏳ Syncing categories table in local queasy_ready.sqlite...');
    const localDb = new DatabaseSync(localDbPath);
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

  console.log('\n===========================================================');
  console.log('🎉 BARCHA KATEGORIYALAR RASMIY SAYT BILAN TO\'LIQ BIRLASHTIRILDI!');
  console.log(`   ✅ Yangilangan testlar soni: ${updates.length}`);
  console.log(`   ✅ Jami sinxronlashtirilgan kategoriyalar: ${orderedCategories.length}`);
  console.log('===========================================================');
}

main().catch(console.error);
