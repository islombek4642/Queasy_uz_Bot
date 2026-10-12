// tgcloud/lib/keyboards/admin_keyboard.js
// Admin dashboard and management inline keyboards

import { getMessage } from '../constants/messages.js';
import { ACTIONS } from '../constants/actions.js';

export function getAdminDashboardKeyboard(lang = 'UZ') {
  return {
    inline_keyboard: [
      [
        { text: getMessage('BTN_ADMIN_STATS', lang), callback_data: ACTIONS.ADMIN_STATS },
        { text: getMessage('BTN_ADMIN_BROADCAST', lang), callback_data: ACTIONS.ADMIN_BROADCAST },
      ],
      [
        { text: getMessage('BTN_ADMIN_USERS', lang), callback_data: ACTIONS.ADMIN_USERS },
        { text: getMessage('BTN_ADMIN_GROUPS', lang), callback_data: ACTIONS.ADMIN_GROUPS },
      ],
      [
        { text: getMessage('BTN_ADMIN_CHANNELS', lang), callback_data: ACTIONS.ADMIN_CHANNELS },
        { text: getMessage('BTN_ADMIN_MEDIA_CHANNEL', lang), callback_data: ACTIONS.ADMIN_MEDIA_CHANNEL },
      ],
    ],
  };
}

export function getAdminMediaChannelKeyboard(hasChannel = false, lang = 'UZ') {
  const inline_keyboard = [
    [
      { text: getMessage('BTN_SET_MEDIA_CHANNEL', lang), callback_data: ACTIONS.ADMIN_SET_MEDIA_CHANNEL },
    ],
  ];

  if (hasChannel) {
    inline_keyboard.push([
      { text: getMessage('BTN_REMOVE_MEDIA_CHANNEL', lang), callback_data: ACTIONS.ADMIN_DEL_MEDIA_CHANNEL },
    ]);
  }

  inline_keyboard.push([
    { text: getMessage('BTN_ADMIN_MENU', lang), callback_data: ACTIONS.ADMIN_MENU },
  ]);

  return { inline_keyboard };
}

export function getAdminChannelsKeyboard(channelsList, lang = 'UZ') {
  const inline_keyboard = [];

  for (const ch of channelsList) {
    inline_keyboard.push([
      { text: `📢 ${ch.title}`, url: ch.inviteLink },
      { text: getMessage('BTN_DELETE_ACTION', lang), callback_data: `${ACTIONS.ADMIN_DEL_CHANNEL_PREFIX}${ch.id}` },
    ]);
  }

  inline_keyboard.push([
    { text: getMessage('BTN_ADD_CHANNEL', lang), callback_data: ACTIONS.ADMIN_ADD_CHANNEL },
  ]);
  inline_keyboard.push([
    { text: getMessage('BTN_ADMIN_MENU', lang), callback_data: ACTIONS.ADMIN_MENU },
  ]);

  return { inline_keyboard };
}

export function getAdminConfirmBroadcastKeyboard(lang = 'UZ') {
  return {
    inline_keyboard: [
      [
        { text: getMessage('BTN_CONFIRM_BROADCAST', lang), callback_data: ACTIONS.ADMIN_BROADCAST_CONFIRM },
        { text: getMessage('BTN_CANCEL', lang), callback_data: ACTIONS.ADMIN_MENU },
      ],
    ],
  };
}

export function getAdminPaginationKeyboard(prefix, page, totalPages, lang = 'UZ') {
  const inline_keyboard = [];
  const navRow = [];

  if (page > 0) {
    navRow.push({
      text: getMessage('BTN_PREV', lang),
      callback_data: `${prefix}${page - 1}`,
    });
  }

  if (totalPages > 1) {
    navRow.push({
      text: `${page + 1} / ${totalPages}`,
      callback_data: 'noop',
    });
  }

  if (page + 1 < totalPages) {
    navRow.push({
      text: getMessage('BTN_NEXT', lang),
      callback_data: `${prefix}${page + 1}`,
    });
  }

  if (navRow.length > 0) {
    inline_keyboard.push(navRow);
  }

  inline_keyboard.push([
    { text: getMessage('BTN_ADMIN_MENU', lang), callback_data: ACTIONS.ADMIN_MENU },
  ]);

  return { inline_keyboard };
}

export default {
  getAdminDashboardKeyboard,
  getAdminChannelsKeyboard,
  getAdminConfirmBroadcastKeyboard,
  getAdminPaginationKeyboard,
};
