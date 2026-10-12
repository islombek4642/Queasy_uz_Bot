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
  sources['endpoints/create_indexes'] = `
    import { db } from 'sdk';
    import { sql } from 'sdk/db';
    export default async function() {
      await db.run(sql\`CREATE INDEX IF NOT EXISTS idx_questions_quiz_id ON questions (quiz_id);\`);
      await db.run(sql\`CREATE INDEX IF NOT EXISTS idx_quizzes_category ON quizzes (category);\`);
      await db.run(sql\`CREATE INDEX IF NOT EXISTS idx_quizzes_owner_id ON quizzes (owner_id);\`);
      await db.run(sql\`CREATE INDEX IF NOT EXISTS idx_quizzes_is_public ON quizzes (is_public);\`);
      return { success: true, message: 'Indexes created successfully!' };
    }
  `;
  const res = await runFunction(token, 'endpoints/create_indexes', sources, {});
  console.log('Index natijasi:', res?.result);
}
run();
