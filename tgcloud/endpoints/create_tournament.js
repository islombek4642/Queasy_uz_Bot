// tgcloud/endpoints/create_tournament.js
import { db } from 'sdk';
import { eq } from 'sdk/db';
import { groupTournaments, quizzes, questions, botSettings } from '../schema.js';
import { CONFIG } from '../lib/constants/config.js';
import { ERRORS } from '../lib/constants/errors.js';
import { getMessage } from '../lib/constants/messages.js';

import turso from '../lib/turso_client.js';

export default async function (input, ctx) {
  const tgUser = ctx?.initData?.user;
  const currentUserId = Number(tgUser?.id) || 0;

  if (!currentUserId) {
    return { success: false, error: ERRORS.UNAUTHORIZED };
  }

  const quizId = parseInt(input?.quizId, 10) || 0;

  if (!quizId) {
    return { success: false, error: ERRORS.INVALID_QUIZ_ID };
  }

  // 1. Fetch quiz
  let quiz = null;
  let qCount = 0;

  if (CONFIG.TURSO?.ENABLED) {
    try {
      quiz = await turso.get('SELECT id, title, description, time_limit as timeLimit FROM quizzes WHERE id = ?', [quizId]);
      if (quiz) {
        const cRow = await turso.get('SELECT count(*) as count FROM questions WHERE quiz_id = ?', [quizId]);
        qCount = Number(cRow?.count || 0);
      }
    } catch (err) {
      console.warn('[create_tournament] Turso fetch fallback:', err.message);
    }
  }

  if (!quiz) {
    quiz = await db.select({
      id: quizzes.id,
      title: quizzes.title,
      description: quizzes.description,
      timeLimit: quizzes.timeLimit,
    }).from(quizzes).where(eq(quizzes.id, quizId)).get();

    if (quiz) {
      qCount = await db.$count(questions, eq(questions.quizId, quizId));
    }
  }

  if (!quiz) {
    return { success: false, error: ERRORS.QUIZ_NOT_FOUND };
  }

  if (!qCount || qCount === 0) {
    return { success: false, error: ERRORS.QUIZ_HAS_NO_QUESTIONS };
  }

  // 2. Generate unique shareCode
  const randSuffix = Math.random().toString(36).substring(2, 8);
  const shareCode = `gt_${quizId}_${randSuffix}`;

  // 3. Process modeConfig if set by host
  const modeConfig = input?.modeConfig;
  let actualQCount = qCount;
  if (modeConfig && typeof modeConfig === 'object') {
    if (modeConfig.mode === 'random' && modeConfig.randomCount) {
      actualQCount = Math.min(qCount, Math.max(1, Number(modeConfig.randomCount) || 10));
    } else if (modeConfig.mode === 'range' && Array.isArray(modeConfig.range) && modeConfig.range.length === 2) {
      const s = Math.max(1, Math.min(Number(modeConfig.range[0]) || 1, qCount));
      const e = Math.max(s, Math.min(Number(modeConfig.range[1]) || qCount, qCount));
      actualQCount = e - s + 1;
    }

    if (CONFIG.TURSO?.ENABLED) {
      try {
        await turso.run(
          'INSERT INTO bot_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
          [`tournament_cfg:${shareCode}`, JSON.stringify(modeConfig)]
        );
      } catch (err) {
        console.warn('[create_tournament] Turso botSettings insert fallback:', err.message);
      }
    }

    try {
      await db
        .insert(botSettings)
        .values({
          key: `tournament_cfg:${shareCode}`,
          value: JSON.stringify(modeConfig),
        })
        .onConflictDoUpdate({
          target: botSettings.key,
          set: { value: JSON.stringify(modeConfig) },
        })
        .run();
    } catch {}
  }

  // 4. Insert into groupTournaments (Turso & local db)
  let tursoTourId = null;
  if (CONFIG.TURSO?.ENABLED) {
    try {
      const insRes = await turso.run(
        'INSERT INTO group_tournaments (quiz_id, creator_id, title, share_code, is_active, created_at) VALUES (?, ?, ?, ?, 1, unixepoch())',
        [quizId, currentUserId, quiz.title, shareCode]
      );
      tursoTourId = insRes?.lastInsertRowid || null;
    } catch (err) {
      console.warn('[create_tournament] Turso groupTournaments insert fallback:', err.message);
    }
  }

  let insertRes = null;
  try {
    insertRes = await db.insert(groupTournaments).values({
      quizId,
      creatorId: currentUserId,
      title: quiz.title,
      shareCode,
      isActive: true,
    }).run();
  } catch {}

  const tournamentId = tursoTourId || (insertRes?.lastInsertRowid ? Number(insertRes.lastInsertRowid) : null);

  const botUsername = CONFIG.BOT.USERNAME;
  const shareLink = `https://t.me/${botUsername}/app?startapp=${shareCode}`;
  const shareText = getMessage('TOURNAMENT_INVITE_TEXT', 'UZ', { title: quiz.title, count: actualQCount });
  const telegramShareUrl = `https://t.me/share/url?url=${encodeURIComponent(shareLink)}&text=${encodeURIComponent(shareText)}`;

  return {
    success: true,
    tournamentId,
    shareCode,
    shareLink,
    telegramShareUrl,
    title: quiz.title,
    questionCount: actualQCount,
    modeConfig: modeConfig || null,
  };
}
