// tgcloud/endpoints/get_group_sessions.js
import { db } from 'sdk';
import { eq, desc, and } from 'sdk/db';
import { quizSessions, quizzes, questions, groupAnswers, groups } from '../schema.js';

export default async function (input, ctx) {
  const currentUserId = ctx?.initData?.user?.id || 0;

  // 1. Fetch active group sessions (strictly isGroup = true)
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
    .limit(10)
    .all();

  // Parallelize session metadata lookups
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
        chatTitle: groupRow?.title || `Guruh (#${Math.abs(s.chatId).toString().slice(-4)})`,
        quizId: s.quizId,
        quizTitle: quizRow?.title || 'Faol Viktorina',
        currentIndex: s.currentIndex || 0,
        totalQuestions: s.totalQuestions || 10,
        participantCount: uniqueParticipants,
        startedAt: s.startedAt,
      };
    })
  );

  // 2. Fetch user's quizzes to display in "Guruhda boshlash" launcher
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

  // If user has few or 0 quizzes, supplement with public catalog quizzes (ownerId = 0)
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

  // Parallelize question count calculation
  const formattedQuizzes = await Promise.all(
    combined.map(async (q) => {
      const qCount = await db.$count(questions, eq(questions.quizId, q.id));
      return {
        id: q.id,
        title: q.title,
        description: q.description || '',
        questionCount: Number(qCount || 0),
        timeLimit: q.timeLimit || 30,
        isPublic: Boolean(q.isPublic),
        shareLink: `https://t.me/Queasy_uz_Bot?startgroup=quiz_${q.id}`,
      };
    })
  );

  return {
    activeSessions,
    launchableQuizzes: formattedQuizzes,
  };
}
