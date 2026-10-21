// tgcloud/endpoints/create_live_room.js
import { db } from 'sdk';
import { eq } from 'sdk/db';
import { liveRooms, roomPlayers, quizzes, questions } from '../schema.js';
import { CONFIG } from '../lib/constants/config.js';
import { ERRORS } from '../lib/constants/errors.js';
import { getMessage } from '../lib/constants/messages.js';
import turso from '../lib/turso_client.js';

export default async function (input, ctx) {
  const tgUser = ctx?.initData?.user;
  const currentUserId = Number(tgUser?.id) || 0;

  if (!currentUserId) {
    return { success: false, error: ERRORS.UNAUTHORIZED };
  }

  const defaultHostName = getMessage('ROLE_HOST', 'UZ');
  const rawName = [tgUser?.first_name, tgUser?.last_name].filter(Boolean).join(' ') || tgUser?.username || defaultHostName;
  const userName = rawName.slice(0, 50);

  const quizId = parseInt(input?.quizId, 10) || 0;
  if (!quizId) {
    return { success: false, error: ERRORS.INVALID_QUIZ_ID };
  }

  // 1. Fetch quiz
  let quiz = null;
  let qCount = 0;

  if (CONFIG.TURSO?.ENABLED) {
    try {
      quiz = await turso.get('SELECT id, title, time_limit as timeLimit FROM quizzes WHERE id = ?', [quizId]);
      if (quiz) {
        const cRow = await turso.get('SELECT count(*) as count FROM questions WHERE quiz_id = ?', [quizId]);
        qCount = Number(cRow?.count || 0);
      }
    } catch (err) {
      console.warn('[create_live_room] Turso fetch fallback:', err.message);
    }
  }

  if (!quiz) {
    quiz = await db.select({
      id: quizzes.id,
      title: quizzes.title,
      timeLimit: quizzes.timeLimit,
    }).from(quizzes).where(eq(quizzes.id, quizId)).get();

    if (quiz) {
      qCount = await db.$count(questions, eq(questions.quizId, quizId));
    }
  }

  if (!quiz) {
    return { success: false, error: ERRORS.QUIZ_NOT_FOUND };
  }

  if (!qCount || qCount === 0) {
    return { success: false, error: ERRORS.QUIZ_HAS_NO_QUESTIONS };
  }

  // 2. Generate 6-digit room code
  const roomCode = Math.floor(100000 + Math.random() * 900000).toString();

  // 3. Insert live room (Turso & local db)
  if (CONFIG.TURSO?.ENABLED) {
    try {
      await turso.run(
        'INSERT INTO live_rooms (room_code, quiz_id, host_id, status, current_question_index, created_at) VALUES (?, ?, ?, ?, ?, unixepoch())',
        [roomCode, quizId, currentUserId, 'waiting', 0]
      );
      if (currentUserId) {
        await turso.run(
          'INSERT INTO room_players (room_code, user_id, user_name, score, joined_at) VALUES (?, ?, ?, -1, unixepoch())',
          [roomCode, currentUserId, `${userName} (${defaultHostName})`]
        );
      }
    } catch (err) {
      console.warn('[create_live_room] Turso liveRooms insert fallback:', err.message);
    }
  }

  try {
    await db.insert(liveRooms).values({
      roomCode,
      quizId,
      hostId: currentUserId,
      status: 'waiting',
      currentQuestionIndex: 0,
    }).run();

    if (currentUserId) {
      await db.insert(roomPlayers).values({
        roomCode,
        userId: currentUserId,
        userName: `${userName} (${defaultHostName})`,
        score: -1,
      }).run();
    }
  } catch {}

  const botUsername = CONFIG.BOT.USERNAME;
  const shareLink = `https://t.me/${botUsername}/app?startapp=room_${roomCode}`;
  const shareText = getMessage('LIVE_ROOM_INVITE_TEXT', 'UZ', { title: quiz.title, pin: roomCode });
  const telegramShareUrl = `https://t.me/share/url?url=${encodeURIComponent(shareLink)}&text=${encodeURIComponent(shareText)}`;

  return {
    success: true,
    roomCode,
    quizId,
    quizTitle: quiz.title,
    questionCount: qCount,
    shareLink,
    telegramShareUrl,
    isHost: true,
  };
}
