// tgcloud/endpoints/save_custom_quiz.js
import { createQuiz } from '../lib/services/quiz_service.js';
import { CONFIG } from '../lib/constants/config.js';
import { ERRORS } from '../lib/constants/errors.js';

const FALLBACK_OPTIONS = ['Option A', 'Option B'];

export default async function (input, ctx) {
  const currentUserId = ctx?.initData?.user?.id;
  if (!currentUserId) {
    return { success: false, error: ERRORS.UNAUTHORIZED };
  }

  const { title, description, timeLimit, shuffleOptions, questions: questionsList } = input || {};

  if (!title || typeof title !== 'string' || !title.trim()) {
    return { success: false, error: ERRORS.TITLE_REQUIRED };
  }

  if (!Array.isArray(questionsList) || questionsList.length === 0) {
    return { success: false, error: ERRORS.QUESTIONS_REQUIRED };
  }

  const isShuffle = shuffleOptions !== undefined ? Boolean(shuffleOptions) : true;

  const formattedQuestions = questionsList.map((q, i) => {
    const text = q.questionText?.trim() || `Question #${i + 1}`;
    const opts = Array.isArray(q.options) && q.options.length >= CONFIG.POLL.MIN_OPTIONS
      ? q.options.map((o) => (typeof o === 'string' ? o.trim() : String(o)))
      : FALLBACK_OPTIONS;

    const correctId = Number(q.correctOptionId) >= 0 && Number(q.correctOptionId) < opts.length
      ? Number(q.correctOptionId)
      : 0;

    return {
      questionText: text,
      options: opts,
      correctOptionId: correctId,
      explanation: q.explanation?.trim() || null,
    };
  });

  const created = await createQuiz(currentUserId, title.trim(), formattedQuestions, {
    description: description?.trim() || '',
    timeLimit: Number(timeLimit) || CONFIG.POLL.DEFAULT_TIME_LIMIT,
    shuffleOptions: isShuffle,
  });

  return {
    success: true,
    quizId: created.id,
    questionCount: formattedQuestions.length,
  };
}
