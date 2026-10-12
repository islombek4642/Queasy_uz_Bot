// tgcloud/lib/keyboards/mode_keyboard.js
// 3 Solo Test Modes reply keyboard

import { getMessage } from '../constants/messages.js';
import { ACTIONS } from '../constants/actions.js';


export function getModeKeyboard(lang = 'UZ') {
  return {
    keyboard: [
      [{ text: getMessage('BTN_MODE_FULL', lang) }],
      [{ text: getMessage('BTN_MODE_RANGE', lang) }],
      [{ text: getMessage('BTN_MODE_RANDOM', lang) }],
      [{ text: getMessage('BTN_CANCEL', lang) }],
    ],
    resize_keyboard: true,
  };
}

export function getInlineModeKeyboard(quizId, lang = 'UZ', backCallbackData = null) {
  return {
    inline_keyboard: [
      [{ text: getMessage('BTN_MODE_FULL', lang), callback_data: `mode_full:${quizId}` }],
      [{ text: getMessage('BTN_MODE_RANGE', lang), callback_data: `mode_range:${quizId}` }],
      [{ text: getMessage('BTN_MODE_RANDOM', lang), callback_data: `mode_random:${quizId}` }],
      [{ text: getMessage('BTN_BACK', lang), callback_data: backCallbackData || `${ACTIONS.VIEW_QUIZ_PREFIX}${quizId}` }],
    ],
  };
}

export function getStopKeyboard(lang = 'UZ') {
  return {
    keyboard: [
      [{ text: getMessage('BTN_STOP_QUIZ', lang) }],
    ],
    resize_keyboard: true,
  };
}

export default { getModeKeyboard, getInlineModeKeyboard, getStopKeyboard };


