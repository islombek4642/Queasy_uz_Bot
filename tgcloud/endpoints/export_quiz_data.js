import { getQuizById } from '../lib/services/quiz_service.js';

export default async function (input, ctx) {
  const quizId = input?.quizId || 2995;
  const quiz = await getQuizById(quizId);
  if (!quiz) return { error: 'Quiz not found' };

  return JSON.stringify({
    quizId: quiz.id,
    title: quiz.title,
    count: quiz.questions?.length || 0,
    questions: quiz.questions,
  });
}
