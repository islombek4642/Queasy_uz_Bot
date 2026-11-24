// scripts/dump_dynamic_tables.mjs
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

function findTgcloudCliSrc() {
  const userProfile = process.env.USERPROFILE || process.env.HOME || '';
  const npxDir = path.join(userProfile, 'AppData', 'Local', 'npm-cache', '_npx');
  if (fs.existsSync(npxDir)) {
    const hashes = fs.readdirSync(npxDir);
    for (const h of hashes) {
      const srcPath = path.join(npxDir, h, 'node_modules', '@tgcloud', 'cli', 'src');
      if (fs.existsSync(srcPath)) {
        return srcPath;
      }
    }
  }
  return null;
}

async function main() {
  const cliSrc = findTgcloudCliSrc();
  if (!cliSrc) {
    console.error('❌ @tgcloud/cli npm keshidan topilmadi. Avval "npx @tgcloud/cli --help" ni ishga tushiring.');
    process.exit(1);
  }

  const { resolveToken } = await import(pathToFileURL(path.join(cliSrc, 'core', 'credentials.js')).href);
  const { scanFiles } = await import(pathToFileURL(path.join(cliSrc, 'core', 'scanner.js')).href);
  const { pathToModule } = await import(pathToFileURL(path.join(cliSrc, 'core', 'snapshot.js')).href);
  const { readWd } = await import(pathToFileURL(path.join(cliSrc, 'core', 'workdir.js')).href);
  const { runFunction } = await import(pathToFileURL(path.join(cliSrc, 'api', 'endpoints.js')).href);

  let token;
  try {
    token = await resolveToken();
  } catch (err) {
    console.warn('⚠️ Token aniqlanmadi:', err.message);
    return;
  }

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
