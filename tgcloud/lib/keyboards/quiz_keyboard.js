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

  // 2. Play buttons: Solo and Group
  inline_keyboard.push([
    {
      text: getMessage('BTN_START_QUIZ', lang),
      callback_data: `${ACTIONS.START_QUIZ_PREFIX}${quiz.id}`,
    },
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

export function getMyQuizzesPageKeyboard(quizzesList, page, totalCount, lang = 'UZ') {
  const inline_keyboard = [];

  for (const q of quizzesList) {
    const title = q.title.length > 35 ? q.title.slice(0, 32) + '...' : q.title;
    inline_keyboard.push([
      {
        text: `📌 ${title}`,
        callback_data: `${ACTIONS.VIEW_QUIZ_PREFIX}${q.id}`,
      },
    ]);
  }

  // Navigation row
  const navRow = [];
  if (page > 0) {
    navRow.push({
      text: getMessage('BTN_PREV', lang),
      callback_data: `${ACTIONS.MY_QUIZZES_PAGE_PREFIX}${page - 1}`,
    });
  }

  const offset = (page + 1) * CONFIG.PAGINATION.MY_QUIZZES;
  if (offset < totalCount) {
    navRow.push({
      text: getMessage('BTN_NEXT', lang),
      callback_data: `${ACTIONS.MY_QUIZZES_PAGE_PREFIX}${page + 1}`,
    });
  }

  if (navRow.length > 0) {
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

export default {
  getQuizCardKeyboard,
  getMyQuizzesPageKeyboard,
  getTimeLimitKeyboard,
  getConfirmDeleteKeyboard,
};
