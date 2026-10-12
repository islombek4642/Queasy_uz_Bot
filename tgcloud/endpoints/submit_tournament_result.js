// tgcloud/endpoints/submit_tournament_result.js
import { db } from 'sdk';
import { eq, and, desc, asc } from 'sdk/db';
import { groupTournaments, tournamentParticipants } from '../schema.js';

export default async function (input, ctx) {
  const tgUser = ctx?.initData?.user;
  const userId = tgUser?.id || 0;
  const shareCode = String(input?.shareCode || '').trim();
  const score = parseInt(input?.score, 10) || 0;
  const totalQuestions = parseInt(input?.totalQuestions, 10) || 0;
  const totalTimeSeconds = parseInt(input?.totalTimeSeconds, 10) || 0;

  if (!shareCode) {
    return { success: false, error: 'MISSING_SHARE_CODE' };
  }

  // 1. Fetch tournament
  const tournament = await db
    .select({ id: groupTournaments.id, title: groupTournaments.title })
    .from(groupTournaments)
    .where(eq(groupTournaments.shareCode, shareCode))
    .get();

  if (!tournament) {
    return { success: false, error: 'TOURNAMENT_NOT_FOUND' };
  }

  const rawName = [tgUser?.first_name, tgUser?.last_name].filter(Boolean).join(' ') || tgUser?.username || 'Foydalanuvchi';
  const userName = rawName.slice(0, 50);

  // 2. Check if user already submitted for this tournament
  let existing = null;
  if (userId) {
    existing = await db
      .select({ id: tournamentParticipants.id, score: tournamentParticipants.score, totalTimeSeconds: tournamentParticipants.totalTimeSeconds })
      .from(tournamentParticipants)
      .where(and(eq(tournamentParticipants.tournamentId, tournament.id), eq(tournamentParticipants.userId, userId)))
      .get();
  }

  if (existing) {
    // Only update if new score is better or same score with better time
    const isBetter = score > existing.score || (score === existing.score && totalTimeSeconds < existing.totalTimeSeconds);
    if (isBetter) {
      await db
        .update(tournamentParticipants)
        .set({
          score,
          totalQuestions,
          totalTimeSeconds,
          userName,
          finishedAt: new Date(),
        })
        .where(eq(tournamentParticipants.id, existing.id))
        .run();
    }
  } else {
    // Insert new participant
    await db.insert(tournamentParticipants).values({
      tournamentId: tournament.id,
      userId,
      userName,
      score,
      totalQuestions,
      totalTimeSeconds,
    }).run();
  }

  // 3. Compute new rank
  const allParticipants = await db
    .select({
      userId: tournamentParticipants.userId,
      score: tournamentParticipants.score,
      totalTimeSeconds: tournamentParticipants.totalTimeSeconds,
    })
    .from(tournamentParticipants)
    .where(eq(tournamentParticipants.tournamentId, tournament.id))
    .orderBy(desc(tournamentParticipants.score), asc(tournamentParticipants.totalTimeSeconds))
    .all();

  const rankIndex = (allParticipants || []).findIndex((p) => p.userId === userId);
  const rank = rankIndex !== -1 ? rankIndex + 1 : allParticipants.length;

  return {
    success: true,
    rank,
    totalParticipants: allParticipants.length,
    score,
    totalQuestions,
    totalTimeSeconds,
    tournamentTitle: tournament.title,
  };
}
