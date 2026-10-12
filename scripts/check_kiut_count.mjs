// scripts/check_kiut_count.mjs
import { resolveToken } from 'file:///C:/Users/Islombek/AppData/Local/npm-cache/_npx/5ffcbfb9bb9c789b/node_modules/@tgcloud/cli/src/core/credentials.js';
import { scanFiles } from 'file:///C:/Users/Islombek/AppData/Local/npm-cache/_npx/5ffcbfb9bb9c789b/node_modules/@tgcloud/cli/src/core/scanner.js';
import { pathToModule } from 'file:///C:/Users/Islombek/AppData/Local/npm-cache/_npx/5ffcbfb9bb9c789b/node_modules/@tgcloud/cli/src/core/snapshot.js';
import { readWd } from 'file:///C:/Users/Islombek/AppData/Local/npm-cache/_npx/5ffcbfb9bb9c789b/node_modules/@tgcloud/cli/src/core/workdir.js';
import { runFunction } from 'file:///C:/Users/Islombek/AppData/Local/npm-cache/_npx/5ffcbfb9bb9c789b/node_modules/@tgcloud/cli/src/api/endpoints.js';

async function main() {
  const token = await resolveToken();
  const allFiles = scanFiles();
  const sources = {};
  for (const f of allFiles) {
    sources[pathToModule(f)] = readWd(f);
  }

  const res = await runFunction(token, 'endpoints/get_kiut_catalog', sources, {});
  console.log('Katalog holati:', JSON.stringify(res?.result, null, 2));
}

main().catch(console.error);
