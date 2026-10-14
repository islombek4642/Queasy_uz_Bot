// tgcloud/endpoints/ingest_kiut_batch.js
import { db } from 'sdk';
import { quizzes, questions } from '../schema.js';
import { isUserAdmin } from '../lib/services/admin_service.js';
import { CONFIG } from '../lib/constants/config.js';
import { ERRORS } from '../lib/constants/errors.js';
import { getMessage } from '../lib/constants/messages.js';

const INGEST_CHUNK_SIZE = 50;

export default async function (input, ctx) {
  const callerId = ctx?.initData?.user?.id;
  const isAuthorizedAdmin = callerId && isUserAdmin(callerId);

  if (!isAuthorizedAdmin) {
    return { success: false, error: ERRORS.UNAUTHORIZED_ADMIN_ONLY };
  }

  const batch = input?.quizzes;
  if (!Array.isArray(batch) || batch.length === 0) {
    return { success: false, error: ERRORS.EMPTY_BATCH };
  }

  const defaultTitle = getMessage('DEFAULT_UNNAMED_QUIZ', 'UZ');
  const defaultCategory = getMessage('DEFAULT_OTHER_CATEGORY', 'UZ');

  let insertedCount = 0;

  for (const item of batch) {
    try {
      const title = (item.title || defaultTitle).trim();
      const category = (item.category || defaultCategory).trim();
      const description = (item.description || '').trim();
      const timeLimit = Number(item.timeLimit) || CONFIG.POLL.DEFAULT_TIME_LIMIT;
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

      // 2. Insert Questions in bulk
      const qRows = questionsList.map((q, idx) => ({
        quizId,
        orderIndex: idx,
        questionText: q.questionText || '',
        optionsJson: JSON.stringify(q.options || []),
        correctOptionId: Number(q.correctOptionId) || 0,
      }));

      for (let c = 0; c < qRows.length; c += INGEST_CHUNK_SIZE) {
        const chunk = qRows.slice(c, c + INGEST_CHUNK_SIZE);
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
