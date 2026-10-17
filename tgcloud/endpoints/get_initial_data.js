// tgcloud/endpoints/get_initial_data.js
import { db } from 'sdk';
import { eq, desc, and } from 'sdk/db';
import { users, quizzes, questions, quizSessions } from '../schema.js';
import { CONFIG } from '../lib/constants/config.js';
import turso from '../lib/turso_client.js';

export default async function (input, ctx) {
  const tgUser = ctx?.initData?.user;
  const userId = tgUser?.id ? Number(tgUser.id) : 0;

  if (!userId) {
    return {
      user: { id: 0, name: 'Guest', level: 1, xp: 0 },
      myQuizzes: [],
      stats: { totalSolved: 0, accuracy: 0, globalRank: '-' },
    };
  }

  if (CONFIG.TURSO?.ENABLED) {
    try {
      let userRow = await turso.get('SELECT * FROM users WHERE telegram_id = ?', [userId]);
      if (!userRow) {
        await turso.run(
          'INSERT INTO users (telegram_id, first_name, last_name, username, lang, is_blocked, created_at, last_active_at) VALUES (?, ?, ?, ?, ?, 0, unixepoch(), unixepoch())',
          [userId, tgUser.first_name || 'Foydalanuvchi', tgUser.last_name || null, tgUser.username || null, tgUser.language_code?.toUpperCase()?.includes('RU') ? 'RU' : 'UZ']
        );
        userRow = await turso.get('SELECT * FROM users WHERE telegram_id = ?', [userId]);
      }

      const rawQuizzes = await turso.all(`
        SELECT q.id, q.title, q.description, q.time_limit, q.shuffle_options, count(qst.id) as question_count
        FROM quizzes q
        LEFT JOIN questions qst ON qst.quiz_id = q.id
        WHERE q.owner_id = ?
        GROUP BY q.id
        ORDER BY q.id DESC
        LIMIT 20
      `, [userId]);

      const myQuizzes = (rawQuizzes || []).map(q => ({
        id: q.id,
        title: q.title,
        description: q.description || '',
        timeLimit: q.time_limit || 30,
        questionCount: Number(q.question_count || 0),
        shuffleOptions: Boolean(q.shuffle_options),
      }));

      const rawSessions = await turso.all(
        'SELECT id, correct_count, wrong_count, started_at FROM quiz_sessions WHERE user_id = ? AND is_active = 0 ORDER BY id DESC LIMIT 200',
        [userId]
      );

      let totalCorrect = 0;
      let totalAnswered = 0;
      (rawSessions || []).forEach(s => {
        totalCorrect += Number(s.correct_count || 0);
        totalAnswered += Number(s.correct_count || 0) + Number(s.wrong_count || 0);
      });

      const accuracy = totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : 0;
      const xp = totalCorrect * 10;
      const level = Math.floor(xp / 100) + 1;
      const fullName = [userRow?.first_name, userRow?.last_name].filter(Boolean).join(' ') || tgUser?.first_name || 'Foydalanuvchi';

      let globalRank = '-';
      if ((rawSessions || []).length > 0) {
        try {
          const rankRow = await turso.get(
            'SELECT COUNT(*) as higher_count FROM (SELECT user_id, SUM(correct_count) as tc FROM quiz_sessions WHERE is_active = 0 GROUP BY user_id HAVING tc > ?)',
            [totalCorrect]
          );
          globalRank = (Number(rankRow?.higher_count) || 0) + 1;
        } catch (rErr) {
          console.warn('[get_initial_data] rank calc err:', rErr.message);
          globalRank = '-';
        }
      }

      // Calculate last 7 days activity
      const nowSec = Math.floor(Date.now() / 1000);
      const days = [];
      const dayNames = ['Yak', 'Du', 'Se', 'Chor', 'Pay', 'Jum', 'Shan'];
      const dayKeys = ['DAY_SUN', 'DAY_MON', 'DAY_TUE', 'DAY_WED', 'DAY_THU', 'DAY_FRI', 'DAY_SAT'];
      for (let i = 6; i >= 0; i--) {
        const d = new Date((nowSec - i * 86400) * 1000);
        const dayIdx = d.getDay();
        days.push({
          day: dayNames[dayIdx],
          dayKey: dayKeys[dayIdx],
          dateKey: d.toISOString().slice(0, 10),
          correct: 0,
        });
      }

      (rawSessions || []).forEach(s => {
        if (s.started_at) {
          const sDate = new Date(Number(s.started_at) * 1000).toISOString().slice(0, 10);
          const found = days.find(d => d.dateKey === sDate);
          if (found) {
            found.correct += Number(s.correct_count || 0);
          }
        }
      });

      const weeklyActivity = days.map(d => ({ label: d.day, dayKey: d.dayKey, value: d.correct }));

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
          totalSolved: (rawSessions || []).length,
          accuracy,
          globalRank,
          weeklyActivity,
        },
      };
    } catch (err) {
      console.warn('[get_initial_data] Turso fallback to local db:', err.message);
    }
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
      weeklyActivity: [],
    },
  };
}
