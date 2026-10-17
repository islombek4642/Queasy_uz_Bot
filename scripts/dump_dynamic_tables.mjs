import fs from 'fs';
import path from 'path';
import { resolveToken } from 'file:///C:/Users/Islombek/AppData/Local/npm-cache/_npx/5ffcbfb9bb9c789b/node_modules/@tgcloud/cli/src/core/credentials.js';
import { scanFiles } from 'file:///C:/Users/Islombek/AppData/Local/npm-cache/_npx/5ffcbfb9bb9c789b/node_modules/@tgcloud/cli/src/core/scanner.js';
import { pathToModule } from 'file:///C:/Users/Islombek/AppData/Local/npm-cache/_npx/5ffcbfb9bb9c789b/node_modules/@tgcloud/cli/src/core/snapshot.js';
import { readWd } from 'file:///C:/Users/Islombek/AppData/Local/npm-cache/_npx/5ffcbfb9bb9c789b/node_modules/@tgcloud/cli/src/core/workdir.js';
import { runFunction } from 'file:///C:/Users/Islombek/AppData/Local/npm-cache/_npx/5ffcbfb9bb9c789b/node_modules/@tgcloud/cli/src/api/endpoints.js';

async function main() {
  const token = await resolveToken();
  const allFiles = scanFiles();
  const sources = {};
  for (const f of allFiles) sources[pathToModule(f)] = readWd(f);

  const tablesToDump = [
    'users',
    'groups',
    'quizzes',
    'categories',
    'userMistakes',
    'quizSessions',
    'groupAnswers',
    'groupTournaments',
    'tournamentParticipants',
    'liveRooms',
    'roomPlayers',
    'groupLobbies',
    'userStates',
    'botSettings'
  ];

  const dumpDir = path.join(process.cwd(), 'scratch', 'tg_dump');
  if (!fs.existsSync(dumpDir)) fs.mkdirSync(dumpDir, { recursive: true });

  for (const tbl of tablesToDump) {
    console.log(`Dumping ${tbl}...`);
    sources['endpoints/dump_tbl'] = `
      import { db } from 'sdk';
      import * as schema from '../schema.js';
      export default async function() {
        return await db.select().from(schema['${tbl}']).all();
      }
    `;
    try {
      const res = await runFunction(token, 'endpoints/dump_tbl', sources, {});
      if (res?.result && Array.isArray(res.result)) {
        fs.writeFileSync(path.join(dumpDir, `${tbl}.json`), JSON.stringify(res.result, null, 2));
        console.log(`  ✓ ${tbl}: ${res.result.length} rows saved.`);
      } else {
        console.error(`  ✗ ${tbl}:`, res?.result || res);
      }
    } catch (e) {
      console.error(`  ✗ ${tbl} error:`, e.message);
    }
  }

  console.log('Done dumping dynamic tables!');
}

main().catch(console.error);
