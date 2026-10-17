// tgcloud/endpoints/get_tournament_details.js
import { db } from 'sdk';
import { eq, desc, asc } from 'sdk/db';
import { groupTournaments, tournamentParticipants, quizzes, questions, users, botSettings } from '../schema.js';
import { CONFIG } from '../lib/constants/config.js';
import turso from '../lib/turso_client.js';

export default async function (input, ctx) {
  const tgUser = ctx?.initData?.user;
  const currentUserId = tgUser?.id || 0;
  const shareCode = String(input?.shareCode || '').trim();

  if (!shareCode) {
    return { success: false, error: 'MISSING_SHARE_CODE' };
  }

  // 1. Fetch tournament
  let tournament = null;
  if (CONFIG.TURSO?.ENABLED) {
    try {
      const r = await turso.get('SELECT * FROM group_tournaments WHERE share_code = ?', [shareCode]);
      if (r) {
        tournament = {
          id: Number(r.id),
          quizId: Number(r.quiz_id),
          creatorId: Number(r.creator_id),
          title: r.title,
          shareCode: r.share_code,
          isActive: Boolean(r.is_active),
          createdAt: r.created_at,
        };
      }
    } catch (err) {
      console.warn('[get_tournament_details] Turso tournament fetch fallback:', err.message);
    }
  }

  if (!tournament) {
    tournament = await db
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
  }

  if (!tournament) {
    return { success: false, error: 'TOURNAMENT_NOT_FOUND' };
  }

  // 2. Fetch quiz details
  let quiz = null;
  let qCount = 0;

  if (CONFIG.TURSO?.ENABLED) {
    try {
      quiz = await turso.get('SELECT id, title, description, time_limit as timeLimit FROM quizzes WHERE id = ?', [tournament.quizId]);
      if (quiz) {
        const cRow = await turso.get('SELECT count(*) as count FROM questions WHERE quiz_id = ?', [quiz.id]);
        qCount = Number(cRow?.count || 0);
      }
    } catch (err) {
      console.warn('[get_tournament_details] Turso fetch fallback:', err.message);
    }
  }

  if (!quiz) {
    quiz = await db
      .select({
        id: quizzes.id,
        title: quizzes.title,
        description: quizzes.description,
        timeLimit: quizzes.timeLimit,
      })
      .from(quizzes)
      .where(eq(quizzes.id, tournament.quizId))
      .get();

    if (quiz) {
      qCount = await db.$count(questions, eq(questions.quizId, quiz.id));
    }
  }

  if (!quiz) {
    return { success: false, error: 'QUIZ_NOT_FOUND' };
  }

  // 3. Fetch leaderboard for this tournament
  let participants = [];
  if (CONFIG.TURSO?.ENABLED && tournament?.id) {
    try {
      participants = await turso.all(
        'SELECT id, user_id as userId, user_name as userName, user_avatar as userAvatar, score, total_questions as totalQuestions, total_time_seconds as totalTimeSeconds, finished_at as finishedAt FROM tournament_participants WHERE tournament_id = ? ORDER BY score DESC, total_time_seconds ASC LIMIT 50',
        [tournament.id]
      );
    } catch (err) {
      console.warn('[get_tournament_details] Turso participants fetch fallback:', err.message);
    }
  }

  if (!participants || participants.length === 0) {
    try {
      participants = await db
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
    } catch {}
  }

  const formattedLeaderboard = (participants || []).map((p, index) => ({
    ...p,
    rank: index + 1,
    isCurrentUser: currentUserId ? p.userId === currentUserId : false,
  }));

  const userParticipation = formattedLeaderboard.find((p) => p.isCurrentUser) || null;

  // Fetch host's modeConfig if set (e.g. range, randomCount, mode)
  let modeConfig = null;
  let actualQCount = Number(qCount || 0);

  let rawCfg = null;
  if (CONFIG.TURSO?.ENABLED) {
    try {
      const row = await turso.get('SELECT value FROM bot_settings WHERE key = ?', [`tournament_cfg:${shareCode}`]);
      if (row?.value) {
        rawCfg = row.value;
      }
    } catch {}
  }

  if (!rawCfg) {
    const cfgSetting = await db
      .select({ value: botSettings.value })
      .from(botSettings)
      .where(eq(botSettings.key, `tournament_cfg:${shareCode}`))
      .get();
    if (cfgSetting?.value) {
      rawCfg = cfgSetting.value;
    }
  }

  if (rawCfg) {
    try {
      modeConfig = JSON.parse(rawCfg);
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
