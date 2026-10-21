import { getQuizById } from '../lib/services/quiz_service.js';
import { isUserAdmin } from '../lib/services/admin_service.js';

export default async function (input, ctx) {
  const quizId = Number(input?.quizId);
  if (!quizId) {
    return { success: false, error: 'QUIZ_ID_REQUIRED' };
  }

  const quiz = await getQuizById(quizId);
  if (!quiz) {
    return { success: false, error: 'Quiz not found' };
  }

  const callerId = ctx?.initData?.user?.id;
  const isOwner = callerId && Number(quiz.ownerId) === Number(callerId);
  const isAdmin = callerId && isUserAdmin(callerId);

  // If quiz is not public, only owner or admin can export it
  if (!quiz.isPublic && !isOwner && !isAdmin) {
    return { success: false, error: 'FORBIDDEN' };
  }

  return {
    success: true,
    quizId: quiz.id,
    title: quiz.title,
    description: quiz.description,
    timeLimit: quiz.timeLimit,
    count: quiz.questions?.length || 0,
    questions: quiz.questions,
  };
}
