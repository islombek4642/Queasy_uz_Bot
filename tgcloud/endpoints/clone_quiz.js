// tgcloud/endpoints/clone_quiz.js
import { db } from 'sdk';
import { eq, and } from 'sdk/db';
import { quizzes } from '../schema.js';
import { cloneQuiz } from '../lib/services/quiz_service.js';
import { ERRORS } from '../lib/constants/errors.js';

export default async function (input, ctx) {
  try {
    const currentUserId = ctx?.initData?.user?.id;
    if (!currentUserId) {
      return { success: false, error: ERRORS.UNAUTHORIZED };
    }

    const quizId = Number(input?.quizId);
    if (!quizId) {
      return { success: false, error: ERRORS.MISSING_QUIZ_ID };
    }

    // 1. Fetch original quiz
    const original = await db
      .select()
      .from(quizzes)
      .where(eq(quizzes.id, quizId))
      .get();

    if (!original) {
      return { success: false, error: ERRORS.QUIZ_NOT_FOUND };
    }

    // 2. Check if user already owns this quiz or already cloned it with identical title
    const existing = await db
      .select()
      .from(quizzes)
      .where(and(eq(quizzes.ownerId, currentUserId), eq(quizzes.title, original.title)))
      .get();

    if (existing) {
      return {
        success: true,
        alreadySaved: true,
        quizId: existing.id,
        title: existing.title,
      };
    }

    // 3. Clone quiz for current user
    const lang = ctx?.initData?.user?.language_code?.toUpperCase()?.includes('RU') ? 'RU' : 'UZ';
    const cloned = await cloneQuiz(quizId, currentUserId, lang);

    if (!cloned) {
      return { success: false, error: ERRORS.CLONE_FAILED };
    }

    return {
      success: true,
      quizId: cloned.id,
      title: cloned.title,
    };
  } catch (err) {
    console.error('[clone_quiz error]:', err);
    return {
      success: false,
      error: err?.message || ERRORS.SERVER_ERROR,
    };
  }
}
