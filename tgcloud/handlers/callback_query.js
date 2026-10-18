// tgcloud/handlers/callback_query.js
// Handles all incoming Telegram callback queries

import { api, db } from 'sdk';
import { eq, and, like } from 'sdk/db';
import { quizSessions, quizzes as quizzesTable, categories as categoriesTable } from '../schema.js';
import { CONFIG } from '../lib/constants/config.js';
import { ACTIONS, STATES } from '../lib/constants/actions.js';
import { getMessage } from '../lib/constants/messages.js';
import turso from '../lib/turso_client.js';

import {
  getUser,
  setUserLanguage,
  getUserState,
  setUserState,
  clearUserState,
} from '../lib/services/user_service.js';

import {
  checkUserSubscribed,
  getRequiredChannels,
  deleteRequiredChannel,
} from '../lib/services/channel_service.js';

import {
  getQuizById,
  getUserQuizzes,
  getUserQuizzesCount,
  deleteQuiz,
  updateQuizSettings,
  cloneQuiz,
} from '../lib/services/quiz_service.js';

import {
  startQuizSession,
  getUserMistakesCount,
  getUserMistakesGrouped,
  clearUserMistakes,
  announceGroupLobby,
  handleLobbyJoin,
  handleLobbyStart,
  handleLobbyCancel,
  advanceGroupRound,
  isChatAdmin,
  resumeQuizSession,
} from '../lib/services/session_service.js';

import { listGroups, getGroupsCount } from '../lib/services/group_service.js';
import { isUserAdmin, getBotStatistics, listUsers, getUsersCount, broadcastMessage, getMediaChannel, removeMediaChannel } from '../lib/services/admin_service.js';

import { getMainKeyboard, getCancelKeyboard } from '../lib/keyboards/main_keyboard.js';
import { getInlineModeKeyboard, getModeKeyboard } from '../lib/keyboards/mode_keyboard.js';
import {
  getQuizCardKeyboard,
  getMyQuizzesPageKeyboard,
  getTimeLimitKeyboard,
  getConfirmDeleteKeyboard,
  getMistakesPageKeyboard,
} from '../lib/keyboards/quiz_keyboard.js';
import {
  getAdminDashboardKeyboard,
  getAdminChannelsKeyboard,
  getAdminMediaChannelKeyboard,
  getAdminPaginationKeyboard,
} from '../lib/keyboards/admin_keyboard.js';

function escapeHtml(str = '') {
  const text = typeof str?.toWellFormed === 'function' ? str.toWellFormed() : String(str || '');
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function truncateText(str = '', maxLen = 25) {
  const clean = String(str || '').replace(/\s+/g, ' ').trim();
  const chars = Array.from(clean);
  if (chars.length > maxLen) {
    return chars.slice(0, maxLen - 3).join('') + '...';
  }
  return clean;
}

function formatDateTimeUz(val) {
  if (!val) return '';
  const d = val instanceof Date ? val : new Date(typeof val === 'number' && val < 1e11 ? val * 1000 : val);
  if (isNaN(d.getTime())) return '';
  // Tashkent time is UTC+5 (5 * 3600 * 1000 ms)
  const uzDate = new Date(d.getTime() + 5 * 3600 * 1000);
  const day = String(uzDate.getUTCDate()).padStart(2, '0');
  const month = String(uzDate.getUTCMonth() + 1).padStart(2, '0');
  const year = uzDate.getUTCFullYear();
  const hours = String(uzDate.getUTCHours()).padStart(2, '0');
  const minutes = String(uzDate.getUTCMinutes()).padStart(2, '0');
  return `${day}.${month}.${year} ${hours}:${minutes}`;
}

export default async function (callbackQuery, ctx) {
  if (!callbackQuery || !callbackQuery.from) return;

  const data = callbackQuery.data || '';
  const fromUser = callbackQuery.from;
  const userId = fromUser.id;
  const message = callbackQuery.message;
  const chatId = message?.chat?.id || userId;
  const messageId = message?.message_id;

  const user = await getUser(userId);
  const lang = user?.lang || CONFIG.I18N.DEFAULT_LANG;
  const isAdmin = isUserAdmin(userId);

  // Helper to answer callback query safely
  const answer = async (text = '', showAlert = false) => {
    try {
      await api.answerCallbackQuery({
        callback_query_id: callbackQuery.id,
        text,
        show_alert: showAlert,
      });
    } catch {
      // Ignore network/timing glitches
    }
  };

  // Helper to edit messages safely without throwing on unmodified or entity error
  const safeEditMessageText = async (params) => {
    const rawText = typeof params?.text?.toWellFormed === 'function' ? params.text.toWellFormed() : (params?.text || '');
    const cleanParams = { ...params, text: rawText };
    try {
      return await api.editMessageText(cleanParams);
    } catch (err) {
      const errStr = String(err?.message || err);
      if (errStr.includes('message is not modified')) {
        return; // Ignore duplicated or same content edits
      }
      if (cleanParams.parse_mode && (errStr.includes('parse') || errStr.includes('entity') || errStr.includes('UTF-8'))) {
        try {
          return await api.editMessageText({
            ...cleanParams,
            text: (cleanParams.text || '').replace(/<[^>]*>/g, ''),
            parse_mode: undefined,
          });
        } catch {}
      }
      console.error('safeEditMessageText error:', err);
    }
  };

  if (data === 'noop') {
    await answer();
    return;
  }

  // 1. Forced Subscription Check
  if (data === ACTIONS.CHECK_SUB) {
    const subCheck = await checkUserSubscribed(api, userId);
    if (subCheck.isSubscribed) {
      await answer(getMessage('FORCE_SUB_SUCCESS', lang), false);
      if (messageId) {
        try {
          await api.deleteMessage({ chat_id: chatId, message_id: messageId });
        } catch {}
      }
      const userName = [fromUser.first_name, fromUser.last_name].filter(Boolean).join(' ');
      await api.sendMessage({
        chat_id: chatId,
        text: getMessage('START_WELCOME', lang, { name: userName }),
        parse_mode: 'HTML',
        reply_markup: getMainKeyboard(lang, isAdmin),
      });
    } else {
      await answer(getMessage('FORCE_SUB_FAILED', lang), true);
    }
    return;
  }

  // 2. Language Selection
  if (data.startsWith(ACTIONS.SET_LANG_PREFIX)) {
    const newLang = data.replace(ACTIONS.SET_LANG_PREFIX, '');
    await setUserLanguage(userId, newLang);
    await answer(getMessage('LANG_CHANGED_SUCCESS', newLang));

    if (messageId) {
      try {
        await api.deleteMessage({ chat_id: chatId, message_id: messageId });
      } catch {}
    }

    const userName = [fromUser.first_name, fromUser.last_name].filter(Boolean).join(' ');
    await api.sendMessage({
      chat_id: chatId,
      text: getMessage('START_WELCOME', newLang, { name: userName }),
      parse_mode: 'HTML',
      reply_markup: getMainKeyboard(newLang, isAdmin),
    });
    return;
  }

  // 3. Navigation: Back to Main Menu
  if (data === ACTIONS.BACK_TO_MENU) {
    await clearUserState(userId);
    await answer();
    if (messageId) {
      try {
        await api.deleteMessage({ chat_id: chatId, message_id: messageId });
      } catch {}
    }
    const userName = [fromUser.first_name, fromUser.last_name].filter(Boolean).join(' ');
    await api.sendMessage({
      chat_id: chatId,
      text: getMessage('START_WELCOME', lang, { name: userName }),
      parse_mode: 'HTML',
      reply_markup: getMainKeyboard(lang, isAdmin),
    });
    return;
  }

  // KIUT Catalog navigation (64-byte safe using compact category IDs)
  if (data.startsWith('kiut_c:') || data.startsWith('kiut_cat:')) {
    await answer();
    await clearUserState(userId);

    let catId = 0;
    if (data.startsWith('kiut_c:')) {
      catId = parseInt(data.replace('kiut_c:', ''), 10) || 0;
    } else {
      const legacyPath = data.replace('kiut_cat:', '').trim();
      let rec = null;
      if (CONFIG.TURSO?.ENABLED) {
        try { rec = await turso.get('SELECT id FROM categories WHERE path = ?', [legacyPath]); } catch {}
      }
      if (!rec) {
        rec = await db.select().from(categoriesTable).where(eq(categoriesTable.path, legacyPath)).get();
      }
      catId = rec?.id || 0;
    }

    // Root level menu
    if (catId === 0) {
      const inline_keyboard = [
        [
          { text: "☀️ Kunduzgi ta'lim", callback_data: "kiut_c:1" },
          { text: "📚 Sirtqi ta'lim", callback_data: "kiut_c:2" },
        ],
        [
          { text: "🌙 Kechki ta'lim", callback_data: "kiut_c:3" },
          { text: "💻 Masofaviy ta'lim", callback_data: "kiut_c:4" },
        ],
        [
          { text: "🩺 Tibbiyot", callback_data: "kiut_c:6" },
          { text: "🔄 Fanlar farqi", callback_data: "kiut_c:5" },
        ],
        [
          {
            text: "📱 Mini App orqali to'liq katalog",
            web_app: { url: CONFIG.BOT.WEBAPP_URL || 'https://app8869835041.tgcloud.ai/' },
          },
        ],
      ];

      try {
        await api.editMessageText({
          chat_id: chatId,
          message_id: messageId,
          text: getMessage('KIUT_MENU_HEADER', lang),
          parse_mode: 'HTML',
          reply_markup: { inline_keyboard },
        });
      } catch {
        await api.sendMessage({
          chat_id: chatId,
          text: getMessage('KIUT_MENU_HEADER', lang),
          parse_mode: 'HTML',
          reply_markup: { inline_keyboard },
        });
      }
      return;
    }

    let currentCat = null;
    if (CONFIG.TURSO?.ENABLED) {
      try { currentCat = await turso.get('SELECT * FROM categories WHERE id = ?', [catId]); } catch {}
    }
    if (!currentCat) {
      currentCat = await db.select().from(categoriesTable).where(eq(categoriesTable.id, catId)).get();
    }
    const catPath = currentCat?.path || '';

    if (!catPath) {
      await answer(getMessage('ERR_SECTION_NOT_FOUND', lang), true);
      return;
    }

    // Find direct subcategories using categories table
    const prefix = `${catPath} /`;
    let allChildCats = [];
    if (CONFIG.TURSO?.ENABLED) {
      try {
        allChildCats = await turso.all('SELECT id, path FROM categories WHERE path LIKE ?', [`${prefix}%`]);
      } catch {}
    }
    if (!allChildCats || allChildCats.length === 0) {
      allChildCats = await db
        .select()
        .from(categoriesTable)
        .where(like(categoriesTable.path, `${prefix}%`))
        .all();
    }

    const subMap = new Map();
    for (const row of allChildCats) {
      const remainder = row.path.slice(prefix.length).trim();
      const nextSeg = remainder.split(' / ')[0].trim();
      if (nextSeg && !subMap.has(nextSeg)) {
        const fullNextPath = `${catPath} / ${nextSeg}`;
        const matchedChild = allChildCats.find((c) => c.path === fullNextPath);
        if (matchedChild) {
          subMap.set(nextSeg, matchedChild.id);
        }
      }
    }

    // Naturally sort subcategories (e.g. 1-SEMESTR, 2-SEMESTR, ... 10-SEMESTR)
    const sortedSubList = Array.from(subMap.entries()).sort(([a], [b]) =>
      a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
    );

    // Find direct quizzes directly under catPath
    let directQuizzes = [];
    if (CONFIG.TURSO?.ENABLED) {
      try {
        directQuizzes = await turso.all(
          'SELECT id, title FROM quizzes WHERE is_public = 1 AND category = ? LIMIT 60',
          [catPath]
        );
      } catch {}
    }
    if (!directQuizzes || directQuizzes.length === 0) {
      directQuizzes = await db
        .select({ id: quizzesTable.id, title: quizzesTable.title })
        .from(quizzesTable)
        .where(and(eq(quizzesTable.isPublic, true), eq(quizzesTable.category, catPath)))
        .limit(60)
        .all();
    }

    // Naturally sort direct quizzes
    directQuizzes.sort((a, b) =>
      a.title.localeCompare(b.title, undefined, { numeric: true, sensitivity: 'base' })
    );

    const inline_keyboard = [];

    // Subcategory buttons
    for (const [subName, subId] of sortedSubList) {
      inline_keyboard.push([
        {
          text: `📁 ${truncateText(subName, 32)}`,
          callback_data: `kiut_c:${subId}`,
        },
      ]);
    }

    // Direct quiz buttons (clicking a subject opens the Test Card first)
    for (const q of directQuizzes) {
      inline_keyboard.push([
        {
          text: `▶️ ${truncateText(q.title, 32)}`,
          callback_data: `${ACTIONS.VIEW_QUIZ_PREFIX}${q.id}:${catId}`,
        },
      ]);
    }

    // Parent navigation / Back button
    const pathParts = catPath.split(' / ');
    pathParts.pop();
    const parentPath = pathParts.join(' / ');

    let parentId = 0;
    if (parentPath) {
      let parentRec = null;
      if (CONFIG.TURSO?.ENABLED) {
        try { parentRec = await turso.get('SELECT id FROM categories WHERE path = ?', [parentPath]); } catch {}
      }
      if (!parentRec) {
        parentRec = await db.select().from(categoriesTable).where(eq(categoriesTable.path, parentPath)).get();
      }
      parentId = parentRec?.id || 0;
    }

    inline_keyboard.push([
      {
        text: '⬅️ Orqaga',
        callback_data: `kiut_c:${parentId}`,
      },
      {
        text: '📱 Mini App',
        web_app: { url: CONFIG.BOT.WEBAPP_URL || 'https://app8869835041.tgcloud.ai/' },
      },
    ]);

    try {
      await api.editMessageText({
        chat_id: chatId,
        message_id: messageId,
        text: `🏛 <b>KIUT Testlari</b>\n📍 <code>${escapeHtml(catPath)}</code>\n\nKerakli bo'lim yoki fanni tanlang:`,
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard },
      });
    } catch {
      await api.sendMessage({
        chat_id: chatId,
        text: `🏛 <b>KIUT Testlari</b>\n📍 <code>${escapeHtml(catPath)}</code>\n\nKerakli bo'lim yoki fanni tanlang:`,
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard },
      });
    }
    return;
  }

  // 4. Start Quiz -> Show 3 Solo Modes
  if (data.startsWith(ACTIONS.START_QUIZ_PREFIX)) {
    const raw = data.replace(ACTIONS.START_QUIZ_PREFIX, '');
    const parts = raw.split(':');
    const quizId = parseInt(parts[0], 10);

    const quiz = await getQuizById(quizId);
    if (!quiz) {
      await answer(getMessage('ERR_NOT_FOUND', lang), true);
      return;
    }

    await answer();
    await setUserState(userId, STATES.SELECTING_MODE, { quizId });

    if (messageId) {
      try {
        await api.editMessageText({
          chat_id: chatId,
          message_id: messageId,
          text: getMessage('PROMPT_SELECT_MODE', lang),
          parse_mode: 'HTML',
          reply_markup: getInlineModeKeyboard(quizId, lang),
        });
        return;
      } catch {}
    }

    await api.sendMessage({
      chat_id: chatId,
      text: getMessage('PROMPT_SELECT_MODE', lang),
      parse_mode: 'HTML',
      reply_markup: getInlineModeKeyboard(quizId, lang),
    });
    return;
  }

  // 4b. Start Group Quiz -> Show group picker / add to group
  if (data.startsWith(ACTIONS.START_GROUP_QUIZ_PREFIX)) {
    const quizId = parseInt(data.replace(ACTIONS.START_GROUP_QUIZ_PREFIX, ''), 10);
    const quiz = await getQuizById(quizId);
    if (!quiz) {
      await answer(getMessage('ERR_NOT_FOUND', lang), true);
      return;
    }

    await answer();

    const botUsername = CONFIG.BOT.USERNAME || 'Queasy_uz_Bot';
    const allGroups = await listGroups(0, 50);
    const inline_keyboard = [];
    let hasAdminGroups = false;

    // Offer connected groups where user is administrator or added the bot
    for (const g of allGroups) {
      let isAllowed = false;
      if (g.addedBy && Number(g.addedBy) === Number(userId)) {
        isAllowed = true;
      } else {
        isAllowed = await isChatAdmin(api, g.groupId, userId, null, false);
      }
      if (isAllowed) {
        hasAdminGroups = true;
        inline_keyboard.push([
          {
            text: `👥 ${g.title}`,
            callback_data: `${ACTIONS.CONFIRM_GROUP_QUIZ_PREFIX}${quiz.id}:${g.groupId}`,
          },
        ]);
      }
    }

    const adminPerms = 'post_messages+delete_messages+restrict_members+pin_messages+manage_topics';

    // Always offer Add to Group link with startgroup and pre-checked admin permissions
    inline_keyboard.push([
      {
        text: `➕ ${getMessage('BTN_ADD_TO_GROUP', lang)}`,
        url: `https://t.me/${botUsername}?startgroup=quiz_${quiz.id}&admin=${adminPerms}`,
      },
    ]);

    // Back button to return to quiz card
    inline_keyboard.push([
      {
        text: getMessage('BTN_BACK', lang),
        callback_data: `${ACTIONS.VIEW_QUIZ_PREFIX}${quiz.id}`,
      },
    ]);

    const promptText = hasAdminGroups
      ? getMessage('SELECT_GROUP_PROMPT', lang)
      : getMessage('GROUP_NONE_ADMIN_FOUND', lang);

    if (messageId) {
      try {
        await api.editMessageText({
          chat_id: chatId,
          message_id: messageId,
          text: promptText,
          parse_mode: 'HTML',
          reply_markup: { inline_keyboard },
        });
        return;
      } catch {}
    }

    await api.sendMessage({
      chat_id: chatId,
      text: promptText,
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard },
    });
    return;
  }

  // 4c. Confirm Group Quiz launch in selected group
  if (data.startsWith(ACTIONS.CONFIRM_GROUP_QUIZ_PREFIX)) {
    const raw = data.replace(ACTIONS.CONFIRM_GROUP_QUIZ_PREFIX, '');
    const [quizIdStr, targetGroupIdStr] = raw.split(':');
    const quizId = parseInt(quizIdStr, 10);
    const targetGroupId = parseInt(targetGroupIdStr, 10);

    const res = await announceGroupLobby(api, {
      chatId: targetGroupId,
      userId,
      quizId,
    });

    if (res.success) {
      await answer(getMessage('GROUP_LOBBY_PREPARED', lang), false);
      await api.sendMessage({
        chat_id: chatId,
        text: getMessage('GROUP_LOBBY_ANNOUNCED', lang),
        parse_mode: 'HTML',
      });
    } else {
      await answer(`⚠️ ${res.error || getMessage('ERR_UNKNOWN', lang)}`, true);
    }
    return;
  }

  // 4d. Lobby: Participant clicks "I am ready"
  if (data.startsWith(ACTIONS.LOBBY_JOIN_PREFIX)) {
    const lobbyId = parseInt(data.replace(ACTIONS.LOBBY_JOIN_PREFIX, ''), 10);
    const res = await handleLobbyJoin(api, lobbyId, fromUser);

    if (res.alreadyReady) {
      await answer(getMessage('LOBBY_ALREADY_READY', lang), true);
    } else if (res.success) {
      await answer(getMessage('LOBBY_JOINED', lang), false);
    } else {
      await answer(getMessage('ERR_NOT_FOUND', lang), true);
    }
    return;
  }

  // 4e. Lobby: Admin or Creator clicks "Start"
  if (data.startsWith(ACTIONS.LOBBY_START_PREFIX)) {
    const lobbyId = parseInt(data.replace(ACTIONS.LOBBY_START_PREFIX, ''), 10);
    const res = await handleLobbyStart(api, lobbyId, userId);

    if (!res.success) {
      if (res.error === 'NOT_ADMIN') {
        await answer(getMessage('LOBBY_ONLY_ADMIN_START', lang), true);
      } else if (res.error === 'NO_PLAYERS') {
        await answer(getMessage('LOBBY_NO_PLAYERS', lang), true);
      } else if (res.error === 'LOBBY_NOT_ACTIVE') {
        await answer(getMessage('ERR_NOT_FOUND', lang), true);
      } else {
        await answer(`⚠️ ${res.error || getMessage('ERR_UNKNOWN', lang)}`, true);
      }
    } else {
      await answer();
    }
    return;
  }

  // 4f. Lobby: Admin or Creator clicks "Cancel"
  if (data.startsWith(ACTIONS.LOBBY_CANCEL_PREFIX)) {
    const lobbyId = parseInt(data.replace(ACTIONS.LOBBY_CANCEL_PREFIX, ''), 10);
    const res = await handleLobbyCancel(api, lobbyId, userId);

    if (!res.success && res.error === 'NOT_ADMIN') {
      await answer(getMessage('LOBBY_ONLY_ADMIN_CANCEL', lang), true);
    } else {
      await answer();
    }
    return;
  }

  // 4g. Group Quiz: Force Next Question Button
  if (data.startsWith(ACTIONS.NEXT_QUESTION_PREFIX)) {
    const raw = data.replace(ACTIONS.NEXT_QUESTION_PREFIX, '');
    const [sIdStr, qIndexStr] = raw.split(':');
    const sessionId = parseInt(sIdStr, 10);
    const fromIndex = qIndexStr !== undefined && qIndexStr !== '' ? parseInt(qIndexStr, 10) : null;

    const session = await db
      .select()
      .from(quizSessions)
      .where(and(eq(quizSessions.id, sessionId), eq(quizSessions.isActive, true)))
      .get();

    if (!session) {
      await answer(getMessage('ERR_NOT_FOUND', lang), true);
      return;
    }

    if (session.isGroup) {
      const isAdmin = await isChatAdmin(api, session.chatId, userId);
      const isCreator = session.userId === userId;
      if (!isAdmin && !isCreator) {
        await answer(getMessage('ONLY_ADMINS_COMMAND', lang), true);
        return;
      }
    }

    await answer();

    await advanceGroupRound(api, session.id, 30, fromIndex);
    return;
  }

  // 5. Solo Mode: Full Test
  if (data.startsWith('mode_full:')) {
    const quizId = parseInt(data.replace('mode_full:', ''), 10);
    await answer(getMessage('QUIZ_STARTING', lang));

    if (messageId) {
      try {
        await api.deleteMessage({ chat_id: chatId, message_id: messageId });
      } catch {}
    }

    await startQuizSession(api, {
      chatId,
      userId,
      quizId,
      isGroup: false,
      mode: ACTIONS.MODE_FULL,
    });
    return;
  }

  // 6. Solo Mode: Range Test
  if (data.startsWith('mode_range:')) {
    const quizId = parseInt(data.replace('mode_range:', ''), 10);
    const quiz = await getQuizById(quizId);
    if (!quiz) {
      await answer(getMessage('ERR_NOT_FOUND', lang), true);
      return;
    }

    await answer();
    await setUserState(userId, STATES.WAITING_FOR_RANGE, { quizId });

    if (messageId) {
      try {
        await api.deleteMessage({ chat_id: chatId, message_id: messageId });
      } catch {}
    }

    await api.sendMessage({
      chat_id: chatId,
      text: getMessage('PROMPT_ENTER_RANGE', lang, { total: quiz.questions.length }),
      parse_mode: 'HTML',
      reply_markup: getCancelKeyboard(lang),
    });
    return;
  }

  // 7. Solo Mode: Random Sample Test
  if (data.startsWith('mode_random:')) {
    const quizId = parseInt(data.replace('mode_random:', ''), 10);
    const quiz = await getQuizById(quizId);
    if (!quiz) {
      await answer(getMessage('ERR_NOT_FOUND', lang), true);
      return;
    }

    await answer();
    await setUserState(userId, STATES.WAITING_FOR_RANDOM_COUNT, { quizId });

    if (messageId) {
      try {
        await api.deleteMessage({ chat_id: chatId, message_id: messageId });
      } catch {}
    }

    await api.sendMessage({
      chat_id: chatId,
      text: getMessage('PROMPT_ENTER_RANDOM_COUNT', lang, { total: quiz.questions.length }),
      parse_mode: 'HTML',
      reply_markup: getCancelKeyboard(lang),
    });
    return;
  }

  // 7b. Solo Mode: Resume Quiz from skipped question
  if (data.startsWith(ACTIONS.RESUME_QUIZ_PREFIX)) {
    const sessionId = parseInt(data.replace(ACTIONS.RESUME_QUIZ_PREFIX, ''), 10);
    try {
      await answer(getMessage('QUIZ_STARTING', lang));
      if (messageId) {
        try {
          await api.deleteMessage({ chat_id: chatId, message_id: messageId });
        } catch {}
      }
      await resumeQuizSession(api, sessionId, userId);
    } catch (err) {
      console.error('Error resuming quiz session:', err);
      await answer(getMessage('ERR_NOT_FOUND', lang), true);
    }
    return;
  }

  // 8. Solo Mode: Mistakes Test
  if (data.startsWith(ACTIONS.REVIEW_MISTAKES_PREFIX)) {
    const quizId = parseInt(data.replace(ACTIONS.REVIEW_MISTAKES_PREFIX, ''), 10) || 0;
    const mistakesCount = await getUserMistakesCount(userId, quizId);
    if (mistakesCount === 0) {
      await answer(getMessage('ERR_MISTAKES_EMPTY_SUBJECT', lang) || getMessage('MISTAKES_EMPTY', lang), true);
      return;
    }

    await answer(getMessage('QUIZ_STARTING', lang));
    if (messageId) {
      try {
        await api.deleteMessage({ chat_id: chatId, message_id: messageId });
      } catch {}
    }

    const sessionRes = await startQuizSession(api, {
      chatId,
      userId,
      quizId,
      isGroup: false,
      mode: ACTIONS.MODE_MISTAKES,
      lang,
    });
    if (sessionRes && !sessionRes.success && sessionRes.error) {
      await api.sendMessage({
        chat_id: chatId,
        text: sessionRes.error,
      });
    }
    return;
  }

  // Clear Mistakes
  if (data.startsWith(ACTIONS.CLEAR_MISTAKES_PREFIX) || data === 'clear_mistakes') {
    await clearUserMistakes(userId);
    await answer(getMessage('MISTAKES_CLEARED', lang), true);
    if (messageId) {
      try {
        await api.deleteMessage({ chat_id: chatId, message_id: messageId });
      } catch {}
    }
    return;
  }



  // 10. View Quiz Card
  if (data.startsWith(ACTIONS.VIEW_QUIZ_PREFIX)) {
    const raw = data.replace(ACTIONS.VIEW_QUIZ_PREFIX, '');
    const parts = raw.split(':');
    const quizId = parseInt(parts[0], 10);
    const originParam = parts[1] || null;
    const pageParam = parts[2] ? parseInt(parts[2], 10) : 0;

    const quiz = await getQuizById(quizId);
    if (!quiz) {
      await answer(getMessage('ERR_NOT_FOUND', lang), true);
      return;
    }

    await answer();
    await clearUserState(userId);
    const isOwner = quiz.ownerId === userId;

    let backCallbackData = null;
    if (originParam === 'my') {
      backCallbackData = `${ACTIONS.MY_QUIZZES_PAGE_PREFIX}${pageParam}`;
    } else if (originParam && !isNaN(parseInt(originParam, 10))) {
      backCallbackData = `kiut_c:${originParam}`;
    } else if (isOwner) {
      backCallbackData = `${ACTIONS.MY_QUIZZES_PAGE_PREFIX}0`;
    } else if (quiz.category) {
      const catRec = await db
        .select()
        .from(categoriesTable)
        .where(eq(categoriesTable.path, quiz.category))
        .get();
      if (catRec) {
        backCallbackData = `kiut_c:${catRec.id}`;
      } else {
        backCallbackData = 'kiut_c:0';
      }
    }

    const mistakesCount = await getUserMistakesCount(userId, quiz.id);

    try {
      await api.editMessageText({
        chat_id: chatId,
        message_id: messageId,
        text: getMessage('QUIZ_INFO_TITLE', lang, {
          id: quiz.id,
          title: quiz.title,
          count: quiz.questions.length,
          time: `${quiz.timeLimit}s`,
          shuffle: quiz.shuffleOptions ? getMessage('LABEL_YES', lang) : getMessage('LABEL_NO', lang),
        }),
        parse_mode: 'HTML',
        reply_markup: getQuizCardKeyboard(quiz, lang, isOwner, mistakesCount > 0, backCallbackData),
      });
    } catch {
      await api.sendMessage({
        chat_id: chatId,
        text: getMessage('QUIZ_INFO_TITLE', lang, {
          id: quiz.id,
          title: quiz.title,
          count: quiz.questions.length,
          time: `${quiz.timeLimit}s`,
          shuffle: quiz.shuffleOptions ? getMessage('LABEL_YES', lang) : getMessage('LABEL_NO', lang),
        }),
        parse_mode: 'HTML',
        reply_markup: getQuizCardKeyboard(quiz, lang, isOwner, mistakesCount > 0, backCallbackData),
      });
    }
    return;
  }

  // 11. Pagination for My Quizzes
  if (data.startsWith(ACTIONS.MY_QUIZZES_PAGE_PREFIX)) {
    const page = parseInt(data.replace(ACTIONS.MY_QUIZZES_PAGE_PREFIX, ''), 10) || 0;
    const quizzesList = await getUserQuizzes(userId, page);
    const count = await getUserQuizzesCount(userId);

    await answer();
    if (count === 0) {
      try {
        await api.editMessageText({
          chat_id: chatId,
          message_id: messageId,
          text: getMessage('ERR_NO_QUIZZES', lang),
        });
      } catch {
        await api.sendMessage({
          chat_id: chatId,
          text: getMessage('ERR_NO_QUIZZES', lang),
        });
      }
      return;
    }

    try {
      await api.editMessageText({
        chat_id: chatId,
        message_id: messageId,
        text: getMessage('MY_QUIZZES_TITLE', lang, { count }),
        parse_mode: 'HTML',
        reply_markup: getMyQuizzesPageKeyboard(quizzesList, page, count, lang),
      });
    } catch {
      await api.sendMessage({
        chat_id: chatId,
        text: getMessage('MY_QUIZZES_TITLE', lang, { count }),
        parse_mode: 'HTML',
        reply_markup: getMyQuizzesPageKeyboard(quizzesList, page, count, lang),
      });
    }
    return;
  }

  // 11b. Pagination for My Mistakes
  if (data.startsWith(ACTIONS.MISTAKES_PAGE_PREFIX)) {
    const page = parseInt(data.replace(ACTIONS.MISTAKES_PAGE_PREFIX, ''), 10) || 0;
    const grouped = await getUserMistakesGrouped(userId);

    await answer();
    if (grouped.length === 0) {
      await api.editMessageText({
        chat_id: chatId,
        message_id: messageId,
        text: getMessage('MISTAKES_EMPTY', lang),
      });
      return;
    }

    await api.editMessageReplyMarkup({
      chat_id: chatId,
      message_id: messageId,
      reply_markup: getMistakesPageKeyboard(grouped, page, lang),
    });
    return;
  }

  // 12. Change Time Limit
  if (data.startsWith(ACTIONS.CHANGE_TIME_PREFIX)) {
    const quizId = parseInt(data.replace(ACTIONS.CHANGE_TIME_PREFIX, ''), 10);
    await answer();
    await api.editMessageText({
      chat_id: chatId,
      message_id: messageId,
      text: getMessage('PROMPT_CHANGE_TIME', lang),
      reply_markup: getTimeLimitKeyboard(quizId, lang),
    });
    return;
  }

  // 13. Set Time Limit
  if (data.startsWith(ACTIONS.SET_TIME_PREFIX)) {
    const parts = data.replace(ACTIONS.SET_TIME_PREFIX, '').split(':');
    const quizId = parseInt(parts[0], 10);
    const seconds = parseInt(parts[1], 10);

    await updateQuizSettings(quizId, { timeLimit: seconds });
    await answer(getMessage('ALERT_TIME_CHANGED', lang, { time: seconds }));

    const quiz = await getQuizById(quizId);
    if (quiz) {
      const isOwner = quiz.ownerId === userId;
      await api.editMessageText({
        chat_id: chatId,
        message_id: messageId,
        text: getMessage('QUIZ_INFO_TITLE', lang, {
          id: quiz.id,
          title: quiz.title,
          count: quiz.questions.length,
          time: `${quiz.timeLimit}s`,
          shuffle: quiz.shuffleOptions ? getMessage('LABEL_YES', lang) : getMessage('LABEL_NO', lang),
        }),
        parse_mode: 'HTML',
        reply_markup: getQuizCardKeyboard(quiz, lang, isOwner, false),
      });
    }
    return;
  }

  // 14. Delete Quiz Confirmation
  if (data.startsWith(ACTIONS.DELETE_QUIZ_PREFIX)) {
    const quizId = parseInt(data.replace(ACTIONS.DELETE_QUIZ_PREFIX, ''), 10);
    await answer();
    await api.editMessageText({
      chat_id: chatId,
      message_id: messageId,
      text: getMessage('PROMPT_CONFIRM_DELETE', lang),
      reply_markup: getConfirmDeleteKeyboard(quizId, lang),
    });
    return;
  }

  // 15. Confirm Delete Quiz
  if (data.startsWith(ACTIONS.CONFIRM_DELETE_PREFIX)) {
    const quizId = parseInt(data.replace(ACTIONS.CONFIRM_DELETE_PREFIX, ''), 10);
    const deleted = await deleteQuiz(quizId, userId);

    if (deleted) {
      await answer(getMessage('QUIZ_DELETED_SUCCESS', lang));
      await api.editMessageText({
        chat_id: chatId,
        message_id: messageId,
        text: getMessage('QUIZ_DELETED_SUCCESS', lang),
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: getMessage('BTN_MY_QUIZZES', lang),
                callback_data: `${ACTIONS.MY_QUIZZES_PAGE_PREFIX}0`,
              },
            ],
          ],
        },
      });
    } else {
      await answer(getMessage('ERR_DELETE_FAILED', lang), true);
    }
    return;
  }

  // 16. Clone Quiz
  if (data.startsWith(ACTIONS.CLONE_QUIZ_PREFIX)) {
    const quizId = parseInt(data.replace(ACTIONS.CLONE_QUIZ_PREFIX, ''), 10);
    const cloned = await cloneQuiz(quizId, userId, lang);

    if (cloned) {
      await answer(getMessage('ALERT_QUIZ_CLONED', lang));
      await api.editMessageText({
        chat_id: chatId,
        message_id: messageId,
        text: getMessage('QUIZ_INFO_TITLE', lang, {
          id: cloned.id,
          title: cloned.title,
          count: cloned.questions?.length || 0,
          time: `${cloned.timeLimit}s`,
          shuffle: cloned.shuffleOptions ? getMessage('LABEL_YES', lang) : getMessage('LABEL_NO', lang),
        }),
        parse_mode: 'HTML',
        reply_markup: getQuizCardKeyboard(cloned, lang, true, false),
      });
    } else {
      await answer(getMessage('ERR_CLONE_FAILED', lang), true);
    }
    return;
  }

  // 17. Admin Panel Actions
  if (isAdmin) {
    if (data === ACTIONS.ADMIN_MENU) {
      await answer();
      await clearUserState(userId);
      await safeEditMessageText({
        chat_id: chatId,
        message_id: messageId,
        text: getMessage('ADMIN_WELCOME', lang),
        parse_mode: 'HTML',
        reply_markup: getAdminDashboardKeyboard(lang),
      });
      return;
    }

    if (data === ACTIONS.ADMIN_STATS) {
      await answer();
      const stats = await getBotStatistics();
      await safeEditMessageText({
        chat_id: chatId,
        message_id: messageId,
        text: getMessage('ADMIN_STATS_TITLE', lang, {
          users: stats.totalUsers,
          todayUsers: stats.todayUsers,
          groups: stats.activeGroups,
          quizzes: stats.totalQuizzes,
          sessions: stats.totalSessions,
          activeTotal: stats.activeTotalSessions,
          activeGroup: stats.activeGroupSessions,
          activePrivate: stats.activePrivateSessions,
        }),
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: getMessage('BTN_ADMIN_MENU', lang), callback_data: ACTIONS.ADMIN_MENU }],
          ],
        },
      });
      return;
    }

    if (data === ACTIONS.ADMIN_BROADCAST) {
      await answer();
      await setUserState(userId, STATES.ADMIN_BROADCAST_TEXT);
      const promptText = getMessage('PROMPT_BROADCAST_INPUT', lang);
      const promptMarkup = {
        inline_keyboard: [
          [{ text: getMessage('BTN_CANCEL', lang), callback_data: ACTIONS.ADMIN_MENU }],
        ],
      };

      try {
        await api.editMessageText({
          chat_id: chatId,
          message_id: messageId,
          text: promptText,
          parse_mode: 'HTML',
          reply_markup: promptMarkup,
        });
      } catch {
        await api.sendMessage({
          chat_id: chatId,
          text: promptText,
          parse_mode: 'HTML',
          reply_markup: promptMarkup,
        });
      }
      return;
    }

    if (data === ACTIONS.ADMIN_BROADCAST_CONFIRM) {
      const stateObj = await getUserState(userId);
      const bcastData = stateObj?.data;
      await clearUserState(userId);

      if (!bcastData || (!bcastData.messageId && !bcastData.broadcastText)) {
        await answer(getMessage('ERR_MESSAGE_EXPIRED', lang), true);
        return;
      }

      await answer(getMessage('BROADCAST_STARTING', lang));
      await api.editMessageText({
        chat_id: chatId,
        message_id: messageId,
        text: getMessage('BROADCAST_STARTING', lang),
      });

      const payload = bcastData.messageId
        ? { fromChatId: bcastData.fromChatId || chatId, messageId: bcastData.messageId }
        : bcastData.broadcastText;

      const result = await broadcastMessage(api, payload);
      await api.sendMessage({
        chat_id: chatId,
        text: getMessage('BROADCAST_FINISHED', lang, {
          success: result.success,
          fail: result.fail,
        }),
        parse_mode: 'HTML',
        reply_markup: getMainKeyboard(lang, isAdmin),
      });
      return;
    }

    if (data === ACTIONS.ADMIN_CHANNELS) {
      const channels = await getRequiredChannels();
      await answer();
      await api.editMessageText({
        chat_id: chatId,
        message_id: messageId,
        text: getMessage('ADMIN_CHANNELS_LIST_TITLE', lang),
        parse_mode: 'HTML',
        reply_markup: getAdminChannelsKeyboard(channels, lang),
      });
      return;
    }

    if (data === ACTIONS.ADMIN_MEDIA_CHANNEL) {
      const mediaCh = await getMediaChannel();
      const statusText = mediaCh
        ? getMessage('STATUS_CONNECTED', lang, { title: mediaCh.title || 'Kanal', id: mediaCh.channelId })
        : getMessage('STATUS_NOT_CONNECTED', lang);
      await answer();
      await api.editMessageText({
        chat_id: chatId,
        message_id: messageId,
        text: getMessage('ADMIN_MEDIA_CHANNEL_TITLE', lang, { status: statusText }),
        parse_mode: 'HTML',
        reply_markup: getAdminMediaChannelKeyboard(!!mediaCh, lang),
      });
      return;
    }

    if (data === ACTIONS.ADMIN_SET_MEDIA_CHANNEL) {
      await answer();
      await setUserState(userId, STATES.WAITING_FOR_MEDIA_CHANNEL);
      if (messageId) {
        try {
          await api.deleteMessage({ chat_id: chatId, message_id: messageId });
        } catch {}
      }
      await api.sendMessage({
        chat_id: chatId,
        text: getMessage('PROMPT_MEDIA_CHANNEL', lang),
        parse_mode: 'HTML',
        reply_markup: getCancelKeyboard(lang),
      });
      return;
    }

    if (data === ACTIONS.ADMIN_DEL_MEDIA_CHANNEL) {
      await removeMediaChannel();
      await answer(getMessage('MEDIA_CHANNEL_REMOVED', lang));
      const statusText = getMessage('STATUS_NOT_CONNECTED', lang);
      await api.editMessageText({
        chat_id: chatId,
        message_id: messageId,
        text: getMessage('ADMIN_MEDIA_CHANNEL_TITLE', lang, { status: statusText }),
        parse_mode: 'HTML',
        reply_markup: getAdminMediaChannelKeyboard(false, lang),
      });
      return;
    }

    if (data === ACTIONS.ADMIN_ADD_CHANNEL) {
      await answer();
      await setUserState(userId, STATES.ADMIN_ADD_CHANNEL);
      if (messageId) {
        try {
          await api.deleteMessage({ chat_id: chatId, message_id: messageId });
        } catch {}
      }
      await api.sendMessage({
        chat_id: chatId,
        text: getMessage('PROMPT_ADD_CHANNEL', lang),
        parse_mode: 'HTML',
        reply_markup: getCancelKeyboard(lang),
      });
      return;
    }

    if (data.startsWith(ACTIONS.ADMIN_DEL_CHANNEL_PREFIX)) {
      const channelId = parseInt(data.replace(ACTIONS.ADMIN_DEL_CHANNEL_PREFIX, ''), 10);
      await deleteRequiredChannel(channelId);
      await answer(getMessage('CHANNEL_DELETED', lang));

      const channels = await getRequiredChannels();
      await api.editMessageText({
        chat_id: chatId,
        message_id: messageId,
        text: getMessage('ADMIN_CHANNELS_LIST_TITLE', lang),
        parse_mode: 'HTML',
        reply_markup: getAdminChannelsKeyboard(channels, lang),
      });
      return;
    }

    if (data === ACTIONS.ADMIN_USERS || data.startsWith(ACTIONS.USERS_PAGE_PREFIX)) {
      await answer();
      const page = data.startsWith(ACTIONS.USERS_PAGE_PREFIX)
        ? Math.max(0, parseInt(data.replace(ACTIONS.USERS_PAGE_PREFIX, ''), 10) || 0)
        : 0;
      const pageSize = CONFIG.PAGINATION.USERS || 10;
      const [usersList, totalUsers] = await Promise.all([
        listUsers(page, pageSize),
        getUsersCount(),
      ]);
      const totalPages = Math.ceil(totalUsers / pageSize) || 1;
      const offset = page * pageSize;

      let text = getMessage('ADMIN_USERS_PAGE_TITLE', lang, { total: totalUsers });
      if (usersList.length === 0) {
        text += 'ℹ️ —';
      } else {
        for (let i = 0; i < usersList.length; i++) {
          const u = usersList[i];
          const num = offset + i + 1;
          const rawName = [u.firstName, u.lastName].filter(Boolean).join(' ') || (u.username ? `@${u.username}` : String(u.telegramId));
          const displayName = escapeHtml(truncateText(rawName, 25));
          const link = u.username ? `https://t.me/${u.username}` : `tg://user?id=${u.telegramId}`;
          const usernameTag = u.username ? ` (@${escapeHtml(u.username)})` : '';
          const timeFormatted = formatDateTimeUz(u.createdAt);
          const timeTag = timeFormatted ? `\n   🗓 <code>${timeFormatted}</code>` : '';
          text += `${num}. <a href="${link}">${displayName}</a> (<code>${u.telegramId}</code>)${usernameTag}${timeTag}\n`;
        }
      }

      text += `\n${getMessage('PAGE_COUNTER', lang, { page: page + 1, total: totalPages })}`;

      await safeEditMessageText({
        chat_id: chatId,
        message_id: messageId,
        text,
        parse_mode: 'HTML',
        link_preview_options: { is_disabled: true },
        reply_markup: getAdminPaginationKeyboard(ACTIONS.USERS_PAGE_PREFIX, page, totalPages, lang),
      });
      return;
    }

    if (data === ACTIONS.ADMIN_GROUPS || data.startsWith(ACTIONS.GROUPS_PAGE_PREFIX)) {
      await answer();
      const page = data.startsWith(ACTIONS.GROUPS_PAGE_PREFIX)
        ? Math.max(0, parseInt(data.replace(ACTIONS.GROUPS_PAGE_PREFIX, ''), 10) || 0)
        : 0;
      const pageSize = CONFIG.PAGINATION.GROUPS || 10;
      const [groupsList, totalGroups] = await Promise.all([
        listGroups(page, pageSize),
        getGroupsCount(),
      ]);
      const totalPages = Math.ceil(totalGroups / pageSize) || 1;
      const offset = page * pageSize;

      let text = getMessage('ADMIN_GROUPS_PAGE_TITLE', lang, { total: totalGroups });
      if (groupsList.length === 0) {
        text += 'ℹ️ —';
      } else {
        for (let i = 0; i < groupsList.length; i++) {
          const g = groupsList[i];
          const num = offset + i + 1;
          const rawTitle = g.title || `Group ${g.groupId}`;
          const displayTitle = escapeHtml(truncateText(rawTitle, 25));
          const groupLink = g.username ? `https://t.me/${g.username}` : null;
          const usernameTag = g.username ? ` (@${escapeHtml(g.username)})` : '';
          if (groupLink) {
            text += `${num}. <a href="${groupLink}">${displayTitle}</a> (<code>${g.groupId}</code>)${usernameTag}\n`;
          } else {
            text += `${num}. <b>${displayTitle}</b> (<code>${g.groupId}</code>)\n`;
          }
        }
      }

      text += `\n${getMessage('PAGE_COUNTER', lang, { page: page + 1, total: totalPages })}`;

      await safeEditMessageText({
        chat_id: chatId,
        message_id: messageId,
        text,
        parse_mode: 'HTML',
        link_preview_options: { is_disabled: true },
        reply_markup: getAdminPaginationKeyboard(ACTIONS.GROUPS_PAGE_PREFIX, page, totalPages, lang),
      });
      return;
    }
  }

  await answer();
}
