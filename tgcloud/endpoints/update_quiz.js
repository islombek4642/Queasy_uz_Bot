// tgcloud/endpoints/update_quiz.js
import { db } from 'sdk';
import { eq, and } from 'sdk/db';
import { quizzes, questions } from '../schema.js';

export default async function (input, ctx) {
  const currentUserId = ctx?.initData?.user?.id;
  if (!currentUserId) {
    return { success: false, error: 'Avtorizatsiya talab qilinadi' };
  }

  const { quizId, title, description, timeLimit, questions: questionsList } = input || {};
  const qId = Number(quizId);

  if (!qId) {
    return { success: false, error: 'Quiz ID ko\'rsatilmadi' };
  }

  if (!title || typeof title !== 'string' || !title.trim()) {
    return { success: false, error: 'Sarlavha kiritilishi shart' };
  }

  if (!Array.isArray(questionsList) || questionsList.length === 0) {
    return { success: false, error: 'Kamida 1 ta savol bo\'lishi shart' };
  }

  // 1. Verify ownership
  const targetQuiz = await db
    .select()
    .from(quizzes)
    .where(and(eq(quizzes.id, qId), eq(quizzes.ownerId, currentUserId)))
    .get();

  if (!targetQuiz) {
    return { success: false, error: 'Test topilmadi yoki sizga tegishli emas' };
  }

  // 2. Update quiz metadata
  await db
    .update(quizzes)
    .set({
      title: title.trim(),
      description: description?.trim() || '',
      timeLimit: Number(timeLimit) || 30,
    })
    .where(eq(quizzes.id, qId))
    .run();

  // 3. Replace questions: delete old, insert new
  await db
    .delete(questions)
    .where(eq(questions.quizId, qId))
    .run();

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
        quizId: qId,
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
    quizId: qId,
    questionCount: questionsList.length,
  };
}
