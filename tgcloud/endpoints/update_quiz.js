// tgcloud/endpoints/update_quiz.js
import { db } from 'sdk';
import { eq, and } from 'sdk/db';
import { quizzes, questions } from '../schema.js';
import { CONFIG } from '../lib/constants/config.js';
import { ERRORS } from '../lib/constants/errors.js';

import turso from '../lib/turso_client.js';

const FALLBACK_OPTIONS = ['Option A', 'Option B'];

export default async function (input, ctx) {
  const currentUserId = ctx?.initData?.user?.id;
  if (!currentUserId) {
    return { success: false, error: ERRORS.UNAUTHORIZED };
  }

  const { quizId, title, description, timeLimit, questions: questionsList } = input || {};
  const qId = Number(quizId);

  if (!qId) {
    return { success: false, error: ERRORS.MISSING_QUIZ_ID };
  }

  if (!title || typeof title !== 'string' || !title.trim()) {
    return { success: false, error: ERRORS.TITLE_REQUIRED };
  }

  if (!Array.isArray(questionsList) || questionsList.length === 0) {
    return { success: false, error: ERRORS.QUESTIONS_REQUIRED };
  }

  if (CONFIG.TURSO?.ENABLED) {
    try {
      const targetQuiz = await turso.get('SELECT * FROM quizzes WHERE id = ? AND owner_id = ?', [qId, currentUserId]);
      if (!targetQuiz) {
        return { success: false, error: ERRORS.QUIZ_NOT_FOUND_OR_FORBIDDEN };
      }

      await turso.run(
        'UPDATE quizzes SET title = ?, description = ?, time_limit = ? WHERE id = ?',
        [title.trim(), description?.trim() || '', Number(timeLimit) || CONFIG.POLL.DEFAULT_TIME_LIMIT, qId]
      );

      await turso.run('DELETE FROM questions WHERE quiz_id = ?', [qId]);

      const batchInserts = questionsList.map((q, i) => {
        const text = q.questionText?.trim() || `Question #${i + 1}`;
        const opts = Array.isArray(q.options) && q.options.length >= CONFIG.POLL.MIN_OPTIONS
          ? q.options.map((o) => (typeof o === 'string' ? o.trim() : String(o)))
          : FALLBACK_OPTIONS;

        const correctId = Number(q.correctOptionId) >= 0 && Number(q.correctOptionId) < opts.length
          ? Number(q.correctOptionId)
          : 0;

        return {
          sql: 'INSERT INTO questions (quiz_id, order_index, question_text, options_json, correct_option_id, explanation) VALUES (?, ?, ?, ?, ?, ?)',
          params: [qId, i, text, JSON.stringify(opts), correctId, q.explanation?.trim() || null],
        };
      });

      await turso.batch(batchInserts);
    } catch (err) {
      console.warn('[update_quiz] Turso update fallback to local db:', err.message);
    }
  }

  // Dual-update local db as well
  const targetQuiz = await db
    .select()
    .from(quizzes)
    .where(and(eq(quizzes.id, qId), eq(quizzes.ownerId, currentUserId)))
    .get();

  if (!targetQuiz && !CONFIG.TURSO?.ENABLED) {
    return { success: false, error: ERRORS.QUIZ_NOT_FOUND_OR_FORBIDDEN };
  }

  if (targetQuiz) {
    await db
      .update(quizzes)
      .set({
        title: title.trim(),
        description: description?.trim() || '',
        timeLimit: Number(timeLimit) || CONFIG.POLL.DEFAULT_TIME_LIMIT,
      })
      .where(eq(quizzes.id, qId))
      .run();

    await db
      .delete(questions)
      .where(eq(questions.quizId, qId))
      .run();

    for (let i = 0; i < questionsList.length; i++) {
      const q = questionsList[i];
      const text = q.questionText?.trim() || `Question #${i + 1}`;
      const opts = Array.isArray(q.options) && q.options.length >= CONFIG.POLL.MIN_OPTIONS
        ? q.options.map((o) => (typeof o === 'string' ? o.trim() : String(o)))
        : FALLBACK_OPTIONS;

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
  }

  return {
    success: true,
    quizId: qId,
    questionCount: questionsList.length,
  };
}
