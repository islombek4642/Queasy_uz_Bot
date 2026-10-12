// tgcloud/handlers/inline_query.js
// Handles inline quiz sharing across chats (@Queasy_uz_Bot quiz_123)

import { api } from 'sdk';
import { CONFIG } from '../lib/constants/config.js';
import { getMessage } from '../lib/constants/messages.js';
import { getQuizById, getUserQuizzes } from '../lib/services/quiz_service.js';

export default async function (inlineQuery, ctx) {
  if (!inlineQuery || !inlineQuery.id) return;

  const query = inlineQuery.query?.trim() || '';
  const results = [];
  const lang = inlineQuery.from?.language_code?.toUpperCase()?.includes('RU') ? 'RU' : 'UZ';
  const userId = inlineQuery.from?.id;

  const formatQuizArticle = (quiz) => {
    const qCount = quiz.questions?.length ?? quiz.questionCount ?? 0;
    return {
      type: 'article',
      id: String(quiz.id),
      title: quiz.title,
      description: getMessage('INLINE_QUIZ_DESC', lang, { count: qCount, time: quiz.timeLimit }),
      input_message_content: {
        message_text: getMessage('INLINE_QUIZ_BODY', lang, {
          id: quiz.id,
          title: quiz.title,
          count: qCount,
          time: quiz.timeLimit,
        }),
        parse_mode: 'HTML',
      },
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: getMessage('BTN_START_QUIZ', lang),
              url: `https://t.me/${CONFIG.BOT.USERNAME}?start=quiz_${quiz.id}`,
            },
            {
              text: getMessage('BTN_START_GROUP_QUIZ', lang),
              url: `https://t.me/${CONFIG.BOT.USERNAME}?startgroup=quiz_${quiz.id}`,
            },
          ],
        ],
      },
    };
  };

  // 1. If query contains a quiz ID (e.g. "quiz_123", "quiz 123", or just "123")
  const idMatch = query.match(/(?:quiz[_\s]*)?(\d+)/i);
  if (idMatch && idMatch[1]) {
    const quizId = parseInt(idMatch[1], 10);
    if (quizId) {
      const quiz = await getQuizById(quizId);
      if (quiz) {
        results.push(formatQuizArticle(quiz));
      }
    }
  }

  // 2. If query is empty or didn't match a specific ID, list user's recent quizzes
  if (results.length === 0 && userId) {
    try {
      const userQuizzes = await getUserQuizzes(userId, 0, 10);
      for (const q of userQuizzes) {
        results.push(formatQuizArticle(q));
      }
    } catch (err) {
      console.warn('[inline_query] Error fetching user quizzes:', err?.message);
    }
  }

  try {
    await api.answerInlineQuery({
      inline_query_id: inlineQuery.id,
      results,
      cache_time: 5,
      is_personal: true,
    });
  } catch (err) {
    console.error('Error answering inline query:', err);
  }
}
