// tgcloud/lib/keyboards/quiz_keyboard.js
// Inline keyboards for quiz cards, pagination, settings, and sharing

import { getMessage } from '../constants/messages.js';
import { ACTIONS } from '../constants/actions.js';
import { CONFIG } from '../constants/config.js';

export function getQuizCardKeyboard(quiz, lang = 'UZ', isOwner = true, hasMistakes = false, backCallbackData = null) {
  const inline_keyboard = [];

  // 1. Review mistakes button if any
  if (hasMistakes) {
    inline_keyboard.push([
      {
        text: getMessage('BTN_REVIEW_MISTAKES', lang),
        callback_data: `${ACTIONS.REVIEW_MISTAKES_PREFIX}${quiz.id}`,
      },
    ]);
  }

  // 2. Play buttons: Solo and Group (3 separate rows)
  inline_keyboard.push([
    {
      text: getMessage('BTN_START_QUIZ', lang),
      callback_data: `${ACTIONS.START_QUIZ_PREFIX}${quiz.id}`,
    },
  ]);

  inline_keyboard.push([
    {
      text: getMessage('BTN_START_GROUP_QUIZ', lang),
      callback_data: `${ACTIONS.START_GROUP_QUIZ_PREFIX}${quiz.id}`,
    },
  ]);

  // 3. Share button
  inline_keyboard.push([
    {
      text: getMessage('BTN_SHARE_QUIZ', lang),
      switch_inline_query: `quiz_${quiz.id}`,
    },
  ]);

  // 4. Owner management or Clone button
  if (isOwner) {
    inline_keyboard.push([
      {
        text: getMessage('BTN_CHANGE_TIME', lang),
        callback_data: `${ACTIONS.CHANGE_TIME_PREFIX}${quiz.id}`,
      },
      {
        text: getMessage('BTN_DELETE_QUIZ', lang),
        callback_data: `${ACTIONS.DELETE_QUIZ_PREFIX}${quiz.id}`,
      },
    ]);
  } else {
    inline_keyboard.push([
      {
        text: getMessage('BTN_CLONE_QUIZ', lang),
        callback_data: `${ACTIONS.CLONE_QUIZ_PREFIX}${quiz.id}`,
      },
    ]);
  }

  // 5. Back button
  if (backCallbackData) {
    inline_keyboard.push([
      {
        text: getMessage('BTN_BACK', lang),
        callback_data: backCallbackData,
      },
    ]);
  }

  return { inline_keyboard };
}

export function getMyQuizzesPageKeyboard(quizzesList, page = 0, totalCount = 0, lang = 'UZ') {
  const inline_keyboard = [];

  for (const q of quizzesList) {
    const title = q.title.length > 35 ? q.title.slice(0, 32) + '...' : q.title;
    inline_keyboard.push([
      {
        text: `📌 ${title}`,
        callback_data: `${ACTIONS.VIEW_QUIZ_PREFIX}${q.id}:my:${page}`,
      },
    ]);
  }

  const pageSize = CONFIG.PAGINATION?.MY_QUIZZES || 8;
  const totalPages = Math.ceil(totalCount / pageSize) || 1;

  // Navigation row if more than 1 page
  if (totalPages > 1) {
    const navRow = [];
    if (page > 0) {
      navRow.push({
        text: getMessage('BTN_PREV', lang),
        callback_data: `${ACTIONS.MY_QUIZZES_PAGE_PREFIX}${page - 1}`,
      });
    }

    navRow.push({
      text: `📄 ${page + 1}/${totalPages}`,
      callback_data: 'noop',
    });

    if (page < totalPages - 1) {
      navRow.push({
        text: getMessage('BTN_NEXT', lang),
        callback_data: `${ACTIONS.MY_QUIZZES_PAGE_PREFIX}${page + 1}`,
      });
    }

    inline_keyboard.push(navRow);
  }

  return { inline_keyboard };
}

export function getTimeLimitKeyboard(quizId, lang = 'UZ') {
  const formatTime = (sec) => {
    if (sec >= 60 && sec % 60 === 0) {
      return getMessage('TIME_MINUTES', lang, { n: sec / 60 });
    }
    return getMessage('TIME_SECONDS', lang, { n: sec });
  };

  const inline_keyboard = [
    [
      { text: formatTime(10), callback_data: `${ACTIONS.SET_TIME_PREFIX}${quizId}:10` },
      { text: formatTime(15), callback_data: `${ACTIONS.SET_TIME_PREFIX}${quizId}:15` },
      { text: formatTime(30), callback_data: `${ACTIONS.SET_TIME_PREFIX}${quizId}:30` },
    ],
    [
      { text: formatTime(45), callback_data: `${ACTIONS.SET_TIME_PREFIX}${quizId}:45` },
      { text: formatTime(60), callback_data: `${ACTIONS.SET_TIME_PREFIX}${quizId}:60` },
      { text: formatTime(120), callback_data: `${ACTIONS.SET_TIME_PREFIX}${quizId}:120` },
    ],
    [
      { text: getMessage('BTN_BACK', lang), callback_data: `${ACTIONS.VIEW_QUIZ_PREFIX}${quizId}` },
    ],
  ];

  return { inline_keyboard };
}

export function getConfirmDeleteKeyboard(quizId, lang = 'UZ') {
  return {
    inline_keyboard: [
      [
        { text: getMessage('BTN_CONFIRM_DELETE', lang), callback_data: `${ACTIONS.CONFIRM_DELETE_PREFIX}${quizId}` },
        { text: getMessage('BTN_CANCEL_DELETE', lang), callback_data: `${ACTIONS.VIEW_QUIZ_PREFIX}${quizId}` },
      ],
    ],
  };
}

export function getMistakesPageKeyboard(grouped, page = 0, lang = 'UZ') {
  const PAGE_SIZE = CONFIG.PAGINATION?.MISTAKES || 8;
  const totalItems = grouped.length;
  const totalPages = Math.ceil(totalItems / PAGE_SIZE) || 1;
  const currentPage = Math.max(0, Math.min(page, totalPages - 1));

  const start = currentPage * PAGE_SIZE;
  const end = Math.min(start + PAGE_SIZE, totalItems);
  const currentChunk = grouped.slice(start, end);

  const inline_keyboard = [];

  for (const g of currentChunk) {
    const rawTitle = g.title || `Test #${g.quizId}`;
    const title = rawTitle.length > 34 ? rawTitle.slice(0, 31) + '...' : rawTitle;
    inline_keyboard.push([
      {
        text: getMessage('MISTAKES_SUBJECT_BTN', lang, { title, count: g.count }),
        callback_data: `${ACTIONS.REVIEW_MISTAKES_PREFIX}${g.quizId}`,
      },
    ]);
  }

  // Navigation row if multiple pages
  if (totalPages > 1) {
    const navRow = [];
    if (currentPage > 0) {
      navRow.push({
        text: getMessage('BTN_PREV', lang),
        callback_data: `${ACTIONS.MISTAKES_PAGE_PREFIX}${currentPage - 1}`,
      });
    }

    navRow.push({
      text: `📄 ${currentPage + 1}/${totalPages}`,
      callback_data: 'noop',
    });

    if (currentPage < totalPages - 1) {
      navRow.push({
        text: getMessage('BTN_NEXT', lang),
        callback_data: `${ACTIONS.MISTAKES_PAGE_PREFIX}${currentPage + 1}`,
      });
    }

    inline_keyboard.push(navRow);
  }

  return { inline_keyboard };
}

export default {
  getQuizCardKeyboard,
  getMyQuizzesPageKeyboard,
  getTimeLimitKeyboard,
  getConfirmDeleteKeyboard,
  getMistakesPageKeyboard,
};

