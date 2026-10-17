// tgcloud/handlers/message.js
// Handles all incoming Telegram messages (Private & Group)

import { api, db } from 'sdk';
import { eq, and } from 'sdk/db';
import { quizSessions, groupAnswers } from '../schema.js';
import { CONFIG } from '../lib/constants/config.js';
import { ACTIONS, STATES } from '../lib/constants/actions.js';
import { getMessage, isButtonMatch } from '../lib/constants/messages.js';

import {
  getOrCreateUser,
  getUser,
  setUserLanguage,
  getUserState,
  setUserState,
  clearUserState,
  isUserBlocked,
} from '../lib/services/user_service.js';

import {
  checkUserSubscribed,
  addRequiredChannel,
} from '../lib/services/channel_service.js';

import {
  createQuiz,
  getQuizById,
  getUserQuizzes,
  getUserQuizzesCount,
} from '../lib/services/quiz_service.js';

import {
  startQuizSession,
  stopSession,
  getUserMistakesCount,
  getUserMistakesGrouped,
  advanceGroupRound,
  announceGroupLobby,
  isChatAdmin,
} from '../lib/services/session_service.js';

import { upsertGroup, deactivateGroup } from '../lib/services/group_service.js';
import { isUserAdmin, getBotStatistics, setMediaChannel } from '../lib/services/admin_service.js';

import { getMainKeyboard, getCancelKeyboard, getLanguageReplyKeyboard } from '../lib/keyboards/main_keyboard.js';
import { getInlineModeKeyboard } from '../lib/keyboards/mode_keyboard.js';
import { getQuizCardKeyboard, getMyQuizzesPageKeyboard, getMistakesPageKeyboard } from '../lib/keyboards/quiz_keyboard.js';

import { getAdminDashboardKeyboard, getAdminConfirmBroadcastKeyboard } from '../lib/keyboards/admin_keyboard.js';
import { getSubscribeKeyboard, getLanguageKeyboard } from '../lib/keyboards/subscribe_keyboard.js';
import { parseQuizInput } from '../lib/parsers/parser_engine.js';
import { formatParticipantName } from '../lib/utils/poll_helpers.js';

export default async function (message, ctx) {
  if (!message || !message.chat) return;

  const chatId = message.chat.id;
  const isPrivate = message.chat.type === 'private';
  const isGroup = ['group', 'supergroup'].includes(message.chat.type);
  const fromUser = message.from;

  // 1. Group / Supergroup handling
  if (isGroup) {
    if (message.migrate_to_chat_id) {
      await deactivateGroup(chatId);
      await upsertGroup(message.migrate_to_chat_id, message.chat.title || 'Guruh', message.chat.username || null);
      return;
    }
    if (message.migrate_from_chat_id) {
      await deactivateGroup(message.migrate_from_chat_id);
    }

    if (chatId) {
      await upsertGroup(chatId, message.chat.title || 'Guruh', message.chat.username || null);
    }

    const text = message.text?.trim() || '';
    const botUser = CONFIG.BOT.USERNAME.toLowerCase();

    // Parse Telegram command in group
    const parseGroupCmd = (msgText, targetBotName) => {
      if (!msgText || !msgText.startsWith('/')) return null;
      const match = msgText.trim().match(/^\/([a-zA-Z0-9_]+)(?:@([a-zA-Z0-9_]+))?(?:\s+([\s\S]*))?$/);
      if (!match) return null;
      const [, command, targetBot, rest] = match;
      if (targetBot && targetBot.toLowerCase() !== targetBotName.toLowerCase()) {
        return null;
      }
      return {
        command: command.toLowerCase(),
        argsStr: rest ? rest.trim() : '',
      };
    };

    const cmd = parseGroupCmd(text, botUser);
    if (!cmd) return;

    // Helper: verify admin permission in group
    const verifyAdmin = async () => {
      const isAdmin = await isChatAdmin(api, chatId, fromUser?.id, message.sender_chat?.id);
      if (!isAdmin) {
        await api.sendMessage({
          chat_id: chatId,
          text: getMessage('ONLY_ADMINS_COMMAND', 'UZ'),
        });
        return false;
      }
      return true;
    };

    // 1. /start
    if (cmd.command === 'start') {
      if (cmd.argsStr.startsWith('quiz_')) {
        const quizId = parseInt(cmd.argsStr.replace('quiz_', '').split(/\s+/)[0], 10);
        if (quizId) {
          if (!(await verifyAdmin())) return;
          await announceGroupLobby(api, { chatId, userId: fromUser.id, quizId });
        }
      } else {
        // Silent clean up for bare /start in groups
        try {
          await api.deleteMessage({ chat_id: chatId, message_id: message.message_id });
        } catch {}
      }
      return;
    }

    // 2. /quiz <id> or bare /quiz
    if (cmd.command === 'quiz') {
      if (!(await verifyAdmin())) return;

      const quizId = parseInt(cmd.argsStr.split(/\s+/)[0], 10);
      if (quizId) {
        const res = await announceGroupLobby(api, {
          chatId,
          userId: fromUser.id,
          quizId,
        });

        if (!res.success) {
          await api.sendMessage({
            chat_id: chatId,
            text: `⚠️ ${res.error}`,
          });
        }
      } else {
        await api.sendMessage({
          chat_id: chatId,
          text: getMessage('GROUP_QUIZ_USAGE_HINT', 'UZ'),
          parse_mode: 'HTML',
        });
      }
      return;
    }

    // /next or /skip (Force advance to next question)
    if (cmd.command === 'next' || cmd.command === 'skip') {
      if (!(await verifyAdmin())) return;

      const session = await db
        .select()
        .from(quizSessions)
        .where(and(eq(quizSessions.chatId, chatId), eq(quizSessions.isActive, true)))
        .get();

      if (!session) {
        await api.sendMessage({
          chat_id: chatId,
          text: getMessage('GROUP_NO_ACTIVE_QUIZ', 'UZ'),
        });
        return;
      }

      if (session.lastPollMessageId) {
        try {
          await api.stopPoll({
            chat_id: session.chatId,
            message_id: session.lastPollMessageId,
          });
        } catch {}
      }

      await advanceGroupRound(api, session.id);
      return;
    }

    // 3. /stop_quiz
    if (cmd.command === 'stop_quiz') {
      if (!(await verifyAdmin())) return;

      const stopped = await stopSession(api, chatId);
      if (!stopped) {
        await api.sendMessage({
          chat_id: chatId,
          text: getMessage('GROUP_NO_ACTIVE_QUIZ', 'UZ'),
        });
      }
      return;
    }

    // 4. /quiz_stats
    if (cmd.command === 'quiz_stats') {
      if (!(await verifyAdmin())) return;

      const session = await db
        .select()
        .from(quizSessions)
        .where(and(eq(quizSessions.chatId, chatId), eq(quizSessions.isActive, true)))
        .get();

      if (!session) {
        await api.sendMessage({
          chat_id: chatId,
          text: getMessage('GROUP_NO_ACTIVE_QUIZ', 'UZ'),
        });
        return;
      }

      const answers = await db
        .select()
        .from(groupAnswers)
        .where(eq(groupAnswers.sessionId, session.id))
        .all();

      const userStats = {};
      for (const a of answers) {
        if (!userStats[a.userId]) {
          userStats[a.userId] = { userId: a.userId, name: a.userName, correct: 0, answered: 0, totalTime: 0 };
        }
        userStats[a.userId].answered += 1;
        userStats[a.userId].totalTime += (a.timeTaken || 0);
        if (a.isCorrect) userStats[a.userId].correct += 1;
      }

      const sorted = Object.values(userStats).sort((a, b) => b.correct - a.correct || a.totalTime - b.totalTime);
      let statsText = getMessage('GROUP_CURRENT_RESULTS', 'UZ') + '\n\n';
      if (sorted.length === 0) {
        statsText += getMessage('GROUP_NO_ANSWERS', 'UZ');
      } else {
        const top10 = sorted.slice(0, 10);
        const medals = { 0: '🥇', 1: '🥈', 2: '🥉' };
        for (let i = 0; i < top10.length; i++) {
          const u = top10[i];
          const rank = medals[i] ? `${medals[i]} ${i + 1}.` : `${i + 1}.`;
          const displayName = formatParticipantName(u.name, u.userId);
          statsText += `${rank} ${displayName} – <b>${u.correct}</b>/${u.answered} (${u.totalTime}s)\n`;
        }
      }
      await api.sendMessage({
        chat_id: chatId,
        text: statsText,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
        link_preview_options: { is_disabled: true },
      });
      return;
    }

    // 5. /quiz_help
    if (cmd.command === 'quiz_help') {
      if (!(await verifyAdmin())) return;

      await api.sendMessage({
        chat_id: chatId,
        text: getMessage('GROUP_HELP_TEXT', 'UZ'),
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: getMessage('BTN_CONTACT_ADMIN', 'UZ'),
                url: `tg://user?id=${CONFIG.ADMINS[0]}`,
              },
            ],
          ],
        },
      });
      return;
    }

    // 6. /create_quiz
    if (cmd.command === 'create_quiz') {
      if (!(await verifyAdmin())) return;

      await api.sendMessage({
        chat_id: chatId,
        text: getMessage('CREATE_QUIZ_REDIRECT', 'UZ', { username: CONFIG.BOT.USERNAME }),
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: getMessage('BTN_CREATE_QUIZ', 'UZ'),
                url: `https://t.me/${CONFIG.BOT.USERNAME}?start=create`,
              },
            ],
          ],
        },
      });
      return;
    }

    return;
  }

  // 2. Private chat handling
  if (!fromUser) return;

  // Upsert user
  const user = await getOrCreateUser(fromUser);
  if (!user || user.isBlocked) return;

  const lang = user.lang || CONFIG.I18N.DEFAULT_LANG;
  const isAdmin = isUserAdmin(fromUser.id);
  const text = message.text?.trim() || '';

  // Forced Subscription Check (Skip for admins)
  if (!isAdmin) {
    const subCheck = await checkUserSubscribed(api, fromUser.id);
    if (!subCheck.isSubscribed) {
      await api.sendMessage({
        chat_id: chatId,
        text: getMessage('FORCE_SUB_PROMPT', lang),
        parse_mode: 'HTML',
        reply_markup: getSubscribeKeyboard(subCheck.missingChannels, lang),
      });
      return;
    }
  }

  // Get current user FSM state
  const { state, data } = await getUserState(fromUser.id);

  // Handle Cancel / Back command / button
  if (
    text === '/cancel' ||
    isButtonMatch(text, 'BTN_CANCEL') ||
    isButtonMatch(text, 'BTN_BACK')
  ) {
    await clearUserState(fromUser.id);
    await api.sendMessage({
      chat_id: chatId,
      text: getMessage('ACTION_CANCELLED', lang),
      reply_markup: getMainKeyboard(lang, isAdmin),
    });
    return;
  }

  // Handle Stop Quiz command / button
  const isStopQuizText =
    isButtonMatch(text, 'BTN_STOP_QUIZ') ||
    text === '/stop' ||
    text === '/stop_quiz' ||
    text.includes("Testni to'xtatish") ||
    text.includes("to'xtatish") ||
    text.includes("Остановить тест") ||
    text.includes("Stop Quiz") ||
    /to['`’]?xtat|останов|stop/i.test(text);

  if (isStopQuizText) {
    await clearUserState(fromUser.id);
    const stopped = await stopSession(api, chatId);
    if (!stopped) {
      await api.sendMessage({
        chat_id: chatId,
        text: getMessage('NO_ACTIVE_QUIZ', lang),
        reply_markup: getMainKeyboard(lang, isAdmin),
      });
    }
    return;
  }

  // Handle Active FSM States
  if (state === STATES.SELECTING_MODE || isButtonMatch(text, 'BTN_MODE_FULL') || isButtonMatch(text, 'BTN_MODE_RANGE') || isButtonMatch(text, 'BTN_MODE_RANDOM')) {
    const quizId = data?.quizId;
    if (isButtonMatch(text, 'BTN_MODE_FULL')) {
      if (quizId) {
        await clearUserState(fromUser.id);
        await startQuizSession(api, {
          chatId,
          userId: fromUser.id,
          quizId,
          isGroup: false,
          mode: ACTIONS.MODE_FULL,
        });
        return;
      }
    } else if (isButtonMatch(text, 'BTN_MODE_RANGE')) {
      if (quizId) {
        const quiz = await getQuizById(quizId);
        await setUserState(fromUser.id, STATES.WAITING_FOR_RANGE, { quizId });
        await api.sendMessage({
          chat_id: chatId,
          text: getMessage('PROMPT_ENTER_RANGE', lang, { total: quiz?.questions?.length || 0 }),
          parse_mode: 'HTML',
          reply_markup: getCancelKeyboard(lang),
        });
        return;
      }
    } else if (isButtonMatch(text, 'BTN_MODE_RANDOM')) {
      if (quizId) {
        const quiz = await getQuizById(quizId);
        await setUserState(fromUser.id, STATES.WAITING_FOR_RANDOM_COUNT, { quizId });
        await api.sendMessage({
          chat_id: chatId,
          text: getMessage('PROMPT_ENTER_RANDOM_COUNT', lang, { total: quiz?.questions?.length || 0 }),
          parse_mode: 'HTML',
          reply_markup: getCancelKeyboard(lang),
        });
        return;
      }
    }
  }

  if (state === STATES.WAITING_FOR_RANGE) {
    const match = text.match(/^(\d+)\s*[-:—\s]\s*(\d+)$/);
    if (!match) {
      await api.sendMessage({
        chat_id: chatId,
        text: getMessage('ERR_INVALID_RANGE', lang),
        reply_markup: getCancelKeyboard(lang),
      });
      return;
    }

    const start = parseInt(match[1], 10);
    const end = parseInt(match[2], 10);
    const quizId = data.quizId;
    const quiz = await getQuizById(quizId);

    if (!quiz || start < 1 || end > quiz.questions.length || start > end) {
      await api.sendMessage({
        chat_id: chatId,
        text: getMessage('ERR_INVALID_RANGE', lang),
        reply_markup: getCancelKeyboard(lang),
      });
      return;
    }

    await clearUserState(fromUser.id);
    await startQuizSession(api, {
      chatId,
      userId: fromUser.id,
      quizId,
      isGroup: false,
      mode: ACTIONS.MODE_RANGE,
      range: [start, end],
    });
    return;
  }

  if (state === STATES.WAITING_FOR_RANDOM_COUNT) {
    const count = parseInt(text, 10);
    const quizId = data.quizId;
    const quiz = await getQuizById(quizId);

    if (!quiz || isNaN(count) || count < 1 || count > quiz.questions.length) {
      await api.sendMessage({
        chat_id: chatId,
        text: getMessage('ERR_INVALID_COUNT', lang, { total: quiz?.questions.length || 0 }),
        reply_markup: getCancelKeyboard(lang),
      });
      return;
    }

    await clearUserState(fromUser.id);
    await startQuizSession(api, {
      chatId,
      userId: fromUser.id,
      quizId,
      isGroup: false,
      mode: ACTIONS.MODE_RANDOM,
      randomCount: count,
    });
    return;
  }

  if (state === STATES.ADMIN_BROADCAST_TEXT && isAdmin) {
    // 1. Prevent accidental broadcasting of bot commands (e.g. /start, /help)
    if (text && text.startsWith('/')) {
      await api.sendMessage({
        chat_id: chatId,
        text: getMessage('ERR_BROADCAST_COMMAND', lang),
        parse_mode: 'HTML',
      });
      return;
    }

    // 2. Prevent accidental broadcasting of bot reply buttons
    const menuBtnKeys = [
      'BTN_UPLOAD_TEST',
      'BTN_MY_QUIZZES',
      'BTN_MY_MISTAKES',
      'BTN_ADD_TO_GROUP',
      'BTN_SHARE_BOT',
      'BTN_LANGUAGE',
      'BTN_HELP',
      'BTN_ADMIN',
      'BTN_STOP_QUIZ',
    ];
    const allMenuButtons = [
      ...menuBtnKeys.flatMap((k) => CONFIG.I18N.SUPPORTED.map((l) => getMessage(k, l))),
      "🇺🇿 O'zbekcha", '🇷🇺 Русский', '🇺🇸 English',
    ];

    if (allMenuButtons.includes(text)) {
      await api.sendMessage({
        chat_id: chatId,
        text: getMessage('ERR_BROADCAST_BUTTON', lang),
        parse_mode: 'HTML',
      });
      return;
    }

    // Store message reference so copyMessage can replicate any message type (photo, video, doc, voice, text, etc.)
    await setUserState(fromUser.id, STATES.ADMIN_BROADCAST_TEXT, {
      fromChatId: chatId,
      messageId: message.message_id,
      broadcastText: text || message.caption || '',
    });

    await api.sendMessage({
      chat_id: chatId,
      text: getMessage('PROMPT_CONFIRM_BROADCAST', lang),
      reply_to_message_id: message.message_id,
      parse_mode: 'HTML',
      reply_markup: getAdminConfirmBroadcastKeyboard(lang),
    });
    return;
  }

  if (state === STATES.ADMIN_ADD_CHANNEL && isAdmin) {
    try {
      const channelUsername = text.startsWith('@') ? text : `@${text}`;
      const chatInfo = await api.getChat({ chat_id: channelUsername });

      await addRequiredChannel({
        channelId: chatInfo.id,
        channelUsername: chatInfo.username,
        title: chatInfo.title,
        inviteLink: chatInfo.invite_link,
      });

      await clearUserState(fromUser.id);
      await api.sendMessage({
        chat_id: chatId,
        text: getMessage('CHANNEL_ADDED', lang),
        reply_markup: getMainKeyboard(lang, isAdmin),
      });
    } catch (err) {
      await api.sendMessage({
        chat_id: chatId,
        text: getMessage('ERR_ADD_CHANNEL', lang, { error: err.message }),
        reply_markup: getCancelKeyboard(lang),
      });
    }
    return;
  }

  if (state === STATES.WAITING_FOR_MEDIA_CHANNEL && isAdmin) {
    try {
      let targetChatId = null;

      if (message.forward_from_chat) {
        targetChatId = message.forward_from_chat.id;
      } else if (text) {
        targetChatId = text.trim();
        if (!targetChatId.startsWith('@') && !targetChatId.startsWith('-')) {
          if (/^-?\d+$/.test(targetChatId)) {
            targetChatId = targetChatId;
          } else {
            targetChatId = `@${targetChatId}`;
          }
        }
      }

      if (!targetChatId) {
        await api.sendMessage({
          chat_id: chatId,
          text: getMessage('ERR_MEDIA_CHANNEL_INVALID', lang),
          reply_markup: getCancelKeyboard(lang),
        });
        return;
      }

      const chatInfo = await api.getChat({ chat_id: targetChatId });
      if (!chatInfo || chatInfo.type !== 'channel') {
        await api.sendMessage({
          chat_id: chatId,
          text: getMessage('ERR_MEDIA_CHANNEL_INVALID', lang),
          reply_markup: getCancelKeyboard(lang),
        });
        return;
      }

      // Check bot membership & admin rights
      try {
        const botMember = await api.getChatMember({
          chat_id: chatInfo.id,
          user_id: CONFIG.BOT.ID,
        });

        const isBotAdmin = botMember && ['creator', 'administrator'].includes(botMember.status);
        if (!isBotAdmin || botMember.can_post_messages === false) {
          await api.sendMessage({
            chat_id: chatId,
            text: getMessage('ERR_MEDIA_CHANNEL_NOT_ADMIN', lang),
            reply_markup: getCancelKeyboard(lang),
          });
          return;
        }
      } catch (checkErr) {
        await api.sendMessage({
          chat_id: chatId,
          text: getMessage('ERR_MEDIA_CHANNEL_NOT_ADMIN', lang),
          reply_markup: getCancelKeyboard(lang),
        });
        return;
      }

      await setMediaChannel({
        channelId: String(chatInfo.id),
        channelUsername: chatInfo.username ? `@${chatInfo.username}` : null,
        title: chatInfo.title || 'Media Channel',
      });

      await clearUserState(fromUser.id);
      await api.sendMessage({
        chat_id: chatId,
        text: getMessage('ADMIN_MEDIA_CHANNEL_SAVED', lang, {
          title: chatInfo.title || 'Media Channel',
          channelId: chatInfo.id,
          id: chatInfo.id,
        }),
        parse_mode: 'HTML',
        reply_markup: getMainKeyboard(lang, isAdmin),
      });
    } catch (err) {
      await api.sendMessage({
        chat_id: chatId,
        text: getMessage('ERR_MEDIA_CHANNEL_INVALID', lang),
        reply_markup: getCancelKeyboard(lang),
      });
    }
    return;
  }

  // Handle File Uploads (.txt, .docx, .xlsx)
  if (message.document) {
    const doc = message.document;
    const fileName = doc.file_name || 'test.txt';
    const lowerName = fileName.toLowerCase();

    if (
      lowerName.endsWith('.txt') ||
      lowerName.endsWith('.docx') ||
      lowerName.endsWith('.xlsx') ||
      lowerName.endsWith('.pdf')
    ) {
      let progressMsg = null;
      try {
        progressMsg = await api.sendMessage({
          chat_id: chatId,
          text: getMessage('FILE_PROCESSING', lang),
        });
      } catch {}

      try {
        const bytes = await api.getFileContent(doc.file_id);
        const result = parseQuizInput(bytes, fileName, lang);

        if (progressMsg?.message_id) {
          try {
            await api.deleteMessage({ chat_id: chatId, message_id: progressMsg.message_id });
          } catch {}
        }

        if (!result.success) {
          await api.sendMessage({
            chat_id: chatId,
            text: `${getMessage('PARSER_ERROR_HEADER', lang)}${result.error}`,
            parse_mode: 'HTML',
            reply_markup: getMainKeyboard(lang, isAdmin),
          });
          return;
        }

        const newQuiz = await createQuiz(fromUser.id, result.title, result.questions);
        await clearUserState(fromUser.id);

        await api.sendMessage({
          chat_id: chatId,
          text: getMessage('PARSER_SUCCESS', lang, {
            title: newQuiz.title,
            total: result.questions.length,
            time: newQuiz.timeLimit,
          }),
          parse_mode: 'HTML',
          reply_markup: getQuizCardKeyboard(newQuiz, lang, true, false),
        });

        await api.sendMessage({
          chat_id: chatId,
          text: getMessage('MAIN_MENU_CAPTION', lang),
          parse_mode: 'HTML',
          reply_markup: getMainKeyboard(lang, isAdmin),
        });
      } catch (err) {
        if (progressMsg?.message_id) {
          try {
            await api.deleteMessage({ chat_id: chatId, message_id: progressMsg.message_id });
          } catch {}
        }
        await api.sendMessage({
          chat_id: chatId,
          text: getMessage('FILE_PROCESS_ERROR', lang, { error: err.message }),
          reply_markup: getMainKeyboard(lang, isAdmin),
        });
      }
      return;
    }
  }

  // Handle Commands
  if (text.startsWith('/start')) {
    await clearUserState(fromUser.id);
    const param = text.split(/\s+/)[1];

    if (param && param.startsWith('review_quiz_')) {
      const quizId = parseInt(param.replace('review_quiz_', ''), 10);
      if (quizId) {
        await startQuizSession(api, {
          chatId,
          userId: fromUser.id,
          quizId,
          isGroup: false,
          mode: ACTIONS.MODE_MISTAKES,
        });
        return;
      }
    }

    if (param && param.startsWith('quiz_')) {
      const quizId = parseInt(param.replace('quiz_', ''), 10);
      const quiz = await getQuizById(quizId);

      if (quiz) {
        const isOwner = quiz.ownerId === fromUser.id;
        const mistakesCount = await getUserMistakesCount(fromUser.id, quiz.id);
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
          reply_markup: getQuizCardKeyboard(quiz, lang, isOwner, mistakesCount > 0),
        });
        return;
      }
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

  if (text === '/help' || isButtonMatch(text, 'BTN_HELP')) {
    await api.sendMessage({
      chat_id: chatId,
      text: getMessage('HELP_TEXT', lang),
      parse_mode: 'HTML',
      reply_markup: getMainKeyboard(lang, isAdmin),
    });
    return;
  }

  if (text === '/myquizzes' || isButtonMatch(text, 'BTN_MY_QUIZZES')) {
    const quizzesList = await getUserQuizzes(fromUser.id, 0);
    const count = await getUserQuizzesCount(fromUser.id);

    if (count === 0) {
      await api.sendMessage({
        chat_id: chatId,
        text: getMessage('ERR_NO_QUIZZES', lang),
        reply_markup: getMainKeyboard(lang, isAdmin),
      });
      return;
    }

    await api.sendMessage({
      chat_id: chatId,
      text: getMessage('MY_QUIZZES_TITLE', lang, { count }),
      parse_mode: 'HTML',
      reply_markup: getMyQuizzesPageKeyboard(quizzesList, 0, count, lang),
    });
    return;
  }

  // Handle KIUT Tests Center button
  if (text === '/kiut' || isButtonMatch(text, 'BTN_KIUT_TEST')) {
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

    await api.sendMessage({
      chat_id: chatId,
      text: getMessage('KIUT_MENU_HEADER', lang),
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard },
    });
    return;
  }

  if (text === '/mistakes' || isButtonMatch(text, 'BTN_MY_MISTAKES')) {
    const grouped = await getUserMistakesGrouped(fromUser.id);

    if (grouped.length === 0) {
      await api.sendMessage({
        chat_id: chatId,
        text: getMessage('MISTAKES_EMPTY', lang),
        reply_markup: getMainKeyboard(lang, isAdmin),
      });
      return;
    }

    const totalMistakes = grouped.reduce((sum, g) => sum + g.count, 0);

    await api.sendMessage({
      chat_id: chatId,
      text: getMessage('MISTAKES_CHOOSE_SUBJECT', lang, { count: totalMistakes }),
      parse_mode: 'HTML',
      reply_markup: getMistakesPageKeyboard(grouped, 0, lang),
    });
    return;
  }


  if (isButtonMatch(text, 'BTN_UPLOAD_TEST')) {
    await api.sendMessage({
      chat_id: chatId,
      text: getMessage('UPLOAD_INSTRUCTION', lang),
      parse_mode: 'HTML',
      reply_markup: getMainKeyboard(lang, isAdmin),
    });
    return;
  }

  // Handle language button click
  if (text === '/set_language' || isButtonMatch(text, 'BTN_LANGUAGE')) {
    await api.sendMessage({
      chat_id: chatId,
      text: getMessage('LANG_CHOOSE_PROMPT', lang),
      parse_mode: 'HTML',
      reply_markup: getLanguageReplyKeyboard(lang),
    });
    return;
  }

  // Handle language reply selection
  if (text === "🇺🇿 O'zbekcha" || text === '🇷🇺 Русский' || text === '🇺🇸 English') {
    let newLang = 'UZ';
    if (text === '🇷🇺 Русский') newLang = 'RU';
    if (text === '🇺🇸 English') newLang = 'EN';

    await setUserLanguage(fromUser.id, newLang);

    await api.sendMessage({
      chat_id: chatId,
      text: getMessage('LANG_CHANGED_SUCCESS', newLang),
      reply_markup: getMainKeyboard(newLang, isAdmin),
    });
    return;
  }

  if (isButtonMatch(text, 'BTN_ADD_TO_GROUP')) {
    const adminPerms = 'post_messages+delete_messages+restrict_members+pin_messages+manage_topics';
    await api.sendMessage({
      chat_id: chatId,
      text: getMessage('GROUP_ADD_PROMPT', lang),
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: getMessage('BTN_SELECT_AND_ADD_GROUP', lang),
              url: `https://t.me/${CONFIG.BOT.USERNAME}?startgroup&admin=${adminPerms}`,
            },
          ],
        ],
      },
    });
    return;
  }

  if (isButtonMatch(text, 'BTN_SHARE_BOT')) {
    const shareText = encodeURIComponent(getMessage('SHARE_BOT_TEXT', lang));
    const shareUrl = encodeURIComponent(`https://t.me/${CONFIG.BOT.USERNAME}`);
    await api.sendMessage({
      chat_id: chatId,
      text: getMessage('SHARE_BOT_CAPTION', lang, { username: CONFIG.BOT.USERNAME }),
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: getMessage('BTN_SHARE_TO_FRIENDS', lang),
              url: `https://t.me/share/url?url=${shareUrl}&text=${shareText}`,
            },
          ],
        ],
      },
    });
    return;
  }

  if ((text === '/admin' || isButtonMatch(text, 'BTN_ADMIN')) && isAdmin) {
    await api.sendMessage({
      chat_id: chatId,
      text: getMessage('ADMIN_WELCOME', lang),
      parse_mode: 'HTML',
      reply_markup: getAdminDashboardKeyboard(lang),
    });
    return;
  }

  // Check if message text is a pasted quiz (multiple lines, test formatting)
  if (text.includes('\n') && (text.includes('A)') || text.includes('?') || text.includes('++++') || text.includes('1.'))) {
    const result = parseQuizInput(text, 'Test.txt');
    if (result.success && result.questions.length > 0) {
      const newQuiz = await createQuiz(fromUser.id, result.title, result.questions);
      await clearUserState(fromUser.id);

      await api.sendMessage({
        chat_id: chatId,
        text: getMessage('PARSER_SUCCESS', lang, {
          title: newQuiz.title,
          total: result.questions.length,
          time: newQuiz.timeLimit,
        }),
        parse_mode: 'HTML',
        reply_markup: getQuizCardKeyboard(newQuiz, lang, true, false),
      });

      await api.sendMessage({
        chat_id: chatId,
        text: getMessage('MAIN_MENU_CAPTION', lang),
        parse_mode: 'HTML',
        reply_markup: getMainKeyboard(lang, isAdmin),
      });
      return;
    }
  }

  // Fallback default message
  await api.sendMessage({
    chat_id: chatId,
    text: getMessage('START_WELCOME', lang, { name: fromUser.first_name }),
    parse_mode: 'HTML',
    reply_markup: getMainKeyboard(lang, isAdmin),
  });
}
