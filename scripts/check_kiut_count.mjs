// scripts/check_kiut_count.mjs
// Checks KIUT catalog counts and status across cloud and local definitions
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

async function main() {
  console.log('🔍 Checking KIUT catalog status...');

  // 1. Check local site index if present
  const indexFile = path.join(process.cwd(), 'kiut_site_index.json');
  if (fs.existsSync(indexFile)) {
    try {
      const items = JSON.parse(fs.readFileSync(indexFile, 'utf8'));
      console.log(`📡 Mahalliy sayt indeksi (kiut_site_index.json): ${items.length} ta test mavjud.`);
    } catch {}
  }

  // 2. Run tgcloud endpoint if bot is linked
  const res = spawnSync('npx', ['--yes', '@tgcloud/cli', 'run', 'endpoints/get_kiut_catalog', "'{}'"], {
    encoding: 'utf8',
    shell: true,
  });

  if (res.stdout && res.stdout.includes('totalQuizzes')) {
    console.log('✅ TgCloud natijasi:');
    console.log(res.stdout);
  } else if (res.stderr) {
    console.log('ℹ️ TgCloud ma\'lumotlari:', res.stderr.trim());
  } else {
    console.log('ℹ️ Natija:', res.stdout ? res.stdout.trim() : 'Bo\'sh');
  }
}

main().catch(console.error);
