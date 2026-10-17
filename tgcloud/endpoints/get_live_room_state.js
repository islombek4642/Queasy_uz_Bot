// tgcloud/endpoints/get_live_room_state.js
import { db } from 'sdk';
import { eq, desc, and } from 'sdk/db';
import { liveRooms, roomPlayers, quizzes, questions, botSettings } from '../schema.js';
import { CONFIG } from '../lib/constants/config.js';
import { ERRORS } from '../lib/constants/errors.js';
import { getMessage } from '../lib/constants/messages.js';
import turso from '../lib/turso_client.js';

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
  let room = null;
  if (CONFIG.TURSO?.ENABLED) {
    try {
      const r = await turso.get('SELECT * FROM live_rooms WHERE room_code = ?', [roomCode]);
      if (r) {
        room = {
          id: Number(r.id),
          roomCode: r.room_code,
          quizId: Number(r.quiz_id),
          hostId: Number(r.host_id),
          status: r.status,
          currentQuestionIndex: Number(r.current_question_index),
          createdAt: r.created_at,
        };
      }
    } catch (err) {
      console.warn('[get_live_room_state] Turso room fetch fallback:', err.message);
    }
  }

  if (!room) {
    room = await db
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
  }

  if (!room) {
    return { success: false, error: ERRORS.ROOM_NOT_FOUND };
  }

  const isHost = currentUserId ? room.hostId === currentUserId : false;

  // 2. If user is not yet in roomPlayers and has userId, add them
  if (currentUserId && CONFIG.TURSO?.ENABLED) {
    try {
      const existingPlayer = await turso.get(
        'SELECT id FROM room_players WHERE room_code = ? AND user_id = ?',
        [roomCode, currentUserId]
      );
      if (!existingPlayer) {
        await turso.run(
          'INSERT INTO room_players (room_code, user_id, user_name, score, joined_at) VALUES (?, ?, ?, -1, unixepoch())',
          [roomCode, currentUserId, userName]
        );
      }
    } catch {}
  }

  if (currentUserId) {
    try {
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
    } catch {}
  }

  // 3. Fetch all players
  let rawPlayers = [];
  if (CONFIG.TURSO?.ENABLED) {
    try {
      rawPlayers = await turso.all(
        'SELECT id, user_id as userId, user_name as userName, score FROM room_players WHERE room_code = ? ORDER BY score DESC',
        [roomCode]
      );
    } catch (err) {
      console.warn('[get_live_room_state] Turso players fetch fallback:', err.message);
    }
  }

  if (!rawPlayers || rawPlayers.length === 0) {
    try {
      rawPlayers = await db
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
    } catch {}
  }

  // 4. Fetch quiz details
  let quiz = null;
  let qCount = 0;

  if (CONFIG.TURSO?.ENABLED) {
    try {
      quiz = await turso.get('SELECT id, title, time_limit as timeLimit FROM quizzes WHERE id = ?', [room.quizId]);
      if (quiz) {
        const cRow = await turso.get('SELECT count(*) as count FROM questions WHERE quiz_id = ?', [room.quizId]);
        qCount = Number(cRow?.count || 0);
      }
    } catch (err) {
      console.warn('[get_live_room_state] Turso fetch fallback:', err.message);
    }
  }

  if (!quiz) {
    quiz = await db
      .select({
        id: quizzes.id,
        title: quizzes.title,
        timeLimit: quizzes.timeLimit,
      })
      .from(quizzes)
      .where(eq(quizzes.id, room.quizId))
      .get();

    if (quiz) {
      qCount = await db.$count(questions, eq(questions.quizId, room.quizId));
    }
  }

  const formattedPlayers = (rawPlayers || []).map((p, idx) => ({
    ...p,
    score: Math.max(0, p.score || 0),
    hasFinished: p.score >= 0,
    rank: idx + 1,
    isCurrentUser: currentUserId ? p.userId === currentUserId : p.userName === userName,
  }));

  const currentPlayer = formattedPlayers.find((p) => p.isCurrentUser);
  const hasFinished = Boolean(currentPlayer?.hasFinished || room.status === 'finished');

  // Fetch host's modeConfig if set (e.g. range, randomCount, mode)
  let modeConfig = null;
  if (CONFIG.TURSO?.ENABLED) {
    try {
      const row = await turso.get('SELECT value FROM bot_settings WHERE key = ?', [`live_room_cfg:${roomCode}`]);
      if (row?.value) {
        modeConfig = JSON.parse(row.value);
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
    modeConfig,
    totalPlayers: formattedPlayers.length,
  };
}
