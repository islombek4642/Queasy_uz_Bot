// tgcloud/endpoints/get_tournament_details.js
import { db } from 'sdk';
import { eq, desc, asc } from 'sdk/db';
import { groupTournaments, tournamentParticipants, quizzes, questions, users, botSettings } from '../schema.js';

export default async function (input, ctx) {
  const tgUser = ctx?.initData?.user;
  const currentUserId = tgUser?.id || 0;
  const shareCode = String(input?.shareCode || '').trim();

  if (!shareCode) {
    return { success: false, error: 'MISSING_SHARE_CODE' };
  }

  // 1. Fetch tournament
  const tournament = await db
    .select({
      id: groupTournaments.id,
      quizId: groupTournaments.quizId,
      creatorId: groupTournaments.creatorId,
      title: groupTournaments.title,
      shareCode: groupTournaments.shareCode,
      isActive: groupTournaments.isActive,
      createdAt: groupTournaments.createdAt,
    })
    .from(groupTournaments)
    .where(eq(groupTournaments.shareCode, shareCode))
    .get();

  if (!tournament) {
    return { success: false, error: 'TOURNAMENT_NOT_FOUND' };
  }

  // 2. Fetch quiz details
  const quiz = await db
    .select({
      id: quizzes.id,
      title: quizzes.title,
      description: quizzes.description,
      timeLimit: quizzes.timeLimit,
    })
    .from(quizzes)
    .where(eq(quizzes.id, tournament.quizId))
    .get();

  if (!quiz) {
    return { success: false, error: 'QUIZ_NOT_FOUND' };
  }

  const qCount = await db.$count(questions, eq(questions.quizId, quiz.id));

  // 3. Fetch leaderboard for this tournament
  const participants = await db
    .select({
      id: tournamentParticipants.id,
      userId: tournamentParticipants.userId,
      userName: tournamentParticipants.userName,
      userAvatar: tournamentParticipants.userAvatar,
      score: tournamentParticipants.score,
      totalQuestions: tournamentParticipants.totalQuestions,
      totalTimeSeconds: tournamentParticipants.totalTimeSeconds,
      finishedAt: tournamentParticipants.finishedAt,
    })
    .from(tournamentParticipants)
    .where(eq(tournamentParticipants.tournamentId, tournament.id))
    .orderBy(desc(tournamentParticipants.score), asc(tournamentParticipants.totalTimeSeconds))
    .limit(50)
    .all();

  const formattedLeaderboard = (participants || []).map((p, index) => ({
    ...p,
    rank: index + 1,
    isCurrentUser: currentUserId ? p.userId === currentUserId : false,
  }));

  const userParticipation = formattedLeaderboard.find((p) => p.isCurrentUser) || null;

  // Fetch host's modeConfig if set (e.g. range, randomCount, mode)
  let modeConfig = null;
  let actualQCount = Number(qCount || 0);

  const cfgSetting = await db
    .select({ value: botSettings.value })
    .from(botSettings)
    .where(eq(botSettings.key, `tournament_cfg:${shareCode}`))
    .get();

  if (cfgSetting?.value) {
    try {
      modeConfig = JSON.parse(cfgSetting.value);
      if (modeConfig?.mode === 'random' && modeConfig.randomCount) {
        actualQCount = Math.min(actualQCount, Math.max(1, Number(modeConfig.randomCount) || 10));
      } else if (modeConfig?.mode === 'range' && Array.isArray(modeConfig.range) && modeConfig.range.length === 2) {
        const s = Math.max(1, Math.min(Number(modeConfig.range[0]) || 1, actualQCount));
        const e = Math.max(s, Math.min(Number(modeConfig.range[1]) || actualQCount, actualQCount));
        actualQCount = e - s + 1;
      }
    } catch {}
  }

  return {
    success: true,
    tournament: {
      id: tournament.id,
      title: tournament.title,
      shareCode: tournament.shareCode,
      createdAt: tournament.createdAt,
    },
    quiz: {
      id: quiz.id,
      title: quiz.title,
      description: quiz.description,
      timeLimit: quiz.timeLimit || 30,
      questionCount: actualQCount,
    },
    leaderboard: formattedLeaderboard,
    totalParticipants: formattedLeaderboard.length,
    userParticipation,
    modeConfig,
  };
}
