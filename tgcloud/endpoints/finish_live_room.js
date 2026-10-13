// tgcloud/endpoints/finish_live_room.js
import { db } from 'sdk';
import { eq } from 'sdk/db';
import { liveRooms } from '../schema.js';

export default async function (input, ctx) {
  const currentUserId = ctx?.initData?.user?.id;
  const roomCode = String(input?.roomCode || '').trim();

  if (!roomCode) {
    return { success: false, error: 'MISSING_ROOM_CODE' };
  }

  // 1. Fetch room
  const room = await db
    .select({ id: liveRooms.id, hostId: liveRooms.hostId, status: liveRooms.status })
    .from(liveRooms)
    .where(eq(liveRooms.roomCode, roomCode))
    .get();

  if (!room) {
    return { success: false, error: 'ROOM_NOT_FOUND' };
  }

  // 2. Enforce host authorization
  if (!currentUserId || room.hostId !== currentUserId) {
    return { success: false, error: 'NOT_HOST' };
  }

  // 3. Mark room as finished
  await db
    .update(liveRooms)
    .set({
      status: 'finished',
    })
    .where(eq(liveRooms.id, room.id))
    .run();

  return {
    success: true,
    roomCode,
    status: 'finished',
  };
}
