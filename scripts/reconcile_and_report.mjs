// scripts/reconcile_and_report.mjs
// Reconciles kiut-nm-test.uz catalog against database and checks test integrity
import fs from 'node:fs';
import path from 'node:path';
import { TURSO_TOKEN } from '../tgcloud/lib/constants/secrets.js';

const SITE_INDEX_FILE = fs.existsSync(path.join(process.cwd(), 'kiut_site_index.json'))
  ? path.join(process.cwd(), 'kiut_site_index.json')
  : path.join(process.cwd(), 'scratch/kiut_site_index.json');
const MISSING_FILE = path.join(process.cwd(), 'scratch/missing_in_turso.json');
const TURSO_URL = 'https://queasy-db-xamidullayev-i.aws-eu-north-1.turso.io';

async function tursoQuery(sql, args = []) {
  if (!TURSO_TOKEN) return null;
  try {
    const res = await fetch(`${TURSO_URL}/v2/pipeline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${TURSO_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: [
          { type: 'execute', stmt: { sql, args } },
          { type: 'close' },
        ],
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.results?.[0]?.response?.result?.rows || [];
  } catch {
    return null;
  }
}

async function main() {
  console.log('===========================================================');
  console.log('🔍 KIUT TESTLARINI TO\'LIQ SOLISHTIRISH VA TAHLIL QILISH');
  console.log('===========================================================\n');

  if (!fs.existsSync(SITE_INDEX_FILE)) {
    console.error(`❌ Sayt indeksi fayli topilmadi: ${SITE_INDEX_FILE}`);
    process.exit(1);
  }

  const siteItems = JSON.parse(fs.readFileSync(SITE_INDEX_FILE, 'utf-8'));
  console.log(`📡 Saytdagi jami testlar soni (/api/index): ${siteItems.length} ta\n`);

  // Ensure scratch directory and missing_in_turso.json exist
  if (!fs.existsSync(path.dirname(MISSING_FILE))) {
    fs.mkdirSync(path.dirname(MISSING_FILE), { recursive: true });
  }
  if (!fs.existsSync(MISSING_FILE)) {
    fs.writeFileSync(MISSING_FILE, JSON.stringify(siteItems, null, 2));
    console.log(`✅ ${MISSING_FILE} fayli ${siteItems.length} ta test bilan tayyorlandi.`);
  }

  // 1. Group by top-level education form and detailed departments
  const formsMap = new Map();
  for (const item of siteItems) {
    const form = item.form || (item.pathParts ? item.pathParts[0] : "Boshqa");
    if (!formsMap.has(form)) {
      formsMap.set(form, {
        total: 0,
        intakes: new Map(),
        departments: new Map(),
      });
    }
    const formData = formsMap.get(form);
    formData.total++;

    const intake = item.pathParts?.[1] || 'Nomaʼlum';
    formData.intakes.set(intake, (formData.intakes.get(intake) || 0) + 1);

    const dept = item.pathParts?.[2] || 'Umumiy';
    formData.departments.set(dept, (formData.departments.get(dept) || 0) + 1);
  }

  console.log('📊 1. Ta\'lim shakllari va bo\'limlar bo\'yicha sayt testlari taqsimoti:');
  console.log('-----------------------------------------------------------');
  let formIndex = 1;
  for (const [form, data] of formsMap.entries()) {
    console.log(`\n${formIndex++}. ${form}: ${data.total} ta test`);
    console.log(`   📌 O'quv yillari / Qabullar:`);
    for (const [intake, count] of data.intakes.entries()) {
      console.log(`      ├── ${intake}: ${count} ta test`);
    }
    console.log(`   🏛️ Bo'limlar / Fakultetlar (${data.departments.size} ta):`);
    let dIdx = 0;
    for (const [dept, count] of data.departments.entries()) {
      if (++dIdx <= 5 || data.departments.size <= 8) {
        console.log(`      ├── ${dept}: ${count} ta`);
      } else if (dIdx === 6) {
        console.log(`      ├── ... va yana ${data.departments.size - 5} ta yo'nalish`);
        break;
      }
    }
  }

  // 2. Local SQLite check if available
  const localDbPath = path.join(process.cwd(), 'queasy_ready.sqlite');
  console.log('\n📊 2. Mahalliy SQLite bazasi (queasy_ready.sqlite):');
  console.log('-----------------------------------------------------------');
  if (fs.existsSync(localDbPath)) {
    try {
      const { DatabaseSync } = await import('node:sqlite');
      const ldb = new DatabaseSync(localDbPath);
      const qzCount = ldb.prepare('SELECT count(*) as count FROM quizzes').get()?.count || 0;
      const qstCount = ldb.prepare('SELECT count(*) as count FROM questions').get()?.count || 0;
      const zeroCount = ldb.prepare('SELECT count(*) as count FROM quizzes q WHERE (SELECT count(*) FROM questions WHERE quiz_id = q.id) = 0').get()?.count || 0;
      console.log(`✅ Mahalliy bazada: ${qzCount} ta test, ${qstCount} ta savol mavjud.`);
      console.log(`⚠️ Savoli 0 ta bo'lgan testlar: ${zeroCount} ta`);
    } catch (err) {
      console.log('ℹ️ Mahalliy bazani ochishda xato:', err.message);
    }
  } else {
    console.log('ℹ️ Mahalliy queasy_ready.sqlite mavjud emas (asosiy baza Turso Cloud da).');
  }

  // 3. Query Turso database if available
  console.log('\n📊 3. Bulutli ma\'lumotlar bazasi (Turso Cloud):');
  console.log('-----------------------------------------------------------');

  if (!TURSO_TOKEN) {
    console.log('ℹ️ TURSO_TOKEN aniqlanmadi (process.env.TURSO_TOKEN bo\'sh).');
    console.log('   Ma\'lumotlar bazasi tekshiruvi server muhitida yoki token kiritilganda ishlaydi.');
  } else {
    const quizRows = await tursoQuery(`
      SELECT q.id, q.title, q.category, count(qst.id) as question_count
      FROM quizzes q
      LEFT JOIN questions qst ON qst.quiz_id = q.id
      GROUP BY q.id
    `);

    if (quizRows) {
      console.log(`✅ Bazadagi jami testlar: ${quizRows.length} ta`);

      const emptyQuizzes = [];
      const validQuizzes = [];
      const dbCategoriesMap = new Map();

      for (const r of quizRows) {
        const id = Number(r[0].value);
        const title = r[1].value;
        const category = r[2].value || '';
        const qCount = Number(r[3]?.value || 0);

        const topForm = category.split(' / ')[0].trim();
        dbCategoriesMap.set(topForm, (dbCategoriesMap.get(topForm) || 0) + 1);

        if (qCount === 0) {
          emptyQuizzes.push({ id, title, category });
        } else {
          validQuizzes.push({ id, title, category, qCount });
        }
      }

      console.log(`✅ Savoli mavjud to'liq testlar: ${validQuizzes.length} ta`);
      console.log(`⚠️ Savoli 0 ta bo'lgan testlar: ${emptyQuizzes.length} ta`);

      if (emptyQuizzes.length > 0) {
        console.log('\n⚠️ Savoli 0 ta bo\'lgan dastlabki testlar:');
        for (const eq of emptyQuizzes.slice(0, 10)) {
          console.log(`   - ID #${eq.id}: "${eq.title}" (${eq.category})`);
        }
      }

      console.log('\nTa\'lim shakllari bo\'yicha bazadagi testlar soni:');
      for (const [form, count] of dbCategoriesMap.entries()) {
        const siteCount = formsMap.get(form)?.total || 0;
        console.log(`   - ${form}: Baza: ${count} ta | Sayt: ${siteCount} ta`);
      }
    } else {
      console.log('⚠️ Turso Cloud ga ulanishda xatolik (HTTP 401 yoki tarmoq xatosi).');
    }
  }

  console.log('\n===========================================================');
  console.log('✅ Solishtirish va tahlil yakunlandi.');
  console.log('===========================================================');
}

main().catch(console.error);
