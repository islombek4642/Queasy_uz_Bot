import { db } from 'sdk';
import { eq } from 'sdk/db';
import { quizzes, questions } from '../schema.js';

export default async function (input, ctx) {
  const quizId = input?.quizId || 2995;
  const quiz = await db.select().from(quizzes).where(eq(quizzes.id, quizId)).get();
  if (!quiz) return { error: 'Quiz not found' };

  const qList = await db.select().from(questions).where(eq(questions.quizId, quizId)).orderBy(questions.orderIndex).all();
  return JSON.stringify({
    quizId: quiz.id,
    title: quiz.title,
    count: qList.length,
    questions: qList
  });
}
