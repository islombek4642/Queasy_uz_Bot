// tgcloud/lib/keyboards/main_keyboard.js
// Main reply keyboard generator (Zero-hardcode)

import { getMessage } from '../constants/messages.js';

export function getMainKeyboard(lang = 'UZ', isAdmin = false) {
  const lastRow = [{ text: getMessage('BTN_HELP', lang) }];
  if (isAdmin) {
    lastRow.push({ text: getMessage('BTN_ADMIN', lang) });
  }

  const keyboard = [
    [
      { text: getMessage('BTN_KIUT_TEST', lang) },
    ],
    [
      { text: getMessage('BTN_UPLOAD_TEST', lang) },
      { text: getMessage('BTN_MY_QUIZZES', lang) },
    ],
    [
      { text: getMessage('BTN_MY_MISTAKES', lang) },
      { text: getMessage('BTN_ADD_TO_GROUP', lang) },
    ],
    [
      { text: getMessage('BTN_SHARE_BOT', lang) },
      { text: getMessage('BTN_LANGUAGE', lang) },
    ],
    lastRow,
  ];

  return {
    keyboard,
    resize_keyboard: true,
  };
}

export function getCancelKeyboard(lang = 'UZ') {
  return {
    keyboard: [[{ text: getMessage('BTN_CANCEL', lang) }]],
    resize_keyboard: true,
  };
}

export function getLanguageReplyKeyboard(lang = 'UZ') {
  return {
    keyboard: [
      [
        { text: "🇺🇿 O'zbekcha" },
      ],
      [
        { text: '🇷🇺 Русский' },
        { text: '🇺🇸 English' },
      ],
      [
        { text: getMessage('BTN_BACK', lang) },
      ],
    ],
    resize_keyboard: true,
  };
}

export default { getMainKeyboard, getCancelKeyboard, getLanguageReplyKeyboard };
