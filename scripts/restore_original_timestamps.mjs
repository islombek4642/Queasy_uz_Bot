import { resolveToken } from 'file:///C:/Users/Islombek/AppData/Local/npm-cache/_npx/5ffcbfb9bb9c789b/node_modules/@tgcloud/cli/src/core/credentials.js';
import { scanFiles } from 'file:///C:/Users/Islombek/AppData/Local/npm-cache/_npx/5ffcbfb9bb9c789b/node_modules/@tgcloud/cli/src/core/scanner.js';
import { pathToModule } from 'file:///C:/Users/Islombek/AppData/Local/npm-cache/_npx/5ffcbfb9bb9c789b/node_modules/@tgcloud/cli/src/core/snapshot.js';
import { readWd } from 'file:///C:/Users/Islombek/AppData/Local/npm-cache/_npx/5ffcbfb9bb9c789b/node_modules/@tgcloud/cli/src/core/workdir.js';
import { runFunction } from 'file:///C:/Users/Islombek/AppData/Local/npm-cache/_npx/5ffcbfb9bb9c789b/node_modules/@tgcloud/cli/src/api/endpoints.js';
import turso from '../tgcloud/lib/turso_client.js';

async function dumpOriginalData() {
  const token = await resolveToken();
  const allFiles = scanFiles();
  const sources = {};
  for (const f of allFiles) sources[pathToModule(f)] = readWd(f);

  sources['endpoints/dump_raw_all'] = `
    import { db } from 'sdk';
    import { sql } from 'sdk/db';
    export default async function() {
      const users = await db.all(sql\`
        SELECT telegram_id, CAST(created_at AS INTEGER) AS created_at, CAST(last_active_at AS INTEGER) AS last_active_at
        FROM users
      \`);
      const groups = await db.all(sql\`
        SELECT group_id, CAST(created_at AS INTEGER) AS created_at
        FROM "groups"
      \`);
      const quizzes = await db.all(sql\`
        SELECT id, CAST(created_at AS INTEGER) AS created_at
        FROM quizzes
        WHERE owner_id > 0
      \`);
      return { users, groups, quizzes };
    }
  `;

  const res = await runFunction(token, 'endpoints/dump_raw_all', sources, {});
  return res?.result;
}

async function restore() {
  console.log('🔄 Fetching original timestamps from tgcloud SQLite...');
  const data = await dumpOriginalData();

  if (!data || !data.users || data.users.length === 0) {
    throw new Error('Failed to fetch original timestamps from tgcloud');
  }

  console.log(`✓ Fetched ${data.users.length} users, ${data.groups.length} groups, ${data.quizzes.length} user quizzes.\n`);

  // 1. Restore Users
  console.log(`Updating ${data.users.length} users in Turso...`);
  let updatedUsers = 0;
  for (const u of data.users) {
    if (!u.created_at) continue;
    // We update created_at to the original time, and last_active_at if it was null or older
    await turso.run(`
      UPDATE users 
      SET created_at = ?,
          last_active_at = CASE 
            WHEN last_active_at IS NULL OR last_active_at = 0 THEN ? 
            ELSE MAX(last_active_at, COALESCE(?, 0)) 
          END
      WHERE telegram_id = ?
    `, [u.created_at, u.last_active_at || null, u.last_active_at || 0, u.telegram_id]);
    updatedUsers++;
  }
  console.log(`✓ Restored ${updatedUsers} users in Turso.`);

  // 2. Restore Groups
  console.log(`Updating ${data.groups.length} groups in Turso...`);
  let updatedGroups = 0;
  for (const g of data.groups) {
    if (!g.created_at) continue;
    await turso.run(`
      UPDATE "groups"
      SET created_at = ?
      WHERE group_id = ?
    `, [g.created_at, g.group_id]);
    updatedGroups++;
  }
  console.log(`✓ Restored ${updatedGroups} groups in Turso.`);

  // 3. Restore Quizzes
  console.log(`Updating ${data.quizzes.length} user quizzes in Turso...`);
  let updatedQuizzes = 0;
  for (const q of data.quizzes) {
    if (!q.created_at) continue;
    await turso.run(`
      UPDATE quizzes
      SET created_at = ?
      WHERE id = ?
    `, [q.created_at, q.id]);
    updatedQuizzes++;
  }
  console.log(`✓ Restored ${updatedQuizzes} user quizzes in Turso.\n`);

  // Verification
  console.log('🔍 Verifying Turso database statistics:');
  const userStats = await turso.all('SELECT count(*) as total, count(distinct created_at) as distinct_created_at, min(created_at) as earliest, max(created_at) as latest FROM users');
  console.log('Users in Turso:', userStats[0]);

  const sampleUsers = await turso.all('SELECT telegram_id, first_name, username, created_at, last_active_at FROM users WHERE telegram_id IN (109558320, 218764895, 365446274, 470757579) ORDER BY created_at ASC');
  console.log('\nSample restored users:');
  for (const su of sampleUsers) {
    const regDate = new Date(su.created_at * 1000).toLocaleString('uz-UZ', { timeZone: 'Asia/Tashkent' });
    console.log(`- ${su.first_name || ''} (@${su.username || 'yoq'}): ${regDate} (timestamp: ${su.created_at})`);
  }
}

restore().catch(console.error);
