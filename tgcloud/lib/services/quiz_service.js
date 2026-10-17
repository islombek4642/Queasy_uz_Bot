// tgcloud/lib/services/quiz_service.js
// Quizzes and questions CRUD operations

import { db } from 'sdk';
import { eq, desc, sql } from 'sdk/db';
import { quizzes, questions, userMistakes } from '../../schema.js';

import { CONFIG } from '../constants/config.js';
import { getMessage } from '../constants/messages.js';
import { hasMathFormula, generateLatexImageUrl } from '../parsers/math_engine.js';
import turso from '../turso_client.js';

export async function createQuiz(ownerId, title, rawQuestions, options = {}) {
  const timeLimit = options.timeLimit || CONFIG.POLL.DEFAULT_TIME_LIMIT;
  const shuffleOptions = options.shuffleOptions !== undefined ? options.shuffleOptions : true;

  if (CONFIG.TURSO?.ENABLED) {
    try {
      const inserted = await turso.run(
        'INSERT INTO quizzes (owner_id, title, description, time_limit, shuffle_options, created_at) VALUES (?, ?, ?, ?, ?, unixepoch())',
        [ownerId, title.slice(0, 200), options.description || null, timeLimit, shuffleOptions ? 1 : 0]
      );
      const quizId = inserted.lastInsertRowid;
      if (!quizId) throw new Error('Failed to insert quiz into Turso');

      const qStatements = rawQuestions.map((q, i) => {
        let photoFileId = q.photoFileId || null;
        if (!photoFileId && hasMathFormula(q.questionText)) {
          photoFileId = generateLatexImageUrl(q.questionText, 300);
        }
        return {
          sql: 'INSERT INTO questions (quiz_id, order_index, question_text, options_json, correct_option_id, explanation, photo_file_id, photo_caption) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          params: [quizId, i, q.questionText, JSON.stringify(q.options), q.correctOptionId, q.explanation || null, photoFileId, q.photoCaption || null]
        };
      });
      await turso.batch(qStatements);

      const quizRow = await turso.get('SELECT * FROM quizzes WHERE id = ?', [quizId]);
      return {
        id: quizRow.id,
        ownerId: quizRow.owner_id,
        title: quizRow.title,
        description: quizRow.description,
        timeLimit: quizRow.time_limit,
        shuffleOptions: Boolean(quizRow.shuffle_options),
      };
    } catch (err) {
      console.warn('[quiz_service] Turso createQuiz fallback to local db:', err.message);
    }
  }

  // 1. Insert Quiz header
  const inserted = await db
    .insert(quizzes)
    .values({
      ownerId,
      title: title.slice(0, 200),
      description: options.description || null,
      timeLimit,
      shuffleOptions,
    })
    .returning();


  let insertedQuiz = inserted && inserted[0] ? inserted[0] : null;
  if (!insertedQuiz && inserted?.lastInsertRowid) {
    const rowId = Number(inserted.lastInsertRowid);
    insertedQuiz = await db.select().from(quizzes).where(eq(quizzes.id, rowId)).get();
  }

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
  const qId = Number(quizId);

  if (CONFIG.TURSO?.ENABLED) {
    try {
      const quiz = await turso.get('SELECT * FROM quizzes WHERE id = ?', [qId]);
      if (!quiz) return null;

      const qList = await turso.all('SELECT * FROM questions WHERE quiz_id = ? ORDER BY order_index ASC', [qId]);
      const formattedQuestions = qList.map((item) => {
        let options = [];
        try {
          options = JSON.parse(item.options_json);
        } catch {
          options = [];
        }
        return {
          id: item.id,
          questionText: item.question_text,
          options,
          correctOptionId: item.correct_option_id,
          explanation: item.explanation,
          photoFileId: item.photo_file_id || null,
          photoCaption: item.photo_caption || null,
          orderIndex: item.order_index,
        };
      });

      return {
        id: quiz.id,
        ownerId: quiz.owner_id,
        title: quiz.title,
        description: quiz.description,
        category: quiz.category,
        isPublic: Boolean(quiz.is_public),
        timeLimit: quiz.time_limit || 30,
        shuffleOptions: Boolean(quiz.shuffle_options),
        createdAt: quiz.created_at,
        questions: formattedQuestions,
      };
    } catch (err) {
      console.warn('[quiz_service] Turso getQuizById fallback to local db:', err.message);
    }
  }

  const quiz = await db
    .select()
    .from(quizzes)
    .where(eq(quizzes.id, qId))
    .get();

  if (!quiz) return null;

  const qList = await db
    .select()
    .from(questions)
    .where(eq(questions.quizId, qId))
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
  const uid = Number(userId);
  const offset = page * pageSize;

  if (CONFIG.TURSO?.ENABLED) {
    try {
      const list = await turso.all(
        'SELECT * FROM quizzes WHERE owner_id = ? ORDER BY id DESC LIMIT ? OFFSET ?',
        [uid, pageSize, offset]
      );
      return list.map(q => ({
        id: q.id,
        ownerId: q.owner_id,
        title: q.title,
        description: q.description,
        category: q.category,
        timeLimit: q.time_limit || 30,
        shuffleOptions: Boolean(q.shuffle_options),
        createdAt: q.created_at,
      }));
    } catch (err) {
      console.warn('[quiz_service] Turso getUserQuizzes fallback to local db:', err.message);
    }
  }

  const list = await db
    .select()
    .from(quizzes)
    .where(eq(quizzes.ownerId, uid))
    .orderBy(desc(quizzes.id))
    .limit(pageSize)
    .offset(offset)
    .all();

  return list;
}

export async function getUserQuizzesCount(userId) {
  const uid = Number(userId);

  if (CONFIG.TURSO?.ENABLED) {
    try {
      const row = await turso.get('SELECT count(*) as count FROM quizzes WHERE owner_id = ?', [uid]);
      return Number(row?.count || 0);
    } catch (err) {
      console.warn('[quiz_service] Turso getUserQuizzesCount fallback to local db:', err.message);
    }
  }

  return await db.$count(quizzes, eq(quizzes.ownerId, uid));
}

export async function deleteQuiz(quizId, ownerId) {
  const qId = Number(quizId);
  const oId = Number(ownerId);

  if (CONFIG.TURSO?.ENABLED) {
    try {
      const quiz = await turso.get('SELECT * FROM quizzes WHERE id = ?', [qId]);
      if (!quiz || Number(quiz.owner_id) !== oId) {
        return false;
      }
      await turso.run('DELETE FROM questions WHERE quiz_id = ?', [qId]);
      await turso.run('DELETE FROM user_mistakes WHERE original_quiz_id = ?', [qId]);
      await turso.run('DELETE FROM quizzes WHERE id = ?', [qId]);
      return true;
    } catch (err) {
      console.warn('[quiz_service] Turso deleteQuiz fallback to local db:', err.message);
    }
  }

  const quiz = await db
    .select()
    .from(quizzes)
    .where(eq(quizzes.id, qId))
    .get();

  if (!quiz || quiz.ownerId !== oId) {
    return false;
  }

  // Delete questions and mistakes first
  await db
    .delete(questions)
    .where(eq(questions.quizId, qId))
    .run();

  await db
    .delete(userMistakes)
    .where(eq(userMistakes.originalQuizId, qId))
    .run();

  // Delete quiz
  await db
    .delete(quizzes)
    .where(eq(quizzes.id, qId))
    .run();


  return true;
}

export async function updateQuizSettings(quizId, updates = {}) {
  const qId = Number(quizId);

  if (CONFIG.TURSO?.ENABLED) {
    try {
      if (updates.timeLimit !== undefined) {
        await turso.run('UPDATE quizzes SET time_limit = ? WHERE id = ?', [updates.timeLimit, qId]);
      }
      if (updates.shuffleOptions !== undefined) {
        await turso.run('UPDATE quizzes SET shuffle_options = ? WHERE id = ?', [updates.shuffleOptions ? 1 : 0, qId]);
      }
      return;
    } catch (err) {
      console.warn('[quiz_service] Turso updateQuizSettings fallback to local db:', err.message);
    }
  }

  const data = {};
  if (updates.timeLimit !== undefined) data.timeLimit = updates.timeLimit;
  if (updates.shuffleOptions !== undefined) data.shuffleOptions = updates.shuffleOptions;

  await db
    .update(quizzes)
    .set(data)
    .where(eq(quizzes.id, qId))
    .run();
}

export async function cloneQuiz(quizId, newOwnerId, lang = CONFIG.I18N.DEFAULT_LANG, customTitle = null) {
  const qId = Number(quizId);
  const nOwnerId = Number(newOwnerId);

  if (CONFIG.TURSO?.ENABLED) {
    try {
      const original = await turso.get('SELECT * FROM quizzes WHERE id = ?', [qId]);
      if (!original) return null;

      const title = customTitle || (Number(original.owner_id) === 0 ? original.title : getMessage('QUIZ_CLONED_TITLE', lang, { title: original.title }));
      const categoryDesc = original.description || (original.category ? `KIUT ${original.category}` : null);

      const ins = await turso.run(
        'INSERT INTO quizzes (owner_id, title, description, category, time_limit, shuffle_options, created_at) VALUES (?, ?, ?, ?, ?, ?, unixepoch())',
        [nOwnerId, title.slice(0, 200), categoryDesc, original.category || null, original.time_limit || CONFIG.POLL.DEFAULT_TIME_LIMIT, original.shuffle_options !== undefined ? original.shuffle_options : 1]
      );
      const newQuizId = ins.lastInsertRowid;
      if (!newQuizId) return null;

      await turso.run(
        'INSERT INTO questions (quiz_id, order_index, question_text, options_json, correct_option_id, explanation, photo_file_id, photo_caption) SELECT ?, order_index, question_text, options_json, correct_option_id, explanation, photo_file_id, photo_caption FROM questions WHERE quiz_id = ? ORDER BY order_index ASC',
        [newQuizId, qId]
      );

      const countRow = await turso.get('SELECT count(*) as count FROM questions WHERE quiz_id = ?', [newQuizId]);
      return {
        id: newQuizId,
        title,
        timeLimit: original.time_limit,
        shuffleOptions: Boolean(original.shuffle_options),
        ownerId: nOwnerId,
        questions: new Array(Number(countRow?.count || 0)),
      };
    } catch (err) {
      console.warn('[quiz_service] Turso cloneQuiz fallback to local db:', err.message);
    }
  }

  // 1. Fetch original quiz header
  const original = await db
    .select()
    .from(quizzes)
    .where(eq(quizzes.id, qId))
    .get();

  if (!original) return null;

  const title = customTitle || (original.ownerId === 0 ? original.title : getMessage('QUIZ_CLONED_TITLE', lang, { title: original.title }));

  // 2. Insert new quiz header
  const categoryDesc = original.description || (original.category ? `KIUT ${original.category}` : null);
  const inserted = await db
    .insert(quizzes)
    .values({
      ownerId: nOwnerId,
      title: title.slice(0, 200),
      description: categoryDesc,
      category: original.category || null,
      timeLimit: original.timeLimit || CONFIG.POLL.DEFAULT_TIME_LIMIT,
      shuffleOptions: original.shuffleOptions !== undefined ? original.shuffleOptions : true,
    })
    .returning({ id: quizzes.id });

  let newQuizId = inserted && inserted[0] ? inserted[0].id : null;
  if (!newQuizId && inserted?.lastInsertRowid) {
    newQuizId = Number(inserted.lastInsertRowid);
  }

  if (!newQuizId) {
    return null;
  }

  const targetQuizId = Number(newQuizId);
  const sourceQuizId = qId;

  // 3. Ultra-fast atomic duplicate of all questions in a single SQL query
  await db.run(sql`
    INSERT INTO questions (quiz_id, order_index, question_text, options_json, correct_option_id, explanation, photo_file_id, photo_caption)
    SELECT ${targetQuizId}, order_index, question_text, options_json, correct_option_id, explanation, photo_file_id, photo_caption
    FROM questions
    WHERE quiz_id = ${sourceQuizId}
    ORDER BY order_index ASC
  `);

  const qCount = await db.$count(questions, eq(questions.quizId, newQuizId));

  return {
    id: newQuizId,
    title,
    timeLimit: original.timeLimit,
    shuffleOptions: original.shuffleOptions,
    ownerId: nOwnerId,
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
