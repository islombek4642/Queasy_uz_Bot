// tgcloud/endpoints/toggle_live_ready.js
import { db } from 'sdk';
import { eq, and } from 'sdk/db';
import { liveRooms, roomPlayers, botSettings } from '../schema.js';
import { CONFIG } from '../lib/constants/config.js';
import { ERRORS } from '../lib/constants/errors.js';
import turso from '../lib/turso_client.js';

export default async function (input, ctx) {
  const currentUserId = ctx?.initData?.user?.id ? Number(ctx.initData.user.id) : 0;
  const roomCode = String(input?.roomCode || '').trim();
  const isReady = Boolean(input?.isReady);

  if (!currentUserId) {
    return { success: false, error: ERRORS.UNAUTHORIZED };
  }
  if (!roomCode) {
    return { success: false, error: ERRORS.MISSING_ROOM_CODE };
  }

  // 1. Verify player is in room
  let player = null;
  if (CONFIG.TURSO?.ENABLED) {
    try {
      player = await turso.get('SELECT id FROM room_players WHERE room_code = ? AND user_id = ?', [roomCode, currentUserId]);
    } catch {}
  }
  if (!player) {
    try {
      player = await db
        .select({ id: roomPlayers.id })
        .from(roomPlayers)
        .where(and(eq(roomPlayers.roomCode, roomCode), eq(roomPlayers.userId, currentUserId)))
        .get();
    } catch {}
  }

  if (!player) {
    return { success: false, error: 'PLAYER_NOT_IN_ROOM' };
  }

  // 2. Persist readiness in bot_settings (and room_players where supported)
  const readyKey = `live_ready:${roomCode}:${currentUserId}`;
  const readyVal = isReady ? '1' : '0';

  if (CONFIG.TURSO?.ENABLED) {
    try {
      await turso.run(
        'INSERT INTO bot_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
        [readyKey, readyVal]
      );
      await turso.run(
        'UPDATE room_players SET is_ready = ? WHERE room_code = ? AND user_id = ?',
        [isReady ? 1 : 0, roomCode, currentUserId]
      );
    } catch (err) {
      console.warn('[toggle_live_ready] Turso fallback:', err.message);
    }
  }

  try {
    await db
      .insert(botSettings)
      .values({ key: readyKey, value: readyVal })
      .onConflictDoUpdate({
        target: botSettings.key,
        set: { value: readyVal },
      })
      .run();
  } catch {}

  try {
    await db
      .update(roomPlayers)
      .set({ isReady: isReady ? 1 : 0 })
      .where(and(eq(roomPlayers.roomCode, roomCode), eq(roomPlayers.userId, currentUserId)))
      .run();
  } catch {}

  return {
    success: true,
    roomCode,
    userId: currentUserId,
    isReady,
  };
}
