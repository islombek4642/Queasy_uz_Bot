// tgcloud/endpoints/get_quiz_detail.js
import { db, EndpointError } from 'sdk';
import { eq } from 'sdk/db';
import { quizzes, questions } from '../schema.js';
import { CONFIG } from '../lib/constants/config.js';
import turso from '../lib/turso_client.js';

export default async function (input, ctx) {
  const quizId = parseInt(input?.quizId, 10);
  if (!quizId) {
    throw new EndpointError('Invalid quiz ID', { code: 'INVALID_ID' });
  }

  if (CONFIG.TURSO?.ENABLED) {
    try {
      const quiz = await turso.get('SELECT * FROM quizzes WHERE id = ?', [quizId]);
      if (!quiz) {
        throw new EndpointError('Quiz not found', { code: 'NOT_FOUND' });
      }

      const rawQuestions = await turso.all('SELECT * FROM questions WHERE quiz_id = ? ORDER BY order_index ASC', [quizId]);
      const formattedQuestions = rawQuestions.map((q) => {
        let options = [];
        try {
          options = JSON.parse(q.options_json);
        } catch {
          options = [];
        }
        return {
          id: q.id,
          questionText: q.question_text,
          options,
          correctOptionId: q.correct_option_id,
          explanation: q.explanation || null,
          photoFileId: q.photo_file_id || null,
        };
      });

      return {
        quiz: {
          id: quiz.id,
          title: quiz.title,
          description: quiz.description,
          timeLimit: quiz.time_limit || 30,
          shuffleOptions: Boolean(quiz.shuffle_options),
        },
        questions: formattedQuestions,
      };
    } catch (err) {
      if (err instanceof EndpointError) throw err;
      console.warn('[get_quiz_detail] Turso fallback to local db:', err.message);
    }
  }

  const quiz = await db.select().from(quizzes).where(eq(quizzes.id, quizId)).get();
  if (!quiz) {
    throw new EndpointError('Quiz not found', { code: 'NOT_FOUND' });
  }


  const rawQuestions = await db
    .select()
    .from(questions)
    .where(eq(questions.quizId, quizId))
    .all();

  const formattedQuestions = rawQuestions.map((q) => {
    let options = [];
    try {
      options = JSON.parse(q.optionsJson);
    } catch {
      options = [];
    }
    return {
      id: q.id,
      questionText: q.questionText,
      options,
      correctOptionId: q.correctOptionId,
      explanation: q.explanation || null,
      photoFileId: q.photoFileId || null,
    };
  });

  return {
    quiz: {
      id: quiz.id,
      title: quiz.title,
      description: quiz.description,
      timeLimit: quiz.timeLimit || 30,
      shuffleOptions: Boolean(quiz.shuffleOptions),
    },
    questions: formattedQuestions,
  };
}
