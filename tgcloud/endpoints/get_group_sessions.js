import { db } from 'sdk';
import { eq, desc, and, or } from 'sdk/db';
import { liveRooms, roomPlayers, quizzes, questions, groups } from '../schema.js';
import { CONFIG } from '../lib/constants/config.js';
import { getMessage } from '../lib/constants/messages.js';
import turso from '../lib/turso_client.js';

export default async function (input, ctx) {
  const currentUserId = ctx?.initData?.user?.id ? Number(ctx.initData.user.id) : 0;
  const userLang = (input?.lang || ctx?.initData?.user?.language_code || 'uz').toUpperCase().slice(0, 2);
  const defaultGroupTitle = getMessage('DEFAULT_GROUP_TITLE', userLang);
  const defaultActiveQuiz = getMessage('DEFAULT_ACTIVE_QUIZ', userLang);
  const defaultLiveQuiz = getMessage('DEFAULT_LIVE_QUIZ', userLang);

  if (CONFIG.TURSO?.ENABLED) {
    try {
      // 1. Fetch active live room sessions (Waiting or Active)
      const rawActiveRooms = await turso.all(`
        SELECT lr.id, lr.room_code as roomCode, lr.quiz_id as quizId, lr.host_id as hostId, lr.status,
               lr.current_question_index as currentIndex, lr.created_at as startedAt,
               q.title as quizTitle,
               (SELECT count(*) FROM room_players rp WHERE rp.room_code = lr.room_code) as participantCount,
               (SELECT count(*) FROM room_players rp WHERE rp.room_code = lr.room_code AND rp.user_id = ?) as isUserJoined,
               (SELECT count(*) FROM questions qst WHERE qst.quiz_id = lr.quiz_id) as totalQuestions
        FROM live_rooms lr
        LEFT JOIN quizzes q ON q.id = lr.quiz_id
        WHERE lr.status IN ('waiting', 'active')
          AND (lr.created_at IS NULL OR lr.created_at >= unixepoch() - 7200)
        ORDER BY lr.id DESC
        LIMIT 50
      `, [currentUserId]);

      const activeSessions = (rawActiveRooms || []).map((s) => ({
        sessionId: s.roomCode,
        roomCode: s.roomCode,
        chatId: 0,
        chatTitle: s.quizTitle || defaultLiveQuiz,
        quizId: Number(s.quizId),
        quizTitle: s.quizTitle || defaultLiveQuiz,
        hostId: Number(s.hostId),
        status: s.status,
        currentIndex: Number(s.currentIndex || 0),
        totalQuestions: Math.max(1, Number(s.totalQuestions || 10)),
        participantCount: Math.max(1, Number(s.participantCount || 1)),
        maxPlayers: 10,
        isHost: currentUserId ? Number(s.hostId) === currentUserId : false,
        isJoined: Boolean(s.isUserJoined),
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
        shareLink: `https://t.me/${CONFIG.BOT.USERNAME}/app?startapp=battle_${q.id}`,
      }));

      return {
        activeSessions,
        launchableQuizzes: formattedQuizzes,
      };
    } catch (err) {
      console.warn('[get_group_sessions] Turso fallback to local db:', err.message);
    }
  }

  // Fallback to local SQLite: Query liveRooms where status IN ('waiting', 'active')
  let rawActiveRooms = [];
  try {
    rawActiveRooms = await db
      .select({
        id: liveRooms.id,
        roomCode: liveRooms.roomCode,
        quizId: liveRooms.quizId,
        hostId: liveRooms.hostId,
        status: liveRooms.status,
        currentIndex: liveRooms.currentQuestionIndex,
        createdAt: liveRooms.createdAt,
      })
      .from(liveRooms)
      .where(or(eq(liveRooms.status, 'waiting'), eq(liveRooms.status, 'active')))
      .orderBy(desc(liveRooms.id))
      .limit(50)
      .all();
  } catch {}

  const activeSessions = await Promise.all(
    (rawActiveRooms || []).map(async (r) => {
      let quizTitle = defaultLiveQuiz;
      let totalQ = 10;
      let participantCount = 1;
      let isUserJoined = false;

      try {
        const qRow = await db.select({ title: quizzes.title }).from(quizzes).where(eq(quizzes.id, r.quizId)).get();
        if (qRow?.title) quizTitle = qRow.title;
      } catch {}

      try {
        totalQ = await db.$count(questions, eq(questions.quizId, r.quizId));
      } catch {}

      try {
        const pList = await db.select({ userId: roomPlayers.userId }).from(roomPlayers).where(eq(roomPlayers.roomCode, r.roomCode)).all();
        participantCount = (pList || []).length;
        if (currentUserId) {
          isUserJoined = (pList || []).some((p) => Number(p.userId) === currentUserId);
        }
      } catch {}

      return {
        sessionId: r.roomCode,
        roomCode: r.roomCode,
        chatId: 0,
        chatTitle: quizTitle,
        quizId: r.quizId,
        quizTitle,
        hostId: r.hostId,
        status: r.status,
        currentIndex: Number(r.currentIndex || 0),
        totalQuestions: Math.max(1, Number(totalQ || 10)),
        participantCount: Math.max(1, participantCount),
        maxPlayers: 10,
        isHost: currentUserId ? Number(r.hostId) === currentUserId : false,
        isJoined: isUserJoined,
        startedAt: r.createdAt,
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
        shareLink: `https://t.me/${CONFIG.BOT.USERNAME}/app?startapp=battle_${q.id}`,
      };
    })
  );

  return {
    activeSessions,
    launchableQuizzes: formattedQuizzes,
  };
}
