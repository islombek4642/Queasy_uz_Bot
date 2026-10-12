// tgcloud/endpoints/get_initial_data.js
import { db } from 'sdk';
import { eq, desc, and } from 'sdk/db';
import { users, quizzes, questions, quizSessions } from '../schema.js';

export default async function (input, ctx) {
  const tgUser = ctx?.initData?.user;
  const userId = tgUser?.id;

  if (!userId) {
    return {
      user: { id: 0, name: 'Guest', level: 1, xp: 0 },
      myQuizzes: [],
      stats: { totalSolved: 0, accuracy: 0, globalRank: '-' },
    };
  }

  // 1. Fetch or ensure user
  let userRow = await db.select().from(users).where(eq(users.telegramId, userId)).get();
  if (!userRow) {
    const fullName = [tgUser.first_name, tgUser.last_name].filter(Boolean).join(' ') || 'Foydalanuvchi';
    await db.insert(users).values({
      telegramId: userId,
      name: fullName,
      username: tgUser.username || null,
      lang: tgUser.language_code?.toUpperCase()?.includes('RU') ? 'RU' : 'UZ',
    }).run();
    userRow = await db.select().from(users).where(eq(users.telegramId, userId)).get();
  }

  // 2. Fetch user quizzes
  const rawQuizzes = await db
    .select()
    .from(quizzes)
    .where(eq(quizzes.ownerId, userId))
    .orderBy(desc(quizzes.id))
    .limit(20)
    .all();

  const myQuizzes = [];
  for (const q of rawQuizzes) {
    const qCountRows = await db
      .select()
      .from(questions)
      .where(eq(questions.quizId, q.id))
      .all();

    myQuizzes.push({
      id: q.id,
      title: q.title,
      description: q.description || '',
      timeLimit: q.timeLimit || 30,
      questionCount: qCountRows.length,
      shuffleOptions: Boolean(q.shuffleOptions),
    });
  }

  // 3. User Statistics
  const finishedSessions = await db
    .select()
    .from(quizSessions)
    .where(and(eq(quizSessions.userId, userId), eq(quizSessions.isActive, false)))
    .all();

  let totalCorrect = 0;
  let totalAnswered = 0;
  finishedSessions.forEach((s) => {
    totalCorrect += s.correctCount || 0;
    totalAnswered += (s.correctCount || 0) + (s.wrongCount || 0);
  });

  const accuracy = totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : 0;
  const xp = totalCorrect * 10;
  const level = Math.floor(xp / 100) + 1;

  return {
    user: {
      id: userId,
      name: userRow?.name || tgUser.first_name,
      username: userRow?.username || tgUser.username,
      photo_url: tgUser?.photo_url || null,
      level,
      xp,
      lang: userRow?.lang || 'UZ',
    },
    myQuizzes,
    stats: {
      totalSolved: finishedSessions.length,
      accuracy,
      globalRank: 1,
    },
  };
}
