// tgcloud/endpoints/get_live_question.js
import { db } from 'sdk';
import { eq, and } from 'sdk/db';
import { liveRooms, roomPlayers, quizzes, questions, botSettings } from '../schema.js';
import { CONFIG } from '../lib/constants/config.js';
import { ERRORS } from '../lib/constants/errors.js';
import turso from '../lib/turso_client.js';

export default async function (input, ctx) {
  const currentUserId = ctx?.initData?.user?.id ? Number(ctx.initData.user.id) : 0;
  const roomCode = String(input?.roomCode || '').trim();
  const questionIndex = parseInt(input?.questionIndex, 10);

  if (!roomCode) {
    return { success: false, error: ERRORS.MISSING_ROOM_CODE };
  }
  if (isNaN(questionIndex) || questionIndex < 0) {
    return { success: false, error: 'INVALID_QUESTION_INDEX' };
  }

  // 1. Fetch live room
  let room = null;
  if (CONFIG.TURSO?.ENABLED) {
    try {
      room = await turso.get('SELECT id, quiz_id as quizId, status FROM live_rooms WHERE room_code = ?', [roomCode]);
    } catch (err) {
      console.warn('[get_live_question] Turso room fetch fallback:', err.message);
    }
  }

  if (!room) {
    room = await db
      .select({ id: liveRooms.id, quizId: liveRooms.quizId, status: liveRooms.status })
      .from(liveRooms)
      .where(eq(liveRooms.roomCode, roomCode))
      .get();
  }

  if (!room) {
    return { success: false, error: ERRORS.ROOM_NOT_FOUND };
  }

  // 2. Fetch room configuration (mode, range, randomCount, timeLimit)
  let modeConfig = null;
  if (CONFIG.TURSO?.ENABLED) {
    try {
      const cfgRow = await turso.get('SELECT value FROM bot_settings WHERE key = ?', [`live_room_cfg:${roomCode}`]);
      if (cfgRow?.value) {
        modeConfig = JSON.parse(cfgRow.value);
      }
    } catch {}
  }

  if (!modeConfig) {
    const cfgSetting = await db
      .select({ value: botSettings.value })
      .from(botSettings)
      .where(eq(botSettings.key, `live_room_cfg:${roomCode}`))
      .get();
    if (cfgSetting?.value) {
      try {
        modeConfig = JSON.parse(cfgSetting.value);
      } catch {}
    }
  }

  const timeLimit = Number(modeConfig?.timeLimit) || CONFIG.POLL.DEFAULT_TIME_LIMIT;

  // 3. Fetch all questions for this quiz in order
  let allQuestions = [];
  if (CONFIG.TURSO?.ENABLED) {
    try {
      allQuestions = await turso.all(
        'SELECT id, question_text, options_json, photo_file_id FROM questions WHERE quiz_id = ? ORDER BY order_index ASC, id ASC',
        [room.quizId]
      );
    } catch (err) {
      console.warn('[get_live_question] Turso questions fetch fallback:', err.message);
    }
  }

  if (!allQuestions || allQuestions.length === 0) {
    allQuestions = await db
      .select({
        id: questions.id,
        questionText: questions.questionText,
        optionsJson: questions.optionsJson,
        photoFileId: questions.photoFileId,
      })
      .from(questions)
      .where(eq(questions.quizId, room.quizId))
      .orderBy(questions.orderIndex)
      .all();
  }

  if (!allQuestions || allQuestions.length === 0) {
    return { success: false, error: ERRORS.QUIZ_HAS_NO_QUESTIONS };
  }

  // 4. Apply modeConfig slices (full, range, random)
  let activeQuestions = allQuestions;
  if (modeConfig?.mode === 'range' && Array.isArray(modeConfig.range)) {
    const [start, end] = modeConfig.range;
    activeQuestions = allQuestions.slice(Math.max(0, start - 1), Math.min(allQuestions.length, end));
  } else if (modeConfig?.mode === 'random' && modeConfig.randomCount) {
    // If selectedQuestionIds is already stored, use it so all players see the exact same set
    if (Array.isArray(modeConfig.selectedQuestionIds)) {
      const idMap = new Map(allQuestions.map(q => [Number(q.id), q]));
      activeQuestions = modeConfig.selectedQuestionIds.map(id => idMap.get(id)).filter(Boolean);
    } else {
      activeQuestions = allQuestions.slice(0, Number(modeConfig.randomCount));
    }
  }

  const totalQuestions = activeQuestions.length;
  if (questionIndex >= totalQuestions) {
    return { success: true, isFinished: true, totalQuestions, questionIndex };
  }

  const rawQuestion = activeQuestions[questionIndex];

  // 5. Anti-Cheat: Sanitize question to NEVER expose correctOptionId or explanation
  const sanitizedQuestion = {
    id: rawQuestion.id,
    questionText: rawQuestion.question_text || rawQuestion.questionText,
    options: typeof rawQuestion.options_json === 'string'
      ? JSON.parse(rawQuestion.options_json || '[]')
      : (typeof rawQuestion.optionsJson === 'string' ? JSON.parse(rawQuestion.optionsJson || '[]') : []),
    photoFileId: rawQuestion.photo_file_id || rawQuestion.photoFileId || null,
  };

  return {
    success: true,
    roomCode,
    questionIndex,
    totalQuestions,
    timeLimit,
    question: sanitizedQuestion,
  };
}

