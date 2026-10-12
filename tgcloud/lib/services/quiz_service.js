// tgcloud/lib/services/quiz_service.js
// Quizzes and questions CRUD operations

import { db } from 'sdk';
import { eq, desc, sql } from 'sdk/db';
import { quizzes, questions } from '../../schema.js';
import { CONFIG } from '../constants/config.js';
import { getMessage } from '../constants/messages.js';
import { hasMathFormula, generateLatexImageUrl } from '../parsers/math_engine.js';

export async function createQuiz(ownerId, title, rawQuestions, options = {}) {
  const timeLimit = options.timeLimit || CONFIG.POLL.DEFAULT_TIME_LIMIT;
  const shuffleOptions = options.shuffleOptions !== undefined ? options.shuffleOptions : true;

  // 1. Insert Quiz header
  await db
    .insert(quizzes)
    .values({
      ownerId,
      title: title.slice(0, 200),
      description: options.description || null,
      timeLimit,
      shuffleOptions,
    })
    .run();

  // Fetch the inserted quiz
  const insertedQuiz = await db
    .select()
    .from(quizzes)
    .where(eq(quizzes.ownerId, ownerId))
    .orderBy(desc(quizzes.id))
    .limit(1)
    .get();

  if (!insertedQuiz) {
    throw new Error(getMessage('ERR_CREATE_QUIZ_FAILED', CONFIG.I18N.DEFAULT_LANG));
  }

  // 2. Insert Questions in batch/loop
  for (let i = 0; i < rawQuestions.length; i++) {
    const q = rawQuestions[i];

    // Determine photoFileId: existing photoFileId or auto-generated formula image
    let photoFileId = q.photoFileId || null;
    if (!photoFileId && hasMathFormula(q.questionText)) {
      photoFileId = generateLatexImageUrl(q.questionText, 300);
    }

    await db
      .insert(questions)
      .values({
        quizId: insertedQuiz.id,
        orderIndex: i,
        questionText: q.questionText,
        optionsJson: JSON.stringify(q.options),
        correctOptionId: q.correctOptionId,
        explanation: q.explanation || null,
        photoFileId,
        photoCaption: q.photoCaption || null,
      })
      .run();
  }

  return insertedQuiz;
}

export async function getQuizById(quizId) {
  const quiz = await db
    .select()
    .from(quizzes)
    .where(eq(quizzes.id, quizId))
    .get();

  if (!quiz) return null;

  const qList = await db
    .select()
    .from(questions)
    .where(eq(questions.quizId, quizId))
    .all();

  const formattedQuestions = qList.map((item) => {
    let options = [];
    try {
      options = JSON.parse(item.optionsJson);
    } catch {
      options = [];
    }
    return {
      id: item.id,
      questionText: item.questionText,
      options,
      correctOptionId: item.correctOptionId,
      explanation: item.explanation,
      photoFileId: item.photoFileId || null,
      photoCaption: item.photoCaption || null,
      orderIndex: item.orderIndex,
    };
  });

  return {
    ...quiz,
    questions: formattedQuestions,
  };
}

export async function getUserQuizzes(userId, page = 0, pageSize = CONFIG.PAGINATION.MY_QUIZZES) {
  const offset = page * pageSize;
  const list = await db
    .select()
    .from(quizzes)
    .where(eq(quizzes.ownerId, userId))
    .orderBy(desc(quizzes.id))
    .limit(pageSize)
    .offset(offset)
    .all();

  return list;
}

export async function getUserQuizzesCount(userId) {
  return await db.$count(quizzes, eq(quizzes.ownerId, userId));
}

export async function deleteQuiz(quizId, ownerId) {
  const quiz = await db
    .select()
    .from(quizzes)
    .where(eq(quizzes.id, quizId))
    .get();

  if (!quiz || quiz.ownerId !== ownerId) {
    return false;
  }

  // Delete questions first
  await db
    .delete(questions)
    .where(eq(questions.quizId, quizId))
    .run();

  // Delete quiz
  await db
    .delete(quizzes)
    .where(eq(quizzes.id, quizId))
    .run();

  return true;
}

export async function updateQuizSettings(quizId, updates = {}) {
  const data = {};
  if (updates.timeLimit !== undefined) data.timeLimit = updates.timeLimit;
  if (updates.shuffleOptions !== undefined) data.shuffleOptions = updates.shuffleOptions;

  await db
    .update(quizzes)
    .set(data)
    .where(eq(quizzes.id, quizId))
    .run();
}

export async function cloneQuiz(quizId, newOwnerId, lang = CONFIG.I18N.DEFAULT_LANG, customTitle = null) {
  // 1. Fetch original quiz header
  const original = await db
    .select()
    .from(quizzes)
    .where(eq(quizzes.id, quizId))
    .get();

  if (!original) return null;

  const title = customTitle || (original.ownerId === 0 ? original.title : getMessage('QUIZ_CLONED_TITLE', lang, { title: original.title }));

  // 2. Insert new quiz header using returning
  const inserted = await db
    .insert(quizzes)
    .values({
      ownerId: newOwnerId,
      title: title.slice(0, 200),
      description: original.description || null,
      timeLimit: original.timeLimit || CONFIG.POLL.DEFAULT_TIME_LIMIT,
      shuffleOptions: original.shuffleOptions !== undefined ? original.shuffleOptions : true,
    })
    .returning({ id: quizzes.id });

  const newQuizId = inserted && inserted[0] ? inserted[0].id : null;
  if (!newQuizId) {
    return null;
  }

  // 3. Ultra-fast atomic duplicate of all questions in a single SQL query
  await db.run(sql`
    INSERT INTO questions (quiz_id, order_index, question_text, options_json, correct_option_id, explanation, photo_file_id, photo_caption)
    SELECT ${newQuizId}, order_index, question_text, options_json, correct_option_id, explanation, photo_file_id, photo_caption
    FROM questions
    WHERE quiz_id = ${quizId}
    ORDER BY order_index ASC
  `);

  const qCount = await db.$count(questions, eq(questions.quizId, newQuizId));

  return {
    id: newQuizId,
    title,
    timeLimit: original.timeLimit,
    shuffleOptions: original.shuffleOptions,
    ownerId: newOwnerId,
    questions: new Array(qCount),
  };
}

export default {
  createQuiz,
  getQuizById,
  getUserQuizzes,
  getUserQuizzesCount,
  deleteQuiz,
  updateQuizSettings,
  cloneQuiz,
};
