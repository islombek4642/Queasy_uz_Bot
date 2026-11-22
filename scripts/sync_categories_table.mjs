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
    import { invalidateKiutCatalogCache, loadKiutTree } from '../lib/services/kiut_catalog_service.js';

    export default async function() {
      invalidateKiutCatalogCache();
      const tree = await loadKiutTree();
      return { 
        success: true, 
        categoriesLoaded: tree.categories.length,
        kunduzgiSubCategories: Array.from(tree.categoriesByPath.keys()).filter(k => k.startsWith("KUNDUZGI TA'LIM / ") && !k.slice("KUNDUZGI TA'LIM / ".length).includes(' / '))
      };
    }
  `;

  const res = await runFunction(token, 'endpoints/sync_categories', sources, {});
  console.log('TGCloud Invalidation result:', res?.result);
}

run().catch(console.error);
