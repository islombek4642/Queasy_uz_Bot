// tgcloud/endpoints/get_live_room_state.js
import { db } from 'sdk';
import { eq, desc, and } from 'sdk/db';
import { liveRooms, roomPlayers, quizzes, questions } from '../schema.js';
import { CONFIG } from '../lib/constants/config.js';
import { ERRORS } from '../lib/constants/errors.js';
import { getMessage } from '../lib/constants/messages.js';

export default async function (input, ctx) {
  const tgUser = ctx?.initData?.user;
  const currentUserId = tgUser?.id || 0;
  const defaultPlayerName = getMessage('ROLE_PLAYER', 'UZ');
  const rawName = [tgUser?.first_name, tgUser?.last_name].filter(Boolean).join(' ') || tgUser?.username || defaultPlayerName;
  const userName = rawName.slice(0, 50);

  const roomCode = String(input?.roomCode || '').trim();
  if (!roomCode) {
    return { success: false, error: ERRORS.MISSING_ROOM_CODE };
  }

  // 1. Fetch room
  const room = await db
    .select({
      id: liveRooms.id,
      roomCode: liveRooms.roomCode,
      quizId: liveRooms.quizId,
      hostId: liveRooms.hostId,
      status: liveRooms.status,
      currentQuestionIndex: liveRooms.currentQuestionIndex,
      createdAt: liveRooms.createdAt,
    })
    .from(liveRooms)
    .where(eq(liveRooms.roomCode, roomCode))
    .get();

  if (!room) {
    return { success: false, error: ERRORS.ROOM_NOT_FOUND };
  }

  const isHost = currentUserId ? room.hostId === currentUserId : false;

  // 2. If user is not yet in roomPlayers and has userId, add them
  if (currentUserId) {
    const existingPlayer = await db
      .select({ id: roomPlayers.id })
      .from(roomPlayers)
      .where(and(eq(roomPlayers.roomCode, roomCode), eq(roomPlayers.userId, currentUserId)))
      .get();

    if (!existingPlayer) {
      await db.insert(roomPlayers).values({
        roomCode,
        userId: currentUserId,
        userName,
        score: -1,
      }).run();
    }
  }

  // 3. Fetch all players
  const rawPlayers = await db
    .select({
      id: roomPlayers.id,
      userId: roomPlayers.userId,
      userName: roomPlayers.userName,
      score: roomPlayers.score,
    })
    .from(roomPlayers)
    .where(eq(roomPlayers.roomCode, roomCode))
    .orderBy(desc(roomPlayers.score))
    .all();

  // 4. Fetch quiz details
  const quiz = await db
    .select({
      id: quizzes.id,
      title: quizzes.title,
      timeLimit: quizzes.timeLimit,
    })
    .from(quizzes)
    .where(eq(quizzes.id, room.quizId))
    .get();

  const qCount = await db.$count(questions, eq(questions.quizId, room.quizId));

  const formattedPlayers = (rawPlayers || []).map((p, idx) => ({
    ...p,
    score: Math.max(0, p.score || 0),
    hasFinished: p.score >= 0,
    rank: idx + 1,
    isCurrentUser: currentUserId ? p.userId === currentUserId : p.userName === userName,
  }));

  const currentPlayer = formattedPlayers.find((p) => p.isCurrentUser);
  const hasFinished = Boolean(currentPlayer?.hasFinished || room.status === 'finished');

  return {
    success: true,
    room: {
      roomCode: room.roomCode,
      status: room.status,
      currentQuestionIndex: room.currentQuestionIndex,
      isHost,
      isFinished: room.status === 'finished',
    },
    quiz: {
      id: quiz?.id || room.quizId,
      title: quiz?.title || getMessage('DEFAULT_LIVE_QUIZ', 'UZ'),
      timeLimit: quiz?.timeLimit || CONFIG.POLL.DEFAULT_TIME_LIMIT,
      questionCount: Number(qCount || 0),
    },
    players: formattedPlayers,
    hasFinished,
    totalPlayers: formattedPlayers.length,
  };
}
