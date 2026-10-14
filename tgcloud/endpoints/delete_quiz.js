// tgcloud/endpoints/delete_quiz.js
import { db } from 'sdk';
import { eq, and } from 'sdk/db';
import { quizzes, questions } from '../schema.js';
import { ERRORS } from '../lib/constants/errors.js';

export default async function (input, ctx) {
  const currentUserId = ctx?.initData?.user?.id;
  if (!currentUserId) {
    return { success: false, error: ERRORS.UNAUTHORIZED };
  }

  const quizId = Number(input?.quizId);
  if (!quizId) {
    return { success: false, error: ERRORS.MISSING_QUIZ_ID };
  }

  // 1. Verify ownership
  const targetQuiz = await db
    .select()
    .from(quizzes)
    .where(and(eq(quizzes.id, quizId), eq(quizzes.ownerId, currentUserId)))
    .get();

  if (!targetQuiz) {
    return { success: false, error: ERRORS.QUIZ_NOT_FOUND_OR_FORBIDDEN };
  }

  // 2. Delete questions
  await db
    .delete(questions)
    .where(eq(questions.quizId, quizId))
    .run();

  // 3. Delete quiz
  await db
    .delete(quizzes)
    .where(eq(quizzes.id, quizId))
    .run();

  return { success: true, deletedQuizId: quizId };
}
