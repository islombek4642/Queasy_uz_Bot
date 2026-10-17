// tgcloud/endpoints/start_live_room.js
import { db } from 'sdk';
import { eq, and } from 'sdk/db';
import { liveRooms, botSettings } from '../schema.js';
import { CONFIG } from '../lib/constants/config.js';
import turso from '../lib/turso_client.js';

export default async function (input, ctx) {
  const currentUserId = ctx?.initData?.user?.id ? Number(ctx.initData.user.id) : 0;
  const roomCode = String(input?.roomCode || '').trim();

  if (!roomCode) {
    return { success: false, error: 'MISSING_ROOM_CODE' };
  }

  // 1. Verify host via Turso
  let room = null;
  if (CONFIG.TURSO?.ENABLED) {
    try {
      room = await turso.get('SELECT id, host_id as hostId FROM live_rooms WHERE room_code = ?', [roomCode]);
    } catch (err) {
      console.warn('[start_live_room] Turso fetch fallback:', err.message);
    }
  }

  if (!room) {
    room = await db
      .select({ id: liveRooms.id, hostId: liveRooms.hostId })
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

  // Save modeConfig if provided by host (e.g. range, randomCount, mode)
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

  // Update room status to active in Turso and local db
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
