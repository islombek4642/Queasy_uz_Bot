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
    await db.insert(users).values({
      telegramId: userId,
      firstName: tgUser.first_name || 'Foydalanuvchi',
      lastName: tgUser.last_name || null,
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

  // Parallelize user quizzes question count lookups
  const myQuizzes = await Promise.all(
    (rawQuizzes || []).map(async (q) => {
      const qCount = await db.$count(questions, eq(questions.quizId, q.id));
      return {
        id: q.id,
        title: q.title,
        description: q.description || '',
        timeLimit: q.timeLimit || 30,
        questionCount: qCount,
        shuffleOptions: Boolean(q.shuffleOptions),
      };
    })
  );

  // 3. User Statistics
  let finishedSessions = [];
  try {
    const rawSessions = await db
      .select({
        id: quizSessions.id,
        correctCount: quizSessions.correctCount,
        wrongCount: quizSessions.wrongCount,
      })
      .from(quizSessions)
      .where(and(eq(quizSessions.userId, userId), eq(quizSessions.isActive, false)))
      .limit(100)
      .all();
    finishedSessions = rawSessions || [];
  } catch (sErr) {
    console.error('[get_initial_data] session query err:', sErr?.message);
  }

  let totalCorrect = 0;
  let totalAnswered = 0;
  finishedSessions.forEach((s) => {
    totalCorrect += s.correctCount || 0;
    totalAnswered += (s.correctCount || 0) + (s.wrongCount || 0);
  });

  const accuracy = totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : 0;
  const xp = totalCorrect * 10;
  const level = Math.floor(xp / 100) + 1;
  const fullName = [userRow?.firstName, userRow?.lastName].filter(Boolean).join(' ') || tgUser?.first_name || 'Foydalanuvchi';

  return {
    user: {
      id: userId,
      name: fullName,
      username: userRow?.username || tgUser.username,
      photo_url: tgUser?.photo_url || (userRow?.username ? `https://t.me/i/userpic/320/${userRow.username}.jpg` : null),
      level,
      xp,
      lang: userRow?.lang || 'UZ',
    },
    myQuizzes,
    stats: {
      totalSolved: finishedSessions.length,
      accuracy,
      globalRank: finishedSessions.length > 0 ? 1 : '-',
    },
  };
}
