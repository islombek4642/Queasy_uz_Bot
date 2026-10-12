// tgcloud/endpoints/start_live_room.js
import { db } from 'sdk';
import { eq, and } from 'sdk/db';
import { liveRooms } from '../schema.js';

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

  // Update room status to active
  await db
    .update(liveRooms)
    .set({
      status: 'active',
      currentQuestionIndex: 0,
    })
    .where(eq(liveRooms.id, room.id))
    .run();

  return { success: true, roomCode, status: 'active' };
}
