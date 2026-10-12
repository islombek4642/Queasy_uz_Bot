// tgcloud/endpoints/save_custom_quiz.js
import { db } from 'sdk';
import { eq, desc } from 'sdk/db';
import { quizzes, questions } from '../schema.js';

export default async function (input, ctx) {
  const currentUserId = ctx?.initData?.user?.id;
  if (!currentUserId) {
    return { success: false, error: 'Unauthorized: User ID missing' };
  }

  const { title, description, timeLimit, shuffleOptions, questions: questionsList } = input || {};

  if (!title || typeof title !== 'string' || !title.trim()) {
    return { success: false, error: 'Sarlavha kiritilishi shart' };
  }

  if (!Array.isArray(questionsList) || questionsList.length === 0) {
    return { success: false, error: 'Kamida 1 ta savol qo\'shilishi shart' };
  }

  const isShuffle = shuffleOptions !== undefined ? Boolean(shuffleOptions) : true;

  // 1. Insert Quiz
  const insertQuizResult = await db
    .insert(quizzes)
    .values({
      ownerId: currentUserId,
      title: title.trim().slice(0, 200),
      description: description?.trim() || '',
      timeLimit: Number(timeLimit) || 30,
      shuffleOptions: isShuffle,
    })
    .run();

  let newQuizId = insertQuizResult?.lastInsertRowid ? Number(insertQuizResult.lastInsertRowid) : null;
  if (!newQuizId) {
    const latest = await db
      .select({ id: quizzes.id })
      .from(quizzes)
      .where(eq(quizzes.ownerId, currentUserId))
      .orderBy(desc(quizzes.id))
      .limit(1)
      .get();
    newQuizId = latest?.id ? Number(latest.id) : null;
  }

  // 2. Insert Questions
  for (let i = 0; i < questionsList.length; i++) {
    const q = questionsList[i];
    const text = q.questionText?.trim() || `Savol #${i + 1}`;
    const opts = Array.isArray(q.options) && q.options.length >= 2
      ? q.options.map((o) => (typeof o === 'string' ? o.trim() : String(o)))
      : ['Variant A', 'Variant B'];

    const correctId = Number(q.correctOptionId) >= 0 && Number(q.correctOptionId) < opts.length
      ? Number(q.correctOptionId)
      : 0;

    await db
      .insert(questions)
      .values({
        quizId: newQuizId,
        orderIndex: i,
        questionText: text,
        optionsJson: JSON.stringify(opts),
        correctOptionId: correctId,
        explanation: q.explanation?.trim() || null,
      })
      .run();
  }

  return {
    success: true,
    quizId: newQuizId,
    questionCount: questionsList.length,
  };
}
