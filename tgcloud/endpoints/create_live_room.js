// tgcloud/endpoints/create_live_room.js
import { db } from 'sdk';
import { eq } from 'sdk/db';
import { liveRooms, roomPlayers, quizzes, questions } from '../schema.js';
import { CONFIG } from '../lib/constants/config.js';
import { ERRORS } from '../lib/constants/errors.js';
import { getMessage } from '../lib/constants/messages.js';

export default async function (input, ctx) {
  const tgUser = ctx?.initData?.user;
  const currentUserId = tgUser?.id || 0;
  const defaultHostName = getMessage('ROLE_HOST', 'UZ');
  const rawName = [tgUser?.first_name, tgUser?.last_name].filter(Boolean).join(' ') || tgUser?.username || defaultHostName;
  const userName = rawName.slice(0, 50);

  const quizId = parseInt(input?.quizId, 10) || 0;
  if (!quizId) {
    return { success: false, error: ERRORS.INVALID_QUIZ_ID };
  }

  // 1. Fetch quiz
  const quiz = await db.select({
    id: quizzes.id,
    title: quizzes.title,
    timeLimit: quizzes.timeLimit,
  }).from(quizzes).where(eq(quizzes.id, quizId)).get();

  if (!quiz) {
    return { success: false, error: ERRORS.QUIZ_NOT_FOUND };
  }

  const qCount = await db.$count(questions, eq(questions.quizId, quizId));
  if (!qCount || qCount === 0) {
    return { success: false, error: ERRORS.QUIZ_HAS_NO_QUESTIONS };
  }

  // 2. Generate 6-digit room code
  const roomCode = Math.floor(100000 + Math.random() * 900000).toString();

  // 3. Insert live room
  const roomRes = await db.insert(liveRooms).values({
    roomCode,
    quizId,
    hostId: currentUserId,
    status: 'waiting',
    currentQuestionIndex: 0,
  }).run();

  // 4. Insert host into room players
  if (currentUserId) {
    await db.insert(roomPlayers).values({
      roomCode,
      userId: currentUserId,
      userName: `${userName} (${defaultHostName})`,
      score: -1,
    }).run();
  }

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
