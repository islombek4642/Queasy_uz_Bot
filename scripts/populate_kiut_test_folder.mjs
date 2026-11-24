import fs from 'node:fs';
import path from 'node:path';

function normalize(str = '') {
  return str.replace(/\\/g, '/').trim().toLowerCase();
}

function walk(dir) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir, { withFileTypes: true });
  for (const item of list) {
    const fullPath = dir + '/' + item.name;
    if (item.isDirectory()) results = results.concat(walk(fullPath));
    else results.push(fullPath);
  }
  return results;
}

async function main() {
  console.log('===========================================================');
  console.log('📂 KIUT_TEST PAPKASINI SAYT STRUKTURASI BO\'YICHA TARTIBLASH');
  console.log('===========================================================\n');

  const siteIndex = JSON.parse(fs.readFileSync('kiut_site_index.json', 'utf8'));
  const sourceDir = 'D:/Serverless/QUIZLARIM/TESTLAR_DOCX';
  const targetBase = path.join(process.cwd(), 'KIUT_TEST');

  console.log(`📡 Sayt indeksi bo'yicha jami testlar: ${siteIndex.length} ta`);
  console.log(`📁 Manba: ${sourceDir}`);
  console.log(`📁 Maqsad: ${targetBase}\n`);

  // Index existing files in QUIZLARIM by relPath and by basename
  console.log('🔍 QUIZLARIM fayllari indekslanmoqda...');
  const allDocx = walk(sourceDir);
  const byRelPath = new Map();
  const byBaseName = new Map();

  for (const f of allDocx) {
    const rel = normalize(f.replace(sourceDir + '/', ''));
    byRelPath.set(rel, f);

    const base = normalize(path.basename(f, '.docx'));
    if (!byBaseName.has(base)) {
      byBaseName.set(base, f);
    }
  }
  console.log(`✅ QUIZLARIM dan ${allDocx.length} ta fayl topildi.\n`);

  let copied = 0;
  let alreadyExists = 0;
  let notFound = [];

  for (let i = 0; i < siteIndex.length; i++) {
    const item = siteIndex[i];
    const targetFile = path.join(targetBase, item.relPath);
    const targetDir = path.dirname(targetFile);

    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    if (fs.existsSync(targetFile)) {
      alreadyExists++;
      continue;
    }

    const relKey = normalize(item.relPath);
    const baseKey = normalize(item.title);

    let src = byRelPath.get(relKey) || byBaseName.get(baseKey);

    // Fallback: search with cleaned underscores / spaces
    if (!src) {
      const cleanBase = baseKey.replace(/_/g, ' ');
      for (const [k, v] of byBaseName.entries()) {
        if (k.replace(/_/g, ' ') === cleanBase) {
          src = v;
          break;
        }
      }
    }

    if (src && fs.existsSync(src)) {
      fs.copyFileSync(src, targetFile);
      copied++;
    } else {
      notFound.push(item);
    }

    if ((i + 1) % 500 === 0 || i === siteIndex.length - 1) {
      process.stdout.write(`   ├── ${i + 1} / ${siteIndex.length} test ko'chirildi...\r`);
    }
  }

  console.log('\n\n===========================================================');
  console.log('📊 NATIJA:');
  console.log(`   ✅ Yangi nusxalangan fayllar: ${copied} ta`);
  console.log(`   ⚡ Allaqachon mavjud bo'lganlar: ${alreadyExists} ta`);
  console.log(`   ❌ Topilmagan fayllar: ${notFound.length} ta`);
  console.log(`   🎯 KIUT_TEST papkasidagi jami testlar: ${copied + alreadyExists} / ${siteIndex.length}`);
  console.log('===========================================================');

  if (notFound.length > 0) {
    console.log('\nTopilmagan testlar namunalari:');
    notFound.slice(0, 10).forEach((t, idx) => console.log(`   ${idx + 1}. [${t.form}] ${t.relPath}`));
  }
}

main().catch(console.error);

