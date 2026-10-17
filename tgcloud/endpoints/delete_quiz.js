// tgcloud/endpoints/delete_quiz.js
import { deleteQuiz } from '../lib/services/quiz_service.js';
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

  const ok = await deleteQuiz(quizId, currentUserId);
  if (!ok) {
    return { success: false, error: ERRORS.QUIZ_NOT_FOUND_OR_FORBIDDEN };
  }

  return { success: true, deletedQuizId: quizId };
}
