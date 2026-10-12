// tgcloud/endpoints/get_tournament_details.js
import { db } from 'sdk';
import { eq, desc, asc } from 'sdk/db';
import { groupTournaments, tournamentParticipants, quizzes, questions, users } from '../schema.js';

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
      questionCount: Number(qCount || 0),
    },
    leaderboard: formattedLeaderboard,
    totalParticipants: formattedLeaderboard.length,
    userParticipation,
  };
}
