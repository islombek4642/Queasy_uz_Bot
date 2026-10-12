// scripts/sync_categories_table.mjs
import { resolveToken } from 'file:///C:/Users/Islombek/AppData/Local/npm-cache/_npx/5ffcbfb9bb9c789b/node_modules/@tgcloud/cli/src/core/credentials.js';
import { scanFiles } from 'file:///C:/Users/Islombek/AppData/Local/npm-cache/_npx/5ffcbfb9bb9c789b/node_modules/@tgcloud/cli/src/core/scanner.js';
import { pathToModule } from 'file:///C:/Users/Islombek/AppData/Local/npm-cache/_npx/5ffcbfb9bb9c789b/node_modules/@tgcloud/cli/src/core/snapshot.js';
import { readWd } from 'file:///C:/Users/Islombek/AppData/Local/npm-cache/_npx/5ffcbfb9bb9c789b/node_modules/@tgcloud/cli/src/core/workdir.js';
import { runFunction } from 'file:///C:/Users/Islombek/AppData/Local/npm-cache/_npx/5ffcbfb9bb9c789b/node_modules/@tgcloud/cli/src/api/endpoints.js';

async function run() {
  const token = await resolveToken();
  const allFiles = scanFiles();
  const sources = {};
  for (const f of allFiles) sources[pathToModule(f)] = readWd(f);

  sources['endpoints/sync_categories'] = `
    import { db } from 'sdk';
    import { quizzes, categories } from '../schema.js';
    import { sql } from 'sdk/db';

    export default async function() {
      // 1. Get all distinct category paths from quizzes
      const rows = await db.select({ c: quizzes.category }).from(quizzes).all();
      const allPaths = new Set();

      // Top level
      allPaths.add("KUNDUZGI TA'LIM");
      allPaths.add("SIRTQI TA'LIM");
      allPaths.add("KECHKI TA'LIM");
      allPaths.add("MASOFAVIY TA'LIM");
      allPaths.add("FANLAR FARQI");
      allPaths.add("KUNDUZGI TA'LIM (TIBBIYOT)");

      for (const r of rows) {
        if (!r.c) continue;
        const parts = r.c.split(' / ');
        for (let i = 1; i <= parts.length; i++) {
          allPaths.add(parts.slice(0, i).join(' / '));
        }
      }

      // 2. Insert into categories table (ignore duplicates)
      let inserted = 0;
      for (const p of allPaths) {
        try {
          await db.insert(categories).values({ path: p }).run();
          inserted++;
        } catch {
          // ignore already exists
        }
      }

      const total = await db.select({ count: sql\`count(*)\` }).from(categories).get();
      return { totalCategories: total?.count, newInserted: inserted };
    }
  `;

  const res = await runFunction(token, 'endpoints/sync_categories', sources, {});
  console.log('Sync categories result:', res?.result);
}

run().catch(console.error);
