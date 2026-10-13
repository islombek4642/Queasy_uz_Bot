// tgcloud/endpoints/submit_live_room_result.js
import { db } from 'sdk';
import { eq, and, desc, asc } from 'sdk/db';
import { liveRooms, roomPlayers } from '../schema.js';

export default async function (input, ctx) {
  const tgUser = ctx?.initData?.user;
  const currentUserId = tgUser?.id || 0;
  const rawName = [tgUser?.first_name, tgUser?.last_name].filter(Boolean).join(' ') || tgUser?.username || "O'yinchi";
  const userName = rawName.slice(0, 50);

  const roomCode = String(input?.roomCode || '').trim();
  const score = parseInt(input?.score, 10) || 0;
  const totalQuestions = parseInt(input?.totalQuestions, 10) || 0;
  const totalTimeSeconds = parseInt(input?.totalTimeSeconds, 10) || 0;

  if (!roomCode) {
    return { success: false, error: 'MISSING_ROOM_CODE' };
  }

  // 1. Verify room exists
  const room = await db
    .select({ id: liveRooms.id, status: liveRooms.status })
    .from(liveRooms)
    .where(eq(liveRooms.roomCode, roomCode))
    .get();

  if (!room) {
    return { success: false, error: 'ROOM_NOT_FOUND' };
  }

  // 2. Find existing player in room
  let existing = null;
  if (currentUserId) {
    existing = await db
      .select({ id: roomPlayers.id, score: roomPlayers.score })
      .from(roomPlayers)
      .where(and(eq(roomPlayers.roomCode, roomCode), eq(roomPlayers.userId, currentUserId)))
      .get();
  }

  if (existing) {
    await db
      .update(roomPlayers)
      .set({
        score,
        userName,
      })
      .where(eq(roomPlayers.id, existing.id))
      .run();
  } else {
    await db
      .insert(roomPlayers)
      .values({
        roomCode,
        userId: currentUserId,
        userName,
        score,
      })
      .run();
  }

  // 3. Calculate rank
  const allPlayers = await db
    .select({
      id: roomPlayers.id,
      userId: roomPlayers.userId,
      userName: roomPlayers.userName,
      score: roomPlayers.score,
    })
    .from(roomPlayers)
    .where(eq(roomPlayers.roomCode, roomCode))
    .orderBy(desc(roomPlayers.score), asc(roomPlayers.id))
    .all();

  const rankIdx = (allPlayers || []).findIndex((p) =>
    currentUserId ? p.userId === currentUserId : p.userName === userName
  );
  const rank = rankIdx !== -1 ? rankIdx + 1 : (allPlayers || []).length;

  return {
    success: true,
    roomCode,
    rank,
    score,
    totalQuestions,
    totalTimeSeconds,
    totalPlayers: (allPlayers || []).length,
  };
}
