// tgcloud/endpoints/submit_solo_result.js
import { db } from 'sdk';
import { eq, and } from 'sdk/db';
import { quizSessions, userMistakes } from '../schema.js';
import { CONFIG } from '../lib/constants/config.js';
import turso from '../lib/turso_client.js';

export default async function (input, ctx) {
  const tgUser = ctx?.initData?.user;
  const userId = tgUser?.id || 0;
  const isMistakesMode = Boolean(input?.isMistakesMode);
  const quizId = parseInt(input?.quizId, 10) || 0;
  const correctCount = parseInt(input?.correctCount, 10) || 0;
  const wrongCount = parseInt(input?.wrongCount, 10) || 0;
  const totalQuestions = correctCount + wrongCount;

  if (totalQuestions === 0) {
    return { success: false, error: 'NO_QUESTIONS' };
  }

  if (!isMistakesMode && !quizId) {
    return { success: false, error: 'INVALID_QUIZ_ID' };
  }

  let tursoSessionId = null;
  if (CONFIG.TURSO?.ENABLED) {
    try {
      const mode = isMistakesMode ? 'mistakes' : (input?.mode || 'full');
      const insRes = await turso.run(
        'INSERT INTO quiz_sessions (quiz_id, chat_id, user_id, is_group, mode, current_index, total_questions, correct_count, wrong_count, is_active, started_at) VALUES (?, ?, ?, 0, ?, ?, ?, ?, ?, 0, unixepoch())',
        [isMistakesMode ? 0 : quizId, userId, userId, mode, totalQuestions, totalQuestions, correctCount, wrongCount]
      );
      tursoSessionId = insRes?.lastInsertRowid || null;

      if (Array.isArray(input?.resolvedMistakeIds) && input.resolvedMistakeIds.length > 0 && userId) {
        for (const mId of input.resolvedMistakeIds) {
          const numId = parseInt(mId, 10);
          if (numId) {
            await turso.run('DELETE FROM user_mistakes WHERE id = ? AND user_id = ?', [numId, userId]);
          }
        }
      }

      if (Array.isArray(input?.failedQuestions) && input.failedQuestions.length > 0 && userId) {
        for (const fq of input.failedQuestions) {
          if (!fq?.questionText) continue;
          const qText = String(fq.questionText).trim();
          const existing = await turso.get(
            'SELECT id FROM user_mistakes WHERE user_id = ? AND question_text = ?',
            [userId, qText]
          );
          if (existing) continue;
          await turso.run(
            'INSERT INTO user_mistakes (user_id, question_text, options_json, correct_option_id, explanation, original_quiz_id, created_at) VALUES (?, ?, ?, ?, ?, ?, unixepoch())',
            [userId, qText, JSON.stringify(fq.options || []), Number(fq.correctOptionId) || 0, fq.explanation || null, quizId || fq.originalQuizId || null]
          );
        }
      }
    } catch (err) {
      console.warn('[submit_solo_result] Turso dual-write fallback:', err.message);
    }
  }

  // 1. Record session in quizSessions (local db backup)
  let res = null;
  try {
    res = await db.insert(quizSessions).values({
      quizId: isMistakesMode ? 0 : quizId,
      chatId: userId,
      userId,
      isGroup: false,
      mode: isMistakesMode ? 'mistakes' : (input?.mode || 'full'),
      currentIndex: totalQuestions,
      totalQuestions,
      correctCount,
      wrongCount,
      isActive: false,
    }).run();
  } catch {}

  let resolvedCount = 0;
  let addedMistakesCount = 0;

  // 2. If in mistakes mode and resolvedMistakeIds were passed, remove them from userMistakes
  if (Array.isArray(input?.resolvedMistakeIds) && input.resolvedMistakeIds.length > 0 && userId) {
    try {
      for (const mId of input.resolvedMistakeIds) {
        const numId = parseInt(mId, 10);
        if (!numId) continue;
        await db.delete(userMistakes).where(and(eq(userMistakes.id, numId), eq(userMistakes.userId, userId))).run();
        resolvedCount++;
      }
    } catch (e) {
      console.error('Failed to delete resolved mistakes:', e);
    }
  }

  // 3. If wrong questions were sent (from regular or mistakes quiz), record into userMistakes with deduplication
  if (Array.isArray(input?.failedQuestions) && input.failedQuestions.length > 0 && userId) {
    try {
      for (const fq of input.failedQuestions) {
        if (!fq?.questionText) continue;
        const qText = String(fq.questionText).trim();

        // Deduplication check: check if this user already has this question in userMistakes
        const existing = await db
          .select({ id: userMistakes.id })
          .from(userMistakes)
          .where(and(eq(userMistakes.userId, userId), eq(userMistakes.questionText, qText)))
          .get();

        if (existing) continue;

        await db.insert(userMistakes).values({
          userId,
          questionText: qText,
          optionsJson: JSON.stringify(fq.options || []),
          correctOptionId: Number(fq.correctOptionId) || 0,
          explanation: fq.explanation || null,
          originalQuizId: quizId || fq.originalQuizId || null,
        }).run();
        addedMistakesCount++;
      }
    } catch (e) {
      console.error('Failed to log userMistakes:', e);
    }
  }

  return {
    success: true,
    sessionId: tursoSessionId || (res?.lastInsertRowid ? Number(res.lastInsertRowid) : null),
    resolvedCount,
    addedMistakesCount,
  };
}
