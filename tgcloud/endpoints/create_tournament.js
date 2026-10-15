// tgcloud/endpoints/create_tournament.js
import { db } from 'sdk';
import { eq } from 'sdk/db';
import { groupTournaments, quizzes, questions } from '../schema.js';
import { CONFIG } from '../lib/constants/config.js';
import { ERRORS } from '../lib/constants/errors.js';
import { getMessage } from '../lib/constants/messages.js';

export default async function (input, ctx) {
  const tgUser = ctx?.initData?.user;
  const currentUserId = tgUser?.id || 0;
  const quizId = parseInt(input?.quizId, 10) || 0;

  if (!quizId) {
    return { success: false, error: ERRORS.INVALID_QUIZ_ID };
  }

  // 1. Fetch quiz
  const quiz = await db.select({
    id: quizzes.id,
    title: quizzes.title,
    description: quizzes.description,
    timeLimit: quizzes.timeLimit,
  }).from(quizzes).where(eq(quizzes.id, quizId)).get();

  if (!quiz) {
    return { success: false, error: ERRORS.QUIZ_NOT_FOUND };
  }

  // Count questions
  const qCount = await db.$count(questions, eq(questions.quizId, quizId));
  if (!qCount || qCount === 0) {
    return { success: false, error: ERRORS.QUIZ_HAS_NO_QUESTIONS };
  }

  // 2. Generate unique shareCode
  const randSuffix = Math.random().toString(36).substring(2, 8);
  const shareCode = `gt_${quizId}_${randSuffix}`;

  // 3. Insert into groupTournaments
  const insertRes = await db.insert(groupTournaments).values({
    quizId,
    creatorId: currentUserId,
    title: quiz.title,
    shareCode,
    isActive: true,
  }).run();

  const tournamentId = insertRes?.lastInsertRowid;

  const botUsername = CONFIG.BOT.USERNAME;
  const shareLink = `https://t.me/${botUsername}/app?startapp=${shareCode}`;
  const shareText = getMessage('TOURNAMENT_INVITE_TEXT', 'UZ', { title: quiz.title, count: qCount });
  const telegramShareUrl = `https://t.me/share/url?url=${encodeURIComponent(shareLink)}&text=${encodeURIComponent(shareText)}`;

  return {
    success: true,
    tournamentId,
    shareCode,
    shareLink,
    telegramShareUrl,
    title: quiz.title,
    questionCount: qCount,
  };

}
