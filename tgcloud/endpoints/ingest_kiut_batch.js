// tgcloud/endpoints/ingest_kiut_batch.js
import { db } from 'sdk';
import { quizzes, questions } from '../schema.js';

export default async function (input, ctx) {
  const secret = input?.secret;
  if (secret !== 'KIUT_QUEASY_SECRET_2026') {
    return { success: false, error: 'Unauthorized batch ingestion' };
  }

  const batch = input?.quizzes;
  if (!Array.isArray(batch) || batch.length === 0) {
    return { success: false, error: 'Empty batch' };
  }

  let insertedCount = 0;

  for (const item of batch) {
    try {
      const title = (item.title || 'Nomsiz test').trim();
      const category = (item.category || 'Boshqa').trim();
      const description = (item.description || '').trim();
      const timeLimit = Number(item.timeLimit) || 30;
      const questionsList = Array.isArray(item.questions) ? item.questions : [];

      if (questionsList.length === 0) continue;

      // 1. Insert Quiz
      const quizRes = await db.insert(quizzes).values({
        ownerId: 0, // 0 = Global KIUT System
        title,
        description,
        category,
        isPublic: true,
        timeLimit,
        shuffleOptions: true,
      }).run();

      const quizId = quizRes?.lastInsertRowid;
      if (!quizId) continue;

      // 2. Insert Questions in bulk (chunks of 50)
      const qRows = questionsList.map((q, idx) => ({
        quizId,
        orderIndex: idx,
        questionText: q.questionText || '',
        optionsJson: JSON.stringify(q.options || []),
        correctOptionId: Number(q.correctOptionId) || 0,
      }));

      const CHUNK_SIZE = 50;
      for (let c = 0; c < qRows.length; c += CHUNK_SIZE) {
        const chunk = qRows.slice(c, c + CHUNK_SIZE);
        await db.insert(questions).values(chunk).run();
      }

      insertedCount++;
    } catch (err) {
      console.error('Failed to insert quiz in batch:', err);
    }
  }

  return {
    success: true,
    insertedCount,
  };
}
