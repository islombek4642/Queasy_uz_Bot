// tgcloud/endpoints/create_live_room.js
import { db } from 'sdk';
import { eq } from 'sdk/db';
import { liveRooms, roomPlayers, quizzes, questions } from '../schema.js';

export default async function (input, ctx) {
  const tgUser = ctx?.initData?.user;
  const currentUserId = tgUser?.id || 0;
  const rawName = [tgUser?.first_name, tgUser?.last_name].filter(Boolean).join(' ') || tgUser?.username || 'Boshlovchi';
  const userName = rawName.slice(0, 50);

  const quizId = parseInt(input?.quizId, 10) || 0;
  if (!quizId) {
    return { success: false, error: 'INVALID_QUIZ_ID' };
  }

  // 1. Fetch quiz
  const quiz = await db.select({
    id: quizzes.id,
    title: quizzes.title,
    timeLimit: quizzes.timeLimit,
  }).from(quizzes).where(eq(quizzes.id, quizId)).get();

  if (!quiz) {
    return { success: false, error: 'QUIZ_NOT_FOUND' };
  }

  const qCount = await db.$count(questions, eq(questions.quizId, quizId));
  if (!qCount || qCount === 0) {
    return { success: false, error: 'QUIZ_HAS_NO_QUESTIONS' };
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
      userName: `${userName} (Host)`,
      score: -1,
    }).run();
  }

  const botUsername = 'Queasy_uz_Bot';
  const shareLink = `https://t.me/${botUsername}/app?startapp=room_${roomCode}`;
  const shareText = `⚡ "${quiz.title}" bo'yicha jonli xona (Live Room) ochildi!\n🔑 PIN kod: ${roomCode}\n🎮 Qo'shilish uchun havola:`;
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
