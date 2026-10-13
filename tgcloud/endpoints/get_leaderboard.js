// tgcloud/endpoints/get_leaderboard.js
import { db } from 'sdk';
import { eq, and, sql, desc, inArray } from 'sdk/db';
import { users, quizSessions } from '../schema.js';

export default async function (input, ctx) {
  try {
    const currentUserId = ctx?.initData?.user?.id || 0;
    const timeframe = input?.timeframe || 'all';

    // 1. Calculate timeframe cutoff timestamp
    const nowSec = Math.floor(Date.now() / 1000);
    let thresholdSec = 0;
    if (timeframe === 'today') {
      thresholdSec = nowSec - 86400;
    } else if (timeframe === 'week') {
      thresholdSec = nowSec - 7 * 86400;
    } else if (timeframe === 'month') {
      thresholdSec = nowSec - 30 * 86400;
    }

    // 2. Query finished sessions
    const sessionsQuery = thresholdSec > 0
      ? db
          .select({
            userId: quizSessions.userId,
            correctCount: quizSessions.correctCount,
            wrongCount: quizSessions.wrongCount,
          })
          .from(quizSessions)
          .where(
            and(
              eq(quizSessions.isActive, false),
              sql`${quizSessions.startedAt} >= ${thresholdSec}`
            )
          )
          .limit(500)
      : db
          .select({
            userId: quizSessions.userId,
            correctCount: quizSessions.correctCount,
            wrongCount: quizSessions.wrongCount,
          })
          .from(quizSessions)
          .where(eq(quizSessions.isActive, false))
          .limit(1000);

    const finishedSessions = (await sessionsQuery.all()) || [];

    // 3. Aggregate user performance
    const userStatsMap = new Map();
    for (const s of finishedSessions) {
      const uid = Number(s.userId);
      if (!uid) continue;

      if (!userStatsMap.has(uid)) {
        userStatsMap.set(uid, {
          userId: uid,
          totalCorrect: 0,
          totalAnswered: 0,
          quizzesCount: 0,
        });
      }
      const cur = userStatsMap.get(uid);
      const correct = Number(s.correctCount) || 0;
      const wrong = Number(s.wrongCount) || 0;
      cur.totalCorrect += correct;
      cur.totalAnswered += correct + wrong;
      cur.quizzesCount += 1;
    }

    // 4. Sort users descending by XP (correct answers * 10)
    const sortedStats = Array.from(userStatsMap.values()).map((s) => ({
      id: s.userId,
      xp: s.totalCorrect * 10,
      level: Math.floor((s.totalCorrect * 10) / 100) + 1,
      accuracy: s.totalAnswered > 0 ? Math.round((s.totalCorrect / s.totalAnswered) * 100) : 0,
      quizzesSolved: s.quizzesCount,
    }));

    sortedStats.sort((a, b) => b.xp - a.xp);

    // 5. Fetch profile info for top 10 users + current user
    const top10Stats = sortedStats.slice(0, 10);
    const neededUserIds = new Set(top10Stats.map((s) => s.id));
    if (currentUserId) neededUserIds.add(currentUserId);

    const userProfileMap = new Map();
    if (neededUserIds.size > 0) {
      try {
        const userRows = await db
          .select({
            telegramId: users.telegramId,
            firstName: users.firstName,
            lastName: users.lastName,
            username: users.username,
          })
          .from(users)
          .where(inArray(users.telegramId, Array.from(neededUserIds)))
          .all();

        for (const u of userRows || []) {
          userProfileMap.set(Number(u.telegramId), u);
        }
      } catch (uErr) {
        console.error('[get_leaderboard] user profiles lookup error:', uErr);
      }
    }

    // 6. Format top 10
    const topUsers = top10Stats.map((stat, idx) => {
      const profile = userProfileMap.get(stat.id);
      const rawName = [profile?.firstName, profile?.lastName].filter(Boolean).join(' ') || profile?.username || `Foydalanuvchi #${stat.id}`;

      return {
        rank: idx + 1,
        id: stat.id,
        name: rawName,
        username: profile?.username || '',
        xp: stat.xp,
        level: stat.level,
        accuracy: stat.accuracy,
        quizzesSolved: stat.quizzesSolved,
        isCurrentUser: currentUserId ? stat.id === currentUserId : false,
        photo_url: profile?.username ? `https://t.me/i/userpic/320/${profile.username}.jpg` : null,
      };
    });

    // 7. Determine current user rank
    let currentUserRank = topUsers.find((u) => u.isCurrentUser);
    if (!currentUserRank) {
      const userIndex = sortedStats.findIndex((s) => s.id === currentUserId);
      const profile = userProfileMap.get(currentUserId);
      const rawName = [profile?.firstName, profile?.lastName].filter(Boolean).join(' ') || profile?.username || ctx?.initData?.user?.first_name || 'Siz';

      if (userIndex !== -1) {
        const stat = sortedStats[userIndex];
        currentUserRank = {
          rank: userIndex + 1,
          id: currentUserId,
          name: rawName,
          username: profile?.username || ctx?.initData?.user?.username || '',
          xp: stat.xp,
          level: stat.level,
          accuracy: stat.accuracy,
          quizzesSolved: stat.quizzesSolved,
          isCurrentUser: true,
          photo_url: profile?.username ? `https://t.me/i/userpic/320/${profile.username}.jpg` : null,
        };
      } else {
        currentUserRank = {
          rank: sortedStats.length + 1,
          id: currentUserId,
          name: rawName,
          username: profile?.username || ctx?.initData?.user?.username || '',
          xp: 0,
          level: 1,
          accuracy: 0,
          quizzesSolved: 0,
          isCurrentUser: true,
          photo_url: profile?.username ? `https://t.me/i/userpic/320/${profile.username}.jpg` : null,
        };
      }
    }

    let totalUsersCount = 0;
    try {
      totalUsersCount = await db.$count(users);
    } catch {}

    return {
      timeframe,
      topUsers,
      currentUserRank,
      totalUsers: Math.max(totalUsersCount || 0, sortedStats.length),
    };
  } catch (error) {
    console.error('Fatal get_leaderboard error:', error);
    return {
      timeframe: input?.timeframe || 'all',
      topUsers: [],
      currentUserRank: null,
      totalUsers: 0,
      error: error.message,
    };
  }
}
