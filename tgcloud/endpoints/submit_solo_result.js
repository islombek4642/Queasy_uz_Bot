// tgcloud/endpoints/submit_solo_result.js
import { db } from 'sdk';
import { eq, and } from 'sdk/db';
import { quizSessions, userMistakes } from '../schema.js';

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

  // 1. Record session in quizSessions
  const res = await db.insert(quizSessions).values({
    quizId: isMistakesMode ? 0 : quizId,
    chatId: userId,
    userId,
    isGroup: false,
    mode: isMistakesMode ? 'mistakes' : 'full',
    currentIndex: totalQuestions,
    totalQuestions,
    correctCount,
    wrongCount,
    isActive: false,
  }).run();

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
    sessionId: res?.lastInsertRowid || null,
    resolvedCount,
    addedMistakesCount,
  };
}
