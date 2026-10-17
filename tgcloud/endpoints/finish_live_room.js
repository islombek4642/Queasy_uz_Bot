// tgcloud/endpoints/finish_live_room.js
import { db } from 'sdk';
import { eq } from 'sdk/db';
import { liveRooms } from '../schema.js';
import { CONFIG } from '../lib/constants/config.js';
import turso from '../lib/turso_client.js';

export default async function (input, ctx) {
  const currentUserId = ctx?.initData?.user?.id ? Number(ctx.initData.user.id) : 0;
  const roomCode = String(input?.roomCode || '').trim();

  if (!roomCode) {
    return { success: false, error: 'MISSING_ROOM_CODE' };
  }

  // 1. Fetch room
  let room = null;
  if (CONFIG.TURSO?.ENABLED) {
    try {
      room = await turso.get('SELECT id, host_id as hostId, status FROM live_rooms WHERE room_code = ?', [roomCode]);
    } catch (err) {
      console.warn('[finish_live_room] Turso fetch fallback:', err.message);
    }
  }

  if (!room) {
    room = await db
      .select({ id: liveRooms.id, hostId: liveRooms.hostId, status: liveRooms.status })
      .from(liveRooms)
      .where(eq(liveRooms.roomCode, roomCode))
      .get();
  }

  if (!room) {
    return { success: false, error: 'ROOM_NOT_FOUND' };
  }

  // 2. Enforce host authorization
  if (!currentUserId || Number(room.hostId) !== currentUserId) {
    return { success: false, error: 'NOT_HOST' };
  }

  // 3. Mark room as finished in Turso and local db
  if (CONFIG.TURSO?.ENABLED) {
    try {
      await turso.run('UPDATE live_rooms SET status = "finished" WHERE id = ?', [room.id]);
    } catch (err) {
      console.warn('[finish_live_room] Turso liveRooms update fallback:', err.message);
    }
  }

  try {
    await db
      .update(liveRooms)
      .set({
        status: 'finished',
      })
      .where(eq(liveRooms.id, room.id))
      .run();
  } catch {}

  return {
    success: true,
    roomCode,
    status: 'finished',
  };
}
