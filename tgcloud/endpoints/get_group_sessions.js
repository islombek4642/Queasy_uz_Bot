// tgcloud/endpoints/get_group_sessions.js
import { db } from 'sdk';
import { eq, desc } from 'sdk/db';
import { quizSessions, quizzes, questions, groupAnswers, groups } from '../schema.js';

export default async function (input, ctx) {
  const currentUserId = ctx?.initData?.user?.id || 0;

  // 1. Fetch active group sessions
  const rawActiveSessions = await db
    .select()
    .from(quizSessions)
    .where(eq(quizSessions.isActive, true))
    .orderBy(desc(quizSessions.id))
    .limit(10)
    .all();

  const activeSessions = [];

  for (const s of rawActiveSessions) {
    if (!s.isGroup) continue;

    // Get Quiz Title
    const quizRow = await db.select().from(quizzes).where(eq(quizzes.id, s.quizId)).get();
    // Get Group Title
    const groupRow = await db.select().from(groups).where(eq(groups.groupId, s.chatId)).get();

    // Get count of participants
    const answers = await db
      .select()
      .from(groupAnswers)
      .where(eq(groupAnswers.sessionId, s.id))
      .all();

    const uniqueParticipants = new Set(answers.map((a) => a.userId)).size;

    activeSessions.push({
      sessionId: s.id,
      chatId: s.chatId,
      chatTitle: groupRow?.title || `Guruh (#${Math.abs(s.chatId).toString().slice(-4)})`,
      quizId: s.quizId,
      quizTitle: quizRow?.title || 'Faol Viktorina',
      currentIndex: s.currentIndex || 0,
      totalQuestions: s.totalQuestions || 10,
      participantCount: uniqueParticipants,
      startedAt: s.startedAt,
    });
  }

  // 2. Fetch user's quizzes to display in "Guruhda boshlash" launcher
  const userQuizzes = await db
    .select()
    .from(quizzes)
    .where(eq(quizzes.ownerId, currentUserId))
    .orderBy(desc(quizzes.id))
    .limit(10)
    .all();

  const formattedQuizzes = [];
  for (const q of userQuizzes) {
    const qCount = await db
      .select()
      .from(questions)
      .where(eq(questions.quizId, q.id))
      .all();

    formattedQuizzes.push({
      id: q.id,
      title: q.title,
      description: q.description || '',
      questionCount: qCount.length,
      timeLimit: q.timeLimit || 30,
      shareLink: `https://t.me/Queasy_uz_Bot?startgroup=quiz_${q.id}`,
    });
  }

  return {
    activeSessions,
    launchableQuizzes: formattedQuizzes,
  };
}
