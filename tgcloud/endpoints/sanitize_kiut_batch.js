// tgcloud/endpoints/sanitize_kiut_batch.js
// Batch cleaner endpoint: iterates quizzes and updates questions in the database
import { db } from 'sdk';
import { eq, gte, asc } from 'sdk/db';
import { quizzes, questions } from '../schema.js';
import { sanitizeQuestionText, sanitizeOptionsList } from '../lib/parsers/sanitizer.js';

export default async function (input, ctx) {
  try {
    const startQuizId = Number(input?.startQuizId) || 0;
    const batchSize = Math.min(Number(input?.batchSize) || 30, 100);

    // Fetch batch of quizzes starting from startQuizId
    const quizRows = await db
      .select({ id: quizzes.id, title: quizzes.title })
      .from(quizzes)
      .where(gte(quizzes.id, startQuizId))
      .orderBy(asc(quizzes.id))
      .limit(batchSize)
      .all();

    if (!quizRows || quizRows.length === 0) {
      return {
        success: true,
        isDone: true,
        quizzesProcessed: 0,
        questionsUpdated: 0,
        nextQuizId: null,
      };
    }

    let questionsUpdated = 0;
    let questionsScanned = 0;

    for (const q of quizRows) {
      const qList = await db
        .select({
          id: questions.id,
          questionText: questions.questionText,
          optionsJson: questions.optionsJson,
        })
        .from(questions)
        .where(eq(questions.quizId, q.id))
        .all();

      questionsScanned += qList.length;

      for (const item of qList) {
        const rawText = item.questionText || '';
        let rawOpts = [];
        try {
          rawOpts = JSON.parse(item.optionsJson || '[]');
        } catch {
          rawOpts = [];
        }

        const cleanText = sanitizeQuestionText(rawText);
        const cleanOpts = sanitizeOptionsList(rawOpts);
        const cleanJson = JSON.stringify(cleanOpts);

        // Check if anything actually changed
        if (cleanText !== rawText || cleanJson !== item.optionsJson) {
          await db
            .update(questions)
            .set({
              questionText: cleanText,
              optionsJson: cleanJson,
            })
            .where(eq(questions.id, item.id))
            .run();

          questionsUpdated++;
        }
      }
    }

    const lastQuiz = quizRows[quizRows.length - 1];
    const nextQuizId = lastQuiz ? lastQuiz.id + 1 : null;
    const isDone = quizRows.length < batchSize;

    return {
      success: true,
      isDone,
      quizzesProcessed: quizRows.length,
      questionsScanned,
      questionsUpdated,
      currentBatch: `${quizRows[0].id}..${lastQuiz.id}`,
      nextQuizId,
    };
  } catch (err) {
    return {
      success: false,
      error: err.message,
    };
  }
}
