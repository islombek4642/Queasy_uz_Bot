// tgcloud/endpoints/get_quiz_detail.js
import { db, EndpointError } from 'sdk';
import { eq } from 'sdk/db';
import { quizzes, questions } from '../schema.js';

export default async function (input, ctx) {
  const quizId = parseInt(input?.quizId, 10);
  if (!quizId) {
    throw new EndpointError('Invalid quiz ID', { code: 'INVALID_ID' });
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
