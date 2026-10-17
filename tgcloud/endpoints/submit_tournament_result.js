// tgcloud/endpoints/submit_tournament_result.js
import { db } from 'sdk';
import { eq, and, desc, asc } from 'sdk/db';
import { groupTournaments, tournamentParticipants } from '../schema.js';
import { CONFIG } from '../lib/constants/config.js';
import turso from '../lib/turso_client.js';

export default async function (input, ctx) {
  const tgUser = ctx?.initData?.user;
  const userId = tgUser?.id ? Number(tgUser.id) : 0;
  const shareCode = String(input?.shareCode || '').trim();
  const score = parseInt(input?.score, 10) || 0;
  const totalQuestions = parseInt(input?.totalQuestions, 10) || 0;
  const totalTimeSeconds = parseInt(input?.totalTimeSeconds, 10) || 0;

  if (!shareCode) {
    return { success: false, error: 'MISSING_SHARE_CODE' };
  }

  // 1. Fetch tournament
  let tournament = null;
  if (CONFIG.TURSO?.ENABLED) {
    try {
      const r = await turso.get('SELECT id, title FROM group_tournaments WHERE share_code = ?', [shareCode]);
      if (r) {
        tournament = { id: Number(r.id), title: r.title };
      }
    } catch (err) {
      console.warn('[submit_tournament_result] Turso tournament fetch fallback:', err.message);
    }
  }

  if (!tournament) {
    tournament = await db
      .select({ id: groupTournaments.id, title: groupTournaments.title })
      .from(groupTournaments)
      .where(eq(groupTournaments.shareCode, shareCode))
      .get();
  }

  if (!tournament) {
    return { success: false, error: 'TOURNAMENT_NOT_FOUND' };
  }

  const rawName = [tgUser?.first_name, tgUser?.last_name].filter(Boolean).join(' ') || tgUser?.username || 'Foydalanuvchi';
  const userName = rawName.slice(0, 50);

  // 2. Save participant score in Turso
  if (CONFIG.TURSO?.ENABLED) {
    try {
      if (userId) {
        const existing = await turso.get(
          'SELECT id, score, total_time_seconds as totalTimeSeconds FROM tournament_participants WHERE tournament_id = ? AND user_id = ?',
          [tournament.id, userId]
        );
        if (existing) {
          const isBetter = score > existing.score || (score === existing.score && totalTimeSeconds < existing.totalTimeSeconds);
          if (isBetter) {
            await turso.run(
              'UPDATE tournament_participants SET score = ?, total_questions = ?, total_time_seconds = ?, user_name = ?, finished_at = unixepoch() WHERE id = ?',
              [score, totalQuestions, totalTimeSeconds, userName, existing.id]
            );
          }
        } else {
          await turso.run(
            'INSERT INTO tournament_participants (tournament_id, user_id, user_name, score, total_questions, total_time_seconds, finished_at) VALUES (?, ?, ?, ?, ?, ?, unixepoch())',
            [tournament.id, userId, userName, score, totalQuestions, totalTimeSeconds]
          );
        }
      }

      const allParticipants = await turso.all(
        'SELECT user_id as userId, score, total_time_seconds as totalTimeSeconds FROM tournament_participants WHERE tournament_id = ? ORDER BY score DESC, total_time_seconds ASC',
        [tournament.id]
      );

      const rankIndex = (allParticipants || []).findIndex((p) => Number(p.userId) === userId);
      const rank = rankIndex !== -1 ? rankIndex + 1 : (allParticipants || []).length;

      return {
        success: true,
        rank,
        totalParticipants: (allParticipants || []).length,
        score,
        totalQuestions,
        totalTimeSeconds,
        tournamentTitle: tournament.title,
      };
    } catch (err) {
      console.warn('[submit_tournament_result] Turso fallback:', err.message);
    }
  }

  // Fallback to local SQLite
  let existing = null;
  if (userId) {
    existing = await db
      .select({ id: tournamentParticipants.id, score: tournamentParticipants.score, totalTimeSeconds: tournamentParticipants.totalTimeSeconds })
      .from(tournamentParticipants)
      .where(and(eq(tournamentParticipants.tournamentId, tournament.id), eq(tournamentParticipants.userId, userId)))
      .get();
  }

  if (existing) {
    const isBetter = score > existing.score || (score === existing.score && totalTimeSeconds < existing.totalTimeSeconds);
    if (isBetter) {
      await db
        .update(tournamentParticipants)
        .set({
          score,
          totalQuestions,
          totalTimeSeconds,
          userName,
          finishedAt: Math.floor(Date.now() / 1000),
        })
        .where(eq(tournamentParticipants.id, existing.id))
        .run();
    }
  } else {
    await db.insert(tournamentParticipants).values({
      tournamentId: tournament.id,
      userId,
      userName,
      score,
      totalQuestions,
      totalTimeSeconds,
    }).run();
  }

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
