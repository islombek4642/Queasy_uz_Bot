// tgcloud/endpoints/start_live_room.js
import { db } from 'sdk';
import { eq, and } from 'sdk/db';
import { liveRooms, botSettings } from '../schema.js';

export default async function (input, ctx) {
  const currentUserId = ctx?.initData?.user?.id || 0;
  const roomCode = String(input?.roomCode || '').trim();

  if (!roomCode) {
    return { success: false, error: 'MISSING_ROOM_CODE' };
  }

  // Verify host
  const room = await db
    .select({ id: liveRooms.id, hostId: liveRooms.hostId })
    .from(liveRooms)
    .where(eq(liveRooms.roomCode, roomCode))
    .get();

  if (!room) {
    return { success: false, error: 'ROOM_NOT_FOUND' };
  }

  // Enforce host authorization
  if (!currentUserId || room.hostId !== currentUserId) {
    return { success: false, error: 'NOT_HOST' };
  }

  // Save modeConfig if provided by host (e.g. range, randomCount, mode)
  const modeConfig = input?.modeConfig;
  if (modeConfig && typeof modeConfig === 'object') {
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
  }

  // Update room status to active
  await db
    .update(liveRooms)
    .set({
      status: 'active',
      currentQuestionIndex: 0,
    })
    .where(eq(liveRooms.id, room.id))
    .run();

  return { success: true, roomCode, status: 'active', modeConfig: modeConfig || null };
}
