// tgcloud/endpoints/start_live_room.js
import { db } from 'sdk';
import { eq, and } from 'sdk/db';
import { liveRooms, roomPlayers, quizzes, questions, botSettings } from '../schema.js';
import { CONFIG } from '../lib/constants/config.js';
import { getMessage } from '../lib/constants/messages.js';
import turso from '../lib/turso_client.js';

export default async function (input, ctx) {
  const currentUserId = ctx?.initData?.user?.id ? Number(ctx.initData.user.id) : 0;
  const userLang = (input?.lang || ctx?.initData?.user?.language_code || 'uz').toUpperCase().slice(0, 2);
  const roomCode = String(input?.roomCode || '').trim();

  if (!roomCode) {
    return { success: false, error: 'MISSING_ROOM_CODE' };
  }

  // 1. Verify host via Turso or local db
  let room = null;
  if (CONFIG.TURSO?.ENABLED) {
    try {
      room = await turso.get('SELECT id, quiz_id as quizId, host_id as hostId FROM live_rooms WHERE room_code = ?', [roomCode]);
    } catch (err) {
      console.warn('[start_live_room] Turso fetch fallback:', err.message);
    }
  }

  if (!room) {
    room = await db
      .select({ id: liveRooms.id, quizId: liveRooms.quizId, hostId: liveRooms.hostId })
      .from(liveRooms)
      .where(eq(liveRooms.roomCode, roomCode))
      .get();
  }

  if (!room) {
    return { success: false, error: 'ROOM_NOT_FOUND' };
  }

  // Enforce host authorization
  if (!currentUserId || Number(room.hostId) !== currentUserId) {
    return { success: false, error: 'NOT_HOST' };
  }

  // 2. Fetch room players to enforce minimum player & ready counts
  let rawPlayers = [];
  if (CONFIG.TURSO?.ENABLED) {
    try {
      rawPlayers = await turso.all('SELECT user_id as userId FROM room_players WHERE room_code = ?', [roomCode]);
    } catch {}
  }

  if (!rawPlayers || rawPlayers.length === 0) {
    try {
      rawPlayers = await db
        .select({ userId: roomPlayers.userId })
        .from(roomPlayers)
        .where(eq(roomPlayers.roomCode, roomCode))
        .all();
    } catch {}
  }

  if ((rawPlayers || []).length < 2) {
    return {
      success: false,
      error: 'MIN_PLAYERS_REQUIRED',
      message: getMessage('ERROR_MIN_PLAYERS', userLang),
    };
  }

  // Check ready players
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

  const readyCount = (rawPlayers || []).filter((p) => {
    if (Number(p.userId) === Number(room.hostId)) return true; // host is always ready
    return Boolean(readyMap.get(Number(p.userId)));
  }).length;

  if (readyCount < 2) {
    return {
      success: false,
      error: 'MIN_READY_REQUIRED',
      message: getMessage('ERROR_MIN_READY', userLang),
    };
  }

  // 3. Save modeConfig if provided by host (e.g. range, randomCount, mode, timeLimit)
  const modeConfig = input?.modeConfig;
  if (modeConfig && typeof modeConfig === 'object') {
    if (CONFIG.TURSO?.ENABLED) {
      try {
        await turso.run(
          'INSERT INTO bot_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
          [`live_room_cfg:${roomCode}`, JSON.stringify(modeConfig)]
        );
      } catch (err) {
        console.warn('[start_live_room] Turso botSettings fallback:', err.message);
      }
    }

    try {
      await db
        .insert(botSettings)
        .values({
          key: `live_room_cfg:${roomCode}`,
          value: JSON.stringify(modeConfig),
        })
        .onConflictDoUpdate({
          target: botSettings.key,
          set: { value: JSON.stringify(modeConfig) },
        })
        .run();
    } catch {}
  }

  // 4. Calculate total questions for this game
  let totalQuestions = 10;
  if (modeConfig?.mode === 'range' && Array.isArray(modeConfig.range) && modeConfig.range.length === 2) {
    totalQuestions = Math.max(1, modeConfig.range[1] - modeConfig.range[0] + 1);
  } else if (modeConfig?.mode === 'random' && modeConfig.randomCount) {
    totalQuestions = Math.max(1, Number(modeConfig.randomCount));
  } else {
    // count from questions table
    if (CONFIG.TURSO?.ENABLED) {
      try {
        const cRow = await turso.get('SELECT count(*) as count FROM questions WHERE quiz_id = ?', [room.quizId]);
        if (cRow?.count) totalQuestions = Number(cRow.count);
      } catch {}
    }
  }

  const timeLimit = Number(modeConfig?.timeLimit) || CONFIG.POLL.DEFAULT_TIME_LIMIT;

  // 5. Initialize synchronized game clock
  const gameClock = {
    gameStartedAt: Math.floor(Date.now() / 1000),
    timeLimit,
    revealSeconds: 4,
    countdownSeconds: 3,
    totalQuestions,
  };

  if (CONFIG.TURSO?.ENABLED) {
    try {
      await turso.run(
        'INSERT INTO bot_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
        [`live_room_game:${roomCode}`, JSON.stringify(gameClock)]
      );
    } catch {}
  }

  try {
    await db
      .insert(botSettings)
      .values({
        key: `live_room_game:${roomCode}`,
        value: JSON.stringify(gameClock),
      })
      .onConflictDoUpdate({
        target: botSettings.key,
        set: { value: JSON.stringify(gameClock) },
      })
      .run();
  } catch {}

  // 6. Update room status to active in Turso and local db
  if (CONFIG.TURSO?.ENABLED) {
    try {
      await turso.run(
        'UPDATE live_rooms SET status = "active", current_question_index = 0 WHERE id = ?',
        [room.id]
      );
    } catch (err) {
      console.warn('[start_live_room] Turso liveRooms update fallback:', err.message);
    }
  }

  try {
    await db
      .update(liveRooms)
      .set({
        status: 'active',
        currentQuestionIndex: 0,
      })
      .where(eq(liveRooms.id, room.id))
      .run();
  } catch {}

  return { success: true, roomCode, status: 'active', modeConfig: modeConfig || null };
}
