import { db } from 'sdk';
import { eq, desc, and } from 'sdk/db';
import { quizSessions, quizzes, questions, groupAnswers, groups } from '../schema.js';
import { CONFIG } from '../lib/constants/config.js';
import { getMessage } from '../lib/constants/messages.js';
import turso from '../lib/turso_client.js';

export default async function (input, ctx) {
  const currentUserId = ctx?.initData?.user?.id ? Number(ctx.initData.user.id) : 0;
  const defaultGroupTitle = getMessage('DEFAULT_GROUP_TITLE', 'UZ');
  const defaultActiveQuiz = getMessage('DEFAULT_ACTIVE_QUIZ', 'UZ');

  if (CONFIG.TURSO?.ENABLED) {
    try {
      // 1. Fetch active group sessions
      const rawActiveSessions = await turso.all(`
        SELECT qs.id, qs.quiz_id as quizId, qs.chat_id as chatId, qs.is_group as isGroup,
               qs.current_index as currentIndex, qs.total_questions as totalQuestions, qs.started_at as startedAt,
               q.title as quizTitle, g.title as groupTitle
        FROM quiz_sessions qs
        LEFT JOIN quizzes q ON q.id = qs.quiz_id
        LEFT JOIN "groups" g ON g.group_id = qs.chat_id
        WHERE qs.is_active = 1 AND qs.is_group = 1
        ORDER BY qs.id DESC
        LIMIT 50
      `);

      const activeSessions = (rawActiveSessions || []).map((s) => ({
        sessionId: s.id,
        chatId: s.chatId,
        chatTitle: s.groupTitle || `${defaultGroupTitle} (#${Math.abs(s.chatId).toString().slice(-4)})`,
        quizId: s.quizId,
        quizTitle: s.quizTitle || defaultActiveQuiz,
        currentIndex: Number(s.currentIndex || 0),
        totalQuestions: Number(s.totalQuestions || 10),
        participantCount: 1,
        startedAt: s.startedAt,
      }));

      // 2. Fetch user's quizzes
      const userQuizzes = await turso.all(`
        SELECT q.id, q.title, q.description, q.time_limit as timeLimit, q.owner_id as ownerId,
               count(qst.id) as questionCount
        FROM quizzes q
        LEFT JOIN questions qst ON qst.quiz_id = q.id
        WHERE q.owner_id = ?
        GROUP BY q.id
        ORDER BY q.id DESC
        LIMIT 10
      `, [currentUserId]);

      let publicQuizzes = [];
      if ((userQuizzes || []).length < 5) {
        const need = 10 - (userQuizzes || []).length;
        publicQuizzes = await turso.all(`
          SELECT q.id, q.title, q.description, q.time_limit as timeLimit, q.owner_id as ownerId,
                 count(qst.id) as questionCount
          FROM quizzes q
          LEFT JOIN questions qst ON qst.quiz_id = q.id
          WHERE q.owner_id = 0
          GROUP BY q.id
          ORDER BY q.id DESC
          LIMIT ?
        `, [need]);
      }

      const combined = [
        ...(userQuizzes || []).map((q) => ({ ...q, isPublic: false })),
        ...(publicQuizzes || []).map((q) => ({ ...q, isPublic: true })),
      ];

      const formattedQuizzes = combined.map((q) => ({
        id: q.id,
        title: q.title,
        description: q.description || '',
        questionCount: Number(q.questionCount || 0),
        timeLimit: q.timeLimit || CONFIG.POLL.DEFAULT_TIME_LIMIT,
        isPublic: Boolean(q.isPublic),
        shareLink: `https://t.me/${CONFIG.BOT.USERNAME}?startgroup=quiz_${q.id}`,
      }));

      return {
        activeSessions,
        launchableQuizzes: formattedQuizzes,
      };
    } catch (err) {
      console.warn('[get_group_sessions] Turso fallback to local db:', err.message);
    }
  }

  // Fallback to local SQLite
  const rawActiveSessions = await db
    .select({
      id: quizSessions.id,
      quizId: quizSessions.quizId,
      chatId: quizSessions.chatId,
      isGroup: quizSessions.isGroup,
      currentIndex: quizSessions.currentIndex,
      totalQuestions: quizSessions.totalQuestions,
      startedAt: quizSessions.startedAt,
    })
    .from(quizSessions)
    .where(and(eq(quizSessions.isActive, true), eq(quizSessions.isGroup, true)))
    .orderBy(desc(quizSessions.id))
    .limit(CONFIG.PAGINATION.GROUPS)
    .all();

  const activeSessions = await Promise.all(
    (rawActiveSessions || []).map(async (s) => {
      const [quizRow, groupRow, answers] = await Promise.all([
        db.select({ id: quizzes.id, title: quizzes.title }).from(quizzes).where(eq(quizzes.id, s.quizId)).get(),
        db.select({ groupId: groups.groupId, title: groups.title }).from(groups).where(eq(groups.groupId, s.chatId)).get(),
        db.select({ userId: groupAnswers.userId }).from(groupAnswers).where(eq(groupAnswers.sessionId, s.id)).all(),
      ]);

      const uniqueParticipants = new Set((answers || []).map((a) => a.userId)).size;

      return {
        sessionId: s.id,
        chatId: s.chatId,
        chatTitle: groupRow?.title || `${defaultGroupTitle} (#${Math.abs(s.chatId).toString().slice(-4)})`,
        quizId: s.quizId,
        quizTitle: quizRow?.title || defaultActiveQuiz,
        currentIndex: s.currentIndex || 0,
        totalQuestions: s.totalQuestions || CONFIG.PAGINATION.USERS,
        participantCount: uniqueParticipants,
        startedAt: s.startedAt,
      };
    })
  );

  const userQuizzes = await db
    .select({
      id: quizzes.id,
      title: quizzes.title,
      description: quizzes.description,
      timeLimit: quizzes.timeLimit,
      ownerId: quizzes.ownerId,
    })
    .from(quizzes)
    .where(eq(quizzes.ownerId, currentUserId))
    .orderBy(desc(quizzes.id))
    .limit(10)
    .all();

  let publicQuizzes = [];
  if ((userQuizzes || []).length < 5) {
    publicQuizzes = await db
      .select({
        id: quizzes.id,
        title: quizzes.title,
        description: quizzes.description,
        timeLimit: quizzes.timeLimit,
        ownerId: quizzes.ownerId,
      })
      .from(quizzes)
      .where(eq(quizzes.ownerId, 0))
      .orderBy(desc(quizzes.id))
      .limit(10 - (userQuizzes || []).length)
      .all();
  }

  const combined = [
    ...(userQuizzes || []).map((q) => ({ ...q, isPublic: false })),
    ...(publicQuizzes || []).map((q) => ({ ...q, isPublic: true })),
  ];

  const formattedQuizzes = await Promise.all(
    combined.map(async (q) => {
      const qCount = await db.$count(questions, eq(questions.quizId, q.id));
      return {
        id: q.id,
        title: q.title,
        description: q.description || '',
        questionCount: Number(qCount || 0),
        timeLimit: q.timeLimit || CONFIG.POLL.DEFAULT_TIME_LIMIT,
        isPublic: Boolean(q.isPublic),
        shareLink: `https://t.me/${CONFIG.BOT.USERNAME}?startgroup=quiz_${q.id}`,
      };
    })
  );

  return {
    activeSessions,
    launchableQuizzes: formattedQuizzes,
  };
}
