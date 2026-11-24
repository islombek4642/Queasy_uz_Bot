// tgcloud/endpoints/start_solo_session.js
// Registers an active solo test session in Turso Cloud DB for real-time tracking
import { CONFIG } from '../lib/constants/config.js';
import turso from '../lib/turso_client.js';

export default async function (input, ctx) {
  const userId = ctx?.initData?.user?.id ? Number(ctx.initData.user.id) : (Number(input?.userId) || 0);
  const quizId = parseInt(input?.quizId, 10) || 0;
  const mode = input?.mode || 'full';
  const totalQuestions = parseInt(input?.totalQuestions, 10) || 0;

  if (!userId) {
    return { success: false, error: 'UNAUTHORIZED' };
  }

  if (totalQuestions <= 0) {
    return { success: false, error: 'QUIZ_HAS_NO_QUESTIONS' };
  }

  let sessionId = null;
  if (CONFIG.TURSO?.ENABLED) {
    try {
      // Deactivate any previous abandoned webapp sessions for this user (chat_id = 0)
      await turso.run(
        'UPDATE quiz_sessions SET is_active = 0 WHERE user_id = ? AND chat_id = 0 AND is_active = 1',
        [userId]
      );

      const insRes = await turso.run(
        'INSERT INTO quiz_sessions (quiz_id, chat_id, user_id, is_group, mode, current_index, total_questions, correct_count, wrong_count, is_active, last_poll_sent_at, started_at) VALUES (?, 0, ?, 0, ?, 0, ?, 0, 0, 1, unixepoch(), unixepoch())',
        [quizId, userId, mode, totalQuestions]
      );
      sessionId = insRes?.lastInsertRowid ? Number(insRes.lastInsertRowid) : null;
    } catch (err) {
      console.warn('[start_solo_session] Turso error:', err.message);
    }
  }

  return { success: true, sessionId };
}

