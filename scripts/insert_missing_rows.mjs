import fs from 'fs';
import path from 'path';
import { DatabaseSync } from 'node:sqlite';
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

  sources['endpoints/dump_exact'] = `
    import { db } from 'sdk';
    import { sql } from 'sdk/db';
    export default async function() {
      const res = {};
      try {
        res.tourParts = await db.all(sql\`SELECT id, tournament_id, user_id, user_name, user_avatar, score, total_questions, total_time_seconds, finished_at FROM tournament_participants\`);
      } catch (e) { res.tourErr = e.message; }
      try {
        res.states = await db.all(sql\`SELECT user_id, state, context_data_json, updated_at FROM user_states\`);
      } catch (e) { res.statesErr = e.message; }
      try {
        // Fetch active quiz sessions
        res.sessions = await db.all(sql\`SELECT id, quiz_id, chat_id, user_id, is_group, mode, current_index, total_questions, correct_count, wrong_count, is_active, last_poll_id, last_poll_msg_id, last_poll_sent_at, started_at FROM quiz_sessions WHERE is_active = 1\`);
      } catch (e) { res.sessErr = e.message; }
      return res;
    }
  `;

  console.log('Fetching remaining table rows from TGCloud...');
  const res = await runFunction(token, 'endpoints/dump_exact', sources, {});
  const data = res?.result || {};
  console.log('Got:', {
    tourPartsCount: data.tourParts?.length,
    statesCount: data.states?.length,
    sessionsCount: data.sessions?.length,
    tourErr: data.tourErr,
    statesErr: data.statesErr,
    sessErr: data.sessErr
  });

  const db = new DatabaseSync('d:/Serverless/Queasy_uz_Bot/queasy_ready.sqlite');

  if (Array.isArray(data.tourParts) && data.tourParts.length > 0) {
    const ins = db.prepare('INSERT OR REPLACE INTO tournament_participants (id, tournament_id, user_id, user_name, user_avatar, score, total_questions, total_time_seconds, finished_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
    db.exec('BEGIN TRANSACTION;');
    for (const p of data.tourParts) {
      ins.run(p.id, p.tournament_id, p.user_id, p.user_name, p.user_avatar || null, p.score || 0, p.total_questions || 0, p.total_time_seconds || 0, p.finished_at || null);
    }
    db.exec('COMMIT;');
    console.log(`✓ Inserted ${data.tourParts.length} tournament participants.`);
  }

  if (Array.isArray(data.states) && data.states.length > 0) {
    const ins = db.prepare('INSERT OR REPLACE INTO user_states (user_id, state, context_data_json, updated_at) VALUES (?, ?, ?, ?)');
    db.exec('BEGIN TRANSACTION;');
    for (const s of data.states) {
      ins.run(s.user_id, s.state, s.context_data_json || null, s.updated_at || null);
    }
    db.exec('COMMIT;');
    console.log(`✓ Inserted ${data.states.length} user states.`);
  }

  if (Array.isArray(data.sessions) && data.sessions.length > 0) {
    const ins = db.prepare('INSERT OR REPLACE INTO quiz_sessions (id, quiz_id, chat_id, user_id, is_group, mode, current_index, total_questions, correct_count, wrong_count, is_active, last_poll_id, last_poll_msg_id, last_poll_sent_at, started_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    db.exec('BEGIN TRANSACTION;');
    for (const s of data.sessions) {
      ins.run(s.id, s.quiz_id, s.chat_id, s.user_id, s.is_group ? 1 : 0, s.mode || 'full', s.current_index || 0, s.total_questions || 0, s.correct_count || 0, s.wrong_count || 0, s.is_active ? 1 : 0, s.last_poll_id || null, s.last_poll_msg_id || null, s.last_poll_sent_at || null, s.started_at || null);
    }
    db.exec('COMMIT;');
    console.log(`✓ Inserted ${data.sessions.length} active quiz sessions.`);
  }

  db.exec('PRAGMA wal_checkpoint(TRUNCATE);');
  db.exec('PRAGMA journal_mode = DELETE;');
  db.close();
  console.log('Done updating queasy_ready.sqlite!');
}

main().catch(console.error);
