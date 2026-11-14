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
  const currentUserId = Number(tgUser?.id) || 0;
  const userLang = (input?.lang || tgUser?.language_code || 'uz').toUpperCase().slice(0, 2);
  const defaultPlayerName = getMessage('ROLE_PLAYER', userLang);
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

  // 2. Fetch existing players to check capacity (max 10 players)
  let rawPlayers = [];
  if (CONFIG.TURSO?.ENABLED) {
    try {
      rawPlayers = await turso.all(
        'SELECT id, user_id as userId, user_name as userName, score FROM room_players WHERE room_code = ? ORDER BY score DESC, id ASC',
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

  const existingPlayer = (rawPlayers || []).find((p) => Number(p.userId) === currentUserId);

  // If user is not yet in room, check max 10 players limit
  if (currentUserId && !existingPlayer) {
    if ((rawPlayers || []).length >= 10) {
      return {
        success: false,
        error: 'ROOM_FULL',
        message: getMessage('ERROR_ROOM_FULL', userLang),
      };
    }

    // Add new player to room
    if (CONFIG.TURSO?.ENABLED) {
      try {
        await turso.run(
          'INSERT INTO room_players (room_code, user_id, user_name, score, joined_at) VALUES (?, ?, ?, -1, unixepoch())',
          [roomCode, currentUserId, userName]
        );
      } catch {}
    }

    try {
      await db.insert(roomPlayers).values({
        roomCode,
        userId: currentUserId,
        userName,
        score: -1,
      }).run();
    } catch {}

    // Refresh rawPlayers list
    rawPlayers.push({
      id: Date.now(),
      userId: currentUserId,
      userName,
      score: -1,
    });
  }

  // 3. Fetch quiz details
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

  // 4. Fetch host's modeConfig if set (e.g. range, randomCount, mode, timeLimit)
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

  // Calculate total questions for this game session
  let sessionTotalQuestions = Number(qCount || 0);
  if (modeConfig?.mode === 'range' && Array.isArray(modeConfig.range) && modeConfig.range.length === 2) {
    sessionTotalQuestions = Math.max(1, modeConfig.range[1] - modeConfig.range[0] + 1);
  } else if (modeConfig?.mode === 'random' && modeConfig.randomCount) {
    sessionTotalQuestions = Math.min(sessionTotalQuestions || 10, Number(modeConfig.randomCount));
  }

  // 5. Synchronized Game Round Clock
  let roundPhase = room.status === 'active' ? 'answering' : 'lobby';
  let timeRemaining = Number(modeConfig?.timeLimit) || quiz?.timeLimit || CONFIG.POLL.DEFAULT_TIME_LIMIT;
  let revealRemaining = 0;

  if (room.status === 'active') {
    let gameClock = null;
    if (CONFIG.TURSO?.ENABLED) {
      try {
        const row = await turso.get('SELECT value FROM bot_settings WHERE key = ?', [`live_room_game:${roomCode}`]);
        if (row?.value) gameClock = JSON.parse(row.value);
      } catch {}
    }
    if (!gameClock) {
      const gSetting = await db
        .select({ value: botSettings.value })
        .from(botSettings)
        .where(eq(botSettings.key, `live_room_game:${roomCode}`))
        .get();
      if (gSetting?.value) {
        try { gameClock = JSON.parse(gSetting.value); } catch {}
      }
    }

    if (gameClock && gameClock.gameStartedAt) {
      const now = Math.floor(Date.now() / 1000);
      const elapsedTotal = Math.max(0, now - Number(gameClock.gameStartedAt));
      const countdownSec = Number(gameClock.countdownSeconds) || 3;
      const qTimeLimit = Number(gameClock.timeLimit) || timeRemaining;
      const revealSec = Number(gameClock.revealSeconds) || 4;
      const roundDuration = qTimeLimit + revealSec;
      const totalQ = Number(gameClock.totalQuestions) || sessionTotalQuestions || 1;

      if (elapsedTotal < countdownSec) {
        roundPhase = 'countdown';
        timeRemaining = countdownSec - elapsedTotal;
        room.currentQuestionIndex = 0;
      } else {
        const elapsedInGame = elapsedTotal - countdownSec;
        const currentIdx = Math.floor(elapsedInGame / roundDuration);
        const secondsIntoRound = elapsedInGame % roundDuration;

        if (currentIdx >= totalQ) {
          room.status = 'finished';
          roundPhase = 'finished';
          timeRemaining = 0;
          revealRemaining = 0;

          // Auto-mark finished in DB
          if (CONFIG.TURSO?.ENABLED) {
            try {
              await turso.run('UPDATE live_rooms SET status = "finished" WHERE id = ?', [room.id]);
            } catch {}
          }
          try {
            await db.update(liveRooms).set({ status: 'finished' }).where(eq(liveRooms.id, room.id)).run();
          } catch {}
        } else {
          if (secondsIntoRound < qTimeLimit) {
            roundPhase = 'answering';
            timeRemaining = qTimeLimit - secondsIntoRound;
            revealRemaining = 0;
          } else {
            roundPhase = 'revealing';
            timeRemaining = 0;
            revealRemaining = roundDuration - secondsIntoRound;
          }

          if (room.currentQuestionIndex !== currentIdx) {
            room.currentQuestionIndex = currentIdx;
            if (CONFIG.TURSO?.ENABLED) {
              try {
                await turso.run('UPDATE live_rooms SET current_question_index = ? WHERE id = ?', [currentIdx, room.id]);
              } catch {}
            }
            try {
              await db.update(liveRooms).set({ currentQuestionIndex: currentIdx }).where(eq(liveRooms.id, room.id)).run();
            } catch {}
          }
        }
      }
    }
  }

  // 6. Fetch player readiness status
  const readyMap = new Map();
  if (CONFIG.TURSO?.ENABLED) {
    try {
      const readyRows = await turso.all(
        'SELECT key, value FROM bot_settings WHERE key LIKE ?',
        [`live_ready:${roomCode}:%`]
      );
      for (const r of readyRows || []) {
        const uid = Number(r.key.split(':').pop());
        if (uid) readyMap.set(uid, r.value === '1');
      }
    } catch {}
  }

  const isRoomFinished = room.status === 'finished';
  const formattedPlayers = (rawPlayers || []).map((p, idx) => {
    const isPlayerHost = Number(p.userId) === Number(room.hostId);
    const isReady = isPlayerHost ? true : Boolean(readyMap.get(Number(p.userId)));

    return {
      ...p,
      userName: p.userName || defaultPlayerName,
      score: Math.max(0, p.score || 0),
      isReady,
      hasFinished: isRoomFinished,
      rank: idx + 1,
      isCurrentUser: currentUserId ? Number(p.userId) === currentUserId : p.userName === userName,
    };
  });

  const readyCount = formattedPlayers.filter((p) => p.isReady).length;
  const canStart = formattedPlayers.length >= 2 && readyCount >= 2;
  const hasFinished = isRoomFinished;

  return {
    success: true,
    room: {
      roomCode: room.roomCode,
      status: room.status,
      currentQuestionIndex: room.currentQuestionIndex,
      roundPhase,
      timeRemaining,
      revealRemaining,
      isHost,
      isFinished: room.status === 'finished',
      shareLink: `https://t.me/${CONFIG.BOT.USERNAME}/app?startapp=battle_${room.roomCode}`,
    },
    quiz: {
      id: quiz?.id || room.quizId,
      title: quiz?.title || getMessage('DEFAULT_LIVE_QUIZ', userLang),
      timeLimit: Number(modeConfig?.timeLimit) || quiz?.timeLimit || CONFIG.POLL.DEFAULT_TIME_LIMIT,
      questionCount: sessionTotalQuestions,
    },
    players: formattedPlayers,
    hasFinished,
    modeConfig,
    totalPlayers: formattedPlayers.length,
    readyCount,
    canStart,
    maxPlayers: 10,
  };
}
