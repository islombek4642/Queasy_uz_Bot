// tgcloud/lib/keyboards/subscribe_keyboard.js
// Forced channel subscription inline keyboard

import { getMessage } from '../constants/messages.js';
import { ACTIONS } from '../constants/actions.js';

export function getSubscribeKeyboard(channels, lang = 'UZ') {
  const inline_keyboard = [];

  for (const ch of channels) {
    inline_keyboard.push([
      {
        text: `📢 ${ch.title}`,
        url: ch.inviteLink,
      },
    ]);
  }

  inline_keyboard.push([
    {
      text: getMessage('BTN_CHECK_SUB', lang),
      callback_data: ACTIONS.CHECK_SUB,
    },
  ]);

  return { inline_keyboard };
}

export function getLanguageKeyboard(lang = 'UZ') {
  return {
    inline_keyboard: [
      [
        { text: "🇺🇿 O'zbekcha", callback_data: `${ACTIONS.SET_LANG_PREFIX}UZ` },
      ],
      [
        { text: '🇷🇺 Русский', callback_data: `${ACTIONS.SET_LANG_PREFIX}RU` },
        { text: '🇺🇸 English', callback_data: `${ACTIONS.SET_LANG_PREFIX}EN` },
      ],
      [
        { text: getMessage('BTN_MAIN_MENU', lang), callback_data: ACTIONS.BACK_TO_MENU },
      ],
    ],
  };
}

export default { getSubscribeKeyboard, getLanguageKeyboard };
