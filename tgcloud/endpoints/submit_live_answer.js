// tgcloud/endpoints/submit_live_answer.js
import { db } from 'sdk';
import { eq, and, sql } from 'sdk/db';
import { liveRooms, roomPlayers, liveRoomAnswers, questions, botSettings } from '../schema.js';
import { CONFIG } from '../lib/constants/config.js';
import { ERRORS } from '../lib/constants/errors.js';
import turso from '../lib/turso_client.js';

export default async function (input, ctx) {
  const currentUserId = ctx?.initData?.user?.id ? Number(ctx.initData.user.id) : 0;
  const roomCode = String(input?.roomCode || '').trim();
  const questionIndex = parseInt(input?.questionIndex, 10);
  const selectedOptionId = parseInt(input?.selectedOptionId, 10);
  const timeTaken = Math.max(0, parseFloat(input?.timeTaken) || 0);

  if (!currentUserId) {
    return { success: false, error: ERRORS.UNAUTHORIZED };
  }
  if (!roomCode) {
    return { success: false, error: ERRORS.MISSING_ROOM_CODE };
  }
  if (isNaN(questionIndex) || questionIndex < 0) {
    return { success: false, error: 'INVALID_QUESTION_INDEX' };
  }
  if (isNaN(selectedOptionId) || selectedOptionId < 0) {
    return { success: false, error: 'INVALID_OPTION_ID' };
  }

  // 1. Prevent Double Submission: Check if player already answered this questionIndex
  let alreadyAnswered = false;
  if (CONFIG.TURSO?.ENABLED) {
    try {
      const existing = await turso.get(
        'SELECT id FROM live_room_answers WHERE room_code = ? AND user_id = ? AND question_index = ?',
        [roomCode, currentUserId, questionIndex]
      );
      if (existing) alreadyAnswered = true;
    } catch (err) {
      console.warn('[submit_live_answer] Turso check answer fallback:', err.message);
    }
  }

  if (!alreadyAnswered) {
    const existingLocal = await db
      .select({ id: liveRoomAnswers.id })
      .from(liveRoomAnswers)
      .where(
        and(
          eq(liveRoomAnswers.roomCode, roomCode),
          eq(liveRoomAnswers.userId, currentUserId),
          eq(liveRoomAnswers.questionIndex, questionIndex)
        )
      )
      .get();
    if (existingLocal) alreadyAnswered = true;
  }

  if (alreadyAnswered) {
    return { success: false, error: 'ALREADY_ANSWERED' };
  }

  // 2. Fetch room & quiz
  let room = null;
  if (CONFIG.TURSO?.ENABLED) {
    try {
      room = await turso.get('SELECT id, quiz_id as quizId, status FROM live_rooms WHERE room_code = ?', [roomCode]);
    } catch {}
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

  // 3. Fetch modeConfig for timeLimit & slicing
  let modeConfig = null;
  if (CONFIG.TURSO?.ENABLED) {
    try {
      const row = await turso.get('SELECT value FROM bot_settings WHERE key = ?', [`live_room_cfg:${roomCode}`]);
      if (row?.value) modeConfig = JSON.parse(row.value);
    } catch {}
  }
  if (!modeConfig) {
    const cfgSetting = await db
      .select({ value: botSettings.value })
      .from(botSettings)
      .where(eq(botSettings.key, `live_room_cfg:${roomCode}`))
      .get();
    if (cfgSetting?.value) {
      try { modeConfig = JSON.parse(cfgSetting.value); } catch {}
    }
  }
  const timeLimit = Number(modeConfig?.timeLimit) || CONFIG.POLL.DEFAULT_TIME_LIMIT;

  // 4. Resolve the targeted question and its true correct_option_id
  let allQuestions = [];
  if (CONFIG.TURSO?.ENABLED) {
    try {
      allQuestions = await turso.all(
        'SELECT id, correct_option_id FROM questions WHERE quiz_id = ? ORDER BY order_index ASC, id ASC',
        [room.quizId]
      );
    } catch {}
  }
  if (!allQuestions || allQuestions.length === 0) {
    allQuestions = await db
      .select({ id: questions.id, correctOptionId: questions.correctOptionId })
      .from(questions)
      .where(eq(questions.quizId, room.quizId))
      .orderBy(questions.orderIndex)
      .all();
  }

  let activeQuestions = allQuestions;
  if (modeConfig?.mode === 'range' && Array.isArray(modeConfig.range)) {
    const [start, end] = modeConfig.range;
    activeQuestions = allQuestions.slice(Math.max(0, start - 1), Math.min(allQuestions.length, end));
  } else if (modeConfig?.mode === 'random' && modeConfig.randomCount) {
    if (Array.isArray(modeConfig.selectedQuestionIds)) {
      const idMap = new Map(allQuestions.map(q => [Number(q.id), q]));
      activeQuestions = modeConfig.selectedQuestionIds.map(id => idMap.get(id)).filter(Boolean);
    } else {
      activeQuestions = allQuestions.slice(0, Number(modeConfig.randomCount));
    }
  }

  const targetQuestion = activeQuestions[questionIndex];
  if (!targetQuestion) {
    return { success: false, error: 'QUESTION_NOT_FOUND' };
  }

  const trueCorrectId = Number(
    targetQuestion.correct_option_id !== undefined
      ? targetQuestion.correct_option_id
      : targetQuestion.correctOptionId
  );

  const isCorrect = selectedOptionId === trueCorrectId;

  // 5. Calculate Score with speed bonus: 100 + 50 * (remaining / total)
  let scoreAwarded = 0;
  if (isCorrect) {
    const remaining = Math.max(0, timeLimit - timeTaken);
    scoreAwarded = 100 + Math.round(50 * (remaining / timeLimit));
  }

  // 6. Record answer into live_room_answers (Turso & local db)
  if (CONFIG.TURSO?.ENABLED) {
    try {
      await turso.run(
        `INSERT INTO live_room_answers 
         (room_code, user_id, question_index, selected_option_id, is_correct, score_awarded, time_taken, answered_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, unixepoch())`,
        [roomCode, currentUserId, questionIndex, selectedOptionId, isCorrect ? 1 : 0, scoreAwarded, Math.round(timeTaken)]
      );
      // Increment room_players score
      await turso.run(
        `UPDATE room_players SET score = MAX(0, score) + ? WHERE room_code = ? AND user_id = ?`,
        [scoreAwarded, roomCode, currentUserId]
      );
    } catch (err) {
      console.warn('[submit_live_answer] Turso insert/update fallback:', err.message);
    }
  }

  try {
    await db.insert(liveRoomAnswers).values({
      roomCode,
      userId: currentUserId,
      questionIndex,
      selectedOptionId,
      isCorrect,
      scoreAwarded,
      timeTaken: Math.round(timeTaken),
    }).run();

    await db.update(roomPlayers)
      .set({ score: sql`MAX(0, ${roomPlayers.score}) + ${scoreAwarded}` })
      .where(and(eq(roomPlayers.roomCode, roomCode), eq(roomPlayers.userId, currentUserId)))
      .run();
  } catch (err) {
    console.warn('[submit_live_answer] Local SQLite update fallback:', err.message);
  }

  // 7. Get updated total score
  let updatedPlayer = null;
  if (CONFIG.TURSO?.ENABLED) {
    try {
      updatedPlayer = await turso.get(
        'SELECT score FROM room_players WHERE room_code = ? AND user_id = ?',
        [roomCode, currentUserId]
      );
    } catch {}
  }
  if (!updatedPlayer) {
    updatedPlayer = await db
      .select({ score: roomPlayers.score })
      .from(roomPlayers)
      .where(and(eq(roomPlayers.roomCode, roomCode), eq(roomPlayers.userId, currentUserId)))
      .get();
  }

  const totalScore = Math.max(0, updatedPlayer?.score || 0);

  return {
    success: true,
    isCorrect,
    correctOptionId: trueCorrectId,
    scoreAwarded,
    totalScore,
    questionIndex,
  };
}
