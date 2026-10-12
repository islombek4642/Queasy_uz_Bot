// tgcloud/endpoints/submit_solo_result.js
import { db } from 'sdk';
import { quizSessions } from '../schema.js';

export default async function (input, ctx) {
  const tgUser = ctx?.initData?.user;
  const userId = tgUser?.id || 0;
  const quizId = parseInt(input?.quizId, 10);
  const correctCount = parseInt(input?.correctCount, 10) || 0;
  const wrongCount = parseInt(input?.wrongCount, 10) || 0;
  const totalQuestions = correctCount + wrongCount;

  if (!quizId || totalQuestions === 0) {
    return { success: false };
  }

  const res = await db.insert(quizSessions).values({
    quizId,
    chatId: userId,
    userId,
    isGroup: false,
    mode: 'full',
    currentIndex: totalQuestions,
    totalQuestions,
    correctCount,
    wrongCount,
    isActive: false,
  }).run();

  // If wrong questions were sent, record into userMistakes
  if (Array.isArray(input?.failedQuestions) && input.failedQuestions.length > 0 && userId) {
    try {
      const { userMistakes } = await import('../schema.js');
      for (const fq of input.failedQuestions) {
        if (!fq?.questionText) continue;
        await db.insert(userMistakes).values({
          userId,
          questionText: fq.questionText,
          optionsJson: JSON.stringify(fq.options || []),
          correctOptionId: Number(fq.correctOptionId) || 0,
          explanation: fq.explanation || null,
          originalQuizId: quizId,
        }).run();
      }
    } catch (e) {
      console.error('Failed to log userMistakes:', e);
    }
  }

  return {
    success: true,
    sessionId: res?.lastInsertRowid || null,
  };
}
