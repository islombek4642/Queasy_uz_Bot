// tgcloud/lib/services/session_service.js
// Solo and Group Quiz Sessions Manager with 4 modes & mistakes tracking

import { db } from 'sdk';
import { eq, and, or, desc, sql } from 'sdk/db';
import { users, quizSessions, userMistakes, groupAnswers, questions, quizzes, groupLobbies, groups } from '../../schema.js';
import { getQuizById } from './quiz_service.js';
import { CONFIG } from '../constants/config.js';
import { ACTIONS } from '../constants/actions.js';
import { getMessage } from '../constants/messages.js';
import { getMainKeyboard } from '../keyboards/main_keyboard.js';
import { getStopKeyboard } from '../keyboards/mode_keyboard.js';
import { truncateQuestion, truncateOption, truncateExplanation, escapeHtml, formatParticipantName } from '../utils/poll_helpers.js';
import { sanitizeQuestionText, sanitizeOptionsList } from '../parsers/sanitizer.js';
import { getMediaChannel } from './admin_service.js';
import { getOrCreateUser } from './user_service.js';
import { hasMathFormula, renderAndUploadFormula, generateLatexImageUrl } from '../parsers/math_engine.js';
import turso from '../turso_client.js';

export async function logAppError(source, msg, details = null) {
  try {
    await db.run(sql`CREATE TABLE IF NOT EXISTS app_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      level TEXT NOT NULL,
      source TEXT NOT NULL,
      message TEXT NOT NULL,
      details TEXT,
      created_at INTEGER DEFAULT (unixepoch())
    )`);
    await db.run(sql`INSERT INTO app_logs (level, source, message, details) VALUES ('error', ${source}, ${String(msg)}, ${details ? JSON.stringify(details) : null})`);
  } catch (e) {
    console.error('[logAppError]', e);
  }
}


/**
 * Shuffles an array and returns new array and remapped correct index.
 */
function shuffleQuestionOptions(options, correctOptionId) {
  const correctText = options[correctOptionId];
  const indices = options.map((_, i) => i);

  // Fisher-Yates shuffle
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }

  const shuffledOptions = indices.map((idx) => options[idx]);
  const newCorrectId = shuffledOptions.indexOf(correctText);

  return {
    options: shuffledOptions,
    correctOptionId: newCorrectId !== -1 ? newCorrectId : 0,
  };
}

export async function startQuizSession(api, { chatId, userId, quizId, isGroup = false, mode = ACTIONS.MODE_FULL, range = null, randomCount = null, lang = 'UZ' }) {
  let selectedQuestions = [];
  let timeLimit = CONFIG.POLL.DEFAULT_TIME_LIMIT;

  if (mode === ACTIONS.MODE_MISTAKES) {
    // Load mistakes for this user
    let mistakes = [];
    if (quizId && quizId > 0) {
      mistakes = await db
        .select()
        .from(userMistakes)
        .where(and(eq(userMistakes.userId, userId), eq(userMistakes.originalQuizId, quizId)))
        .all();
    } else {
      mistakes = await db
        .select()
        .from(userMistakes)
        .where(eq(userMistakes.userId, userId))
        .all();
    }

    if (mistakes.length === 0) {
      return { success: false, error: getMessage('ERR_MISTAKES_EMPTY_SUBJECT', lang) };
    }

    // Deduplicate mistakes by questionText
    const seen = new Set();
    const uniqueMistakes = [];
    for (const m of mistakes) {
      if (!seen.has(m.questionText)) {
        seen.add(m.questionText);
        uniqueMistakes.push(m);
      }
    }

    selectedQuestions = uniqueMistakes.map((m) => {
      let opts = [];
      try { opts = JSON.parse(m.optionsJson); } catch { opts = []; }
      const shuf = shuffleQuestionOptions(opts, m.correctOptionId);
      return {
        mistakeId: m.id,
        originalQuizId: m.originalQuizId,
        questionText: m.questionText,
        options: shuf.options,
        correctOptionId: shuf.correctOptionId,
        explanation: m.explanation,
        photoFileId: m.photoFileId || null,
        photoCaption: m.photoCaption || null,
      };
    });
  } else {
    const quiz = await getQuizById(quizId);
    if (!quiz || quiz.questions.length === 0) {
      return { success: false, error: getMessage('ERR_QUIZ_EMPTY', lang) };
    }

    timeLimit = quiz.timeLimit || CONFIG.POLL.DEFAULT_TIME_LIMIT;
    let pool = [...quiz.questions];

    if (mode === ACTIONS.MODE_RANGE && range) {
      const [start, end] = range;
      pool = pool.slice(start - 1, end);
    } else if (mode === ACTIONS.MODE_RANDOM && randomCount) {
      // Shuffle pool and slice randomCount
      pool.sort(() => Math.random() - 0.5);
      pool = pool.slice(0, Math.min(randomCount, pool.length));
    }

    const quizTotal = quiz.questions.length;

    // Apply option shuffling if enabled and preserve original question number and total
    selectedQuestions = pool.map((q, idx) => {
      const originalNum = q.orderIndex !== undefined ? q.orderIndex + 1 : idx + 1;
      if (quiz.shuffleOptions !== false) {
        const shuf = shuffleQuestionOptions(q.options, q.correctOptionId);
        return {
          ...q,
          originalNum,
          originalTotal: quizTotal,
          options: shuf.options,
          correctOptionId: shuf.correctOptionId,
        };
      }
      return {
        ...q,
        originalNum,
        originalTotal: quizTotal,
      };
    });
  }

  if (selectedQuestions.length === 0) {
    return { success: false, error: getMessage('ERR_QUIZ_EMPTY', lang) };
  }

  // Deactivate any previous active sessions in this chat
  await db
    .update(quizSessions)
    .set({ isActive: false })
    .where(and(eq(quizSessions.chatId, chatId), eq(quizSessions.isActive, true)))
    .run();

  // Insert new session
  await db
    .insert(quizSessions)
    .values({
      quizId: quizId || 0,
      chatId,
      userId,
      isGroup,
      mode,
      currentIndex: 0,
      totalQuestions: selectedQuestions.length,
      correctCount: 0,
      wrongCount: 0,
      isActive: true,
      selectedQuestionsJson: JSON.stringify(selectedQuestions),
    })
    .run();

  const session = await db
    .select()
    .from(quizSessions)
    .where(and(eq(quizSessions.chatId, chatId), eq(quizSessions.isActive, true)))
    .orderBy(desc(quizSessions.id))
    .limit(1)
    .get();

  // Send Stop Keyboard immediately in solo mode
  if (!isGroup) {
    const user = await db
      .select()
      .from(users)
      .where(eq(users.telegramId, userId))
      .get();
    const lang = user?.lang || 'UZ';

    await api.sendMessage({
      chat_id: chatId,
      text: getMessage('QUIZ_STARTING', lang),
      reply_markup: getStopKeyboard(lang),
    });
  }

  // Dispatch the 1st question poll
  await sendNextQuestionPoll(api, session.id, timeLimit);

  return { success: true, session };
}

export async function sendNextQuestionPoll(api, sessionId, customTimeLimit = null) {
  const session = await db
    .select()
    .from(quizSessions)
    .where(eq(quizSessions.id, sessionId))
    .get();

  if (!session || !session.isActive) return;

  // Auto-skip stuck questions: try up to 3 consecutive questions if sending fails
  const MAX_SKIP = 3;
  for (let skipAttempt = 0; skipAttempt < MAX_SKIP; skipAttempt++) {
    const attemptIndex = session.currentIndex + skipAttempt;
    let questions = [];
    try {
      questions = JSON.parse(session.selectedQuestionsJson);
    } catch {
      questions = [];
    }

    if (attemptIndex >= questions.length) {
      await finishSession(api, sessionId);
      return;
    }

    if (skipAttempt > 0) {
      // Advance index in DB before retrying
      console.warn(`[sendNextQuestionPoll] Skipping question index ${attemptIndex - 1} (attempt ${skipAttempt}), trying index ${attemptIndex}`);
      await db.update(quizSessions).set({ currentIndex: attemptIndex }).where(eq(quizSessions.id, sessionId)).run();
      // Refresh session from DB
      const refreshed = await db.select().from(quizSessions).where(eq(quizSessions.id, sessionId)).get();
      if (!refreshed || !refreshed.isActive) return;
    }

    const attemptSession = skipAttempt === 0 ? session : await db.select().from(quizSessions).where(eq(quizSessions.id, sessionId)).get();
    const attemptQ = questions[attemptIndex];
    if (!attemptQ) { await finishSession(api, sessionId); return; }

    // Try sending this question
    const sent = await _trySendQuestionPoll(api, sessionId, attemptSession, attemptQ, customTimeLimit);
    if (sent === true) return; // success
    if (sent === 'RATE_LIMITED') {
      console.warn(`[sendNextQuestionPoll] Session ${sessionId} hit rate limit, keeping session active without killing`);
      return;
    }
  }

  // All attempts failed
  console.error(`[sendNextQuestionPoll] All ${MAX_SKIP} attempts failed for session ${sessionId}, finishing session`);
  await logAppError('sendNextQuestionPoll:ALL_FAILED', `All ${MAX_SKIP} attempts failed for session ${sessionId}`, {
    sessionId,
    currentIndex: session?.currentIndex,
  });
  await finishSession(api, sessionId);
}

// Internal: attempts to send one question poll. Returns true on success, false on failure.
async function _trySendQuestionPoll(api, sessionId, session, q, customTimeLimit = null) {

  let timeLimit = customTimeLimit;
  let quiz = null;
  if (session.quizId) {
    quiz = await getQuizById(session.quizId);
    if (!timeLimit) {
      timeLimit = quiz?.timeLimit || CONFIG.POLL.DEFAULT_TIME_LIMIT;
    }
  }
  if (!timeLimit) {
    timeLimit = CONFIG.POLL.DEFAULT_TIME_LIMIT;
  }

  const qNum = session.currentIndex + 1;
  const total = session.totalQuestions;

  // 1. Agar savolga rasm biriktirilmagan bo'lsa yoki http URL bo'lsa, Media kanalga yuklab file_id olamiz
  let photoToSend = q.photoFileId || null;

  if ((!photoToSend || photoToSend.startsWith('http')) && hasMathFormula(q.questionText)) {
    try {
      const mediaCh = await getMediaChannel();
      if (mediaCh && mediaCh.channelId) {
        photoToSend = await renderAndUploadFormula({
          api,
          mediaChannelId: mediaCh.channelId,
          latexFormula: q.questionText,
          caption: `📝 Savol #${qNum} (ID: ${q.id || ''})`,
        });

        // Agar muvaffaqiyatli Telegram file_id qaytgan bo'lsa, kelgusi testlar uchun keshlab qo'yamiz
        if (photoToSend && q.id && !photoToSend.startsWith('http')) {
          await db
            .update(questions)
            .set({ photoFileId: photoToSend })
            .where(eq(questions.id, q.id))
            .run();
          q.photoFileId = photoToSend;
        }
      } else if (!photoToSend) {
        // Agar maxsus media kanal ulanmagan bo'lsa, to'g'ridan-to'g'ri CodeCogs 300 DPI rasm URL'idan foydalanamiz
        photoToSend = generateLatexImageUrl(q.questionText, 300);
      }
    } catch (mathErr) {
      console.error(`[sendNextQuestionPoll] Auto math formula render error for question ${qNum}:`, mathErr?.message);
    }
  }

  // 2. Telegram Question header va max 300 belgi limit bo'yicha qisqartirish
  const prefix = `[${qNum}/${total}]`;
  const cleanText = sanitizeQuestionText(q.questionText);
  const questionTitle = truncateQuestion(prefix, cleanText, CONFIG.POLL.MAX_QUESTION_LENGTH);

  // 3. Variantlar (tozalangan, formulalar rasmga o'girilgan va max 100 belgi limit)
  const sanitizedOpts = sanitizeOptionsList(q.options || []);
  const letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];
  let options = sanitizedOpts
    .map((opt, idx) => {
      const letter = letters[idx] || String(idx + 1);
      // Agar variant allaqachon media obyektiga ega bo'lsa
      if (opt && typeof opt === 'object' && opt.media) {
        return truncateOption(opt, CONFIG.POLL.MAX_OPTION_LENGTH);
      }
      const optText = typeof opt === 'object' ? opt.text : String(opt || '');
      // Agar variantda matematik/kimyoviy formula bo'lsa, avtomatik 300 DPI rasm biriktiramiz
      if (hasMathFormula(optText)) {
        const cleanMathText = optText.replace(/\$/g, '').trim();
        const formulaImgUrl = generateLatexImageUrl(optText, 300);
        return {
          text: truncateOption(`${letter}) ${cleanMathText}`, CONFIG.POLL.MAX_OPTION_LENGTH),
          media: { type: 'photo', media: formulaImgUrl },
        };
      }
      return truncateOption(opt, CONFIG.POLL.MAX_OPTION_LENGTH);
    })
    .filter(Boolean);

  if (options.length < CONFIG.POLL.MIN_OPTIONS) {
    options = [
      getMessage('POLL_FALLBACK_OPTION_1', session.lang || 'UZ'),
      getMessage('POLL_FALLBACK_OPTION_2', session.lang || 'UZ'),
    ];
  } else if (options.length > CONFIG.POLL.MAX_OPTIONS) {
    options = options.slice(0, CONFIG.POLL.MAX_OPTIONS);
  }

  const correctOptionId = Math.max(0, Math.min(q.correctOptionId ?? 0, options.length - 1));
  const explanation = truncateExplanation(q.explanation, CONFIG.POLL.MAX_EXPLANATION_LENGTH);
  const nextBtnMarkup = session.isGroup
    ? {
        inline_keyboard: [
          [
            {
              text: getMessage('BTN_NEXT_QUESTION', 'UZ'),
              callback_data: `${ACTIONS.NEXT_QUESTION_PREFIX}${sessionId}:${session.currentIndex}`,
            },
          ],
        ],
      }
    : undefined;

  const shuffleOptions = quiz ? quiz.shuffleOptions !== false : true;
  const isGroup = Boolean(session.isGroup);
  const pollMedia = (photoToSend && typeof photoToSend === 'string' && photoToSend.trim().length > 0)
    ? { type: 'photo', media: photoToSend.trim() }
    : undefined;
  const explanationMedia = (q.explanationPhotoFileId && typeof q.explanationPhotoFileId === 'string' && q.explanationPhotoFileId.trim().length > 0)
    ? { type: 'photo', media: q.explanationPhotoFileId.trim() }
    : undefined;

  const hasStructuredOptions = options.some((o) => typeof o === 'object' && o.media);
  const useModernPoll = Boolean(pollMedia || hasStructuredOptions);

  try {
    let pollMsg = null;
    let fallbackPhotoSent = false;

    // 1. If question has a photo, send photo first
    if (photoToSend) {
      try {
        await api.sendPhoto({
          chat_id: session.chatId,
          photo: photoToSend,
          caption: q.photoCaption ? String(q.photoCaption).slice(0, 1024) : undefined,
          parse_mode: 'HTML',
        });
        fallbackPhotoSent = true;
      } catch (photoErr) {
        console.error(`[sendNextQuestionPoll] Photo send error:`, photoErr?.message);
      }
    }

    // Convert any structured options to clean strings for sendPoll
    const stringOptions = options.map((o) => (typeof o === 'object' ? (o.text || String(o)) : String(o)));

    try {
      pollMsg = await api.sendPoll({
        chat_id: session.chatId,
        question: questionTitle,
        question_parse_mode: 'HTML',
        options: stringOptions,
        is_anonymous: false,
        type: 'quiz',
        correct_option_id: correctOptionId,
        explanation,
        explanation_parse_mode: explanation ? 'HTML' : undefined,
        open_period: Math.max(CONFIG.POLL.MIN_DURATION, Math.min(timeLimit, CONFIG.POLL.MAX_DURATION)),
        reply_markup: nextBtnMarkup,
      });
    } catch (htmlErr) {
      // HTML parse fallback without parse_mode
      console.warn(`[sendNextQuestionPoll] HTML parse mode failed, falling back to plain text:`, htmlErr?.message);
      pollMsg = await api.sendPoll({
        chat_id: session.chatId,
        question: questionTitle,
        options: stringOptions,
        is_anonymous: false,
        type: 'quiz',
        correct_option_id: correctOptionId,
        explanation,
        open_period: Math.max(CONFIG.POLL.MIN_DURATION, Math.min(timeLimit, CONFIG.POLL.MAX_DURATION)),
        reply_markup: nextBtnMarkup,
      });
    }

    if (pollMsg && pollMsg.poll) {
      await db
        .update(quizSessions)
        .set({
          lastPollId: pollMsg.poll.id,
          lastPollMessageId: pollMsg.message_id,
          lastPollSentAt: Math.floor(Date.now() / 1000),
        })
        .where(eq(quizSessions.id, sessionId))
        .run();
      return true; // success
    }
  } catch (err) {
    const isRateLimit = err?.message?.includes('429') || err?.message?.includes('Too Many Requests');
    console.error(`[_trySendQuestionPoll] Error sending question index ${session.currentIndex} for session ${sessionId} (isRateLimit=${isRateLimit}):`, err?.message);
    await logAppError('_trySendQuestionPoll:ERROR', err?.message || String(err), {
      sessionId,
      currentIndex: session?.currentIndex,
      attemptQId: q?.id,
      isRateLimit,
      errorCode: err?.error_code,
      description: err?.description,
    });
    if (isRateLimit) {
      try {
        const stringOptions = options.map((o) => (typeof o === 'object' ? (o.text || String(o)) : String(o)));
        const retryPollMsg = await api.sendPoll({
          chat_id: session.chatId,
          question: questionTitle,
          options: stringOptions,
          is_anonymous: false,
          type: 'quiz',
          correct_option_id: correctOptionId,
          explanation,
          open_period: Math.max(CONFIG.POLL.MIN_DURATION, Math.min(timeLimit, CONFIG.POLL.MAX_DURATION)),
          reply_markup: nextBtnMarkup,
        });
        if (retryPollMsg && retryPollMsg.poll) {
          await db
            .update(quizSessions)
            .set({
              lastPollId: retryPollMsg.poll.id,
              lastPollMessageId: retryPollMsg.message_id,
              lastPollSentAt: Math.floor(Date.now() / 1000),
            })
            .where(eq(quizSessions.id, sessionId))
            .run();
          return true; // success on retry
        }
      } catch (retryErr) {
        console.error(`[_trySendQuestionPoll] Rate limit retry failed:`, retryErr?.message);
        await logAppError('_trySendQuestionPoll:RETRY_FAILED', retryErr?.message || String(retryErr), {
          sessionId,
          currentIndex: session?.currentIndex,
        });
      }
      return 'RATE_LIMITED';
    }
    return false;
  }
  await logAppError('_trySendQuestionPoll:POLL_MSG_NULL', `pollMsg was null for question index ${session.currentIndex}`, {
    sessionId,
    currentIndex: session?.currentIndex,
  });
  return false; // pollMsg was null
}

export async function handlePollAnswer(api, pollAnswer) {
  const pollId = pollAnswer.poll_id;
  const tgUser = pollAnswer.user;
  const selectedOptionId = pollAnswer.option_ids?.[0];

  if (selectedOptionId === undefined) return;

  // Ensure user is recorded in users table
  if (tgUser && tgUser.id) {
    try {
      await getOrCreateUser(tgUser);
    } catch {}
  }

  const session = await db
    .select()
    .from(quizSessions)
    .where(and(eq(quizSessions.lastPollId, pollId), eq(quizSessions.isActive, true)))
    .get();

  if (!session) return;

  let questions = [];
  try {
    questions = JSON.parse(session.selectedQuestionsJson);
  } catch {
    questions = [];
  }

  const currentQ = questions[session.currentIndex];
  if (!currentQ) return;

  const isCorrect = selectedOptionId === currentQ.correctOptionId;

  if (session.isGroup) {
    // Group Multiplayer: calculate timeTaken (seconds)
    const nowSec = Math.floor(Date.now() / 1000);
    const timeTaken = session.lastPollSentAt ? Math.max(1, nowSec - session.lastPollSentAt) : 5;
    const fullName = [tgUser.first_name, tgUser.last_name].filter(Boolean).join(' ') || 'Foydalanuvchi';
    const userHandle = tgUser.username ? `@${tgUser.username}` : '';
    const userName = userHandle ? `${fullName} (${userHandle})` : fullName;

    // Check if this user already answered this question in this session to prevent duplicate entries
    const existingAnswer = await db
      .select()
      .from(groupAnswers)
      .where(
        and(
          eq(groupAnswers.sessionId, session.id),
          eq(groupAnswers.questionIndex, session.currentIndex),
          eq(groupAnswers.userId, tgUser.id)
        )
      )
      .get();

    if (!existingAnswer) {
      // Record individual participant response
      await db
        .insert(groupAnswers)
        .values({
          sessionId: session.id,
          pollId,
          userId: tgUser.id,
          userName,
          questionIndex: session.currentIndex,
          isCorrect,
          timeTaken,
        })
        .run();

      // If answer was incorrect, record in userMistakes so they can review in private chat
      if (!isCorrect) {
        await saveUserMistake(tgUser.id, currentQ, session.quizId);
      }
    }

    // Check if all expected participants from the lobby have answered this question
    const answersForCurrentQ = await db
      .select()
      .from(groupAnswers)
      .where(and(eq(groupAnswers.sessionId, session.id), eq(groupAnswers.questionIndex, session.currentIndex)))
      .all();

    const lobby = await db
      .select()
      .from(groupLobbies)
      .where(and(eq(groupLobbies.chatId, session.chatId), eq(groupLobbies.quizId, session.quizId)))
      .orderBy(desc(groupLobbies.id))
      .limit(1)
      .get();

    let expectedCount = 1;
    if (lobby && lobby.readyUsersJson) {
      try {
        const usersList = JSON.parse(lobby.readyUsersJson);
        if (Array.isArray(usersList) && usersList.length > 0) {
          expectedCount = usersList.length;
        }
      } catch {}
    }

    if (answersForCurrentQ.length >= expectedCount) {
      // All ready participants answered! Advance atomically
      await advanceGroupRoundByPollId(api, pollId);
    }
  } else {
    // Solo Mode: update score and record mistake if wrong
    const nextIndex = session.currentIndex + 1;
    const nextCorrect = isCorrect ? session.correctCount + 1 : session.correctCount;
    const nextWrong = !isCorrect ? session.wrongCount + 1 : session.wrongCount;

    if (!isCorrect) {
      // Save to user mistakes
      await saveUserMistake(tgUser.id, currentQ, session.quizId);
    } else if (session.mode === ACTIONS.MODE_MISTAKES && currentQ.mistakeId) {
      // If solved correctly in mistakes mode, remove this mistake
      await db.delete(userMistakes).where(eq(userMistakes.id, currentQ.mistakeId)).run();
    }

    // Atomic update to advance session index & clear lastPollId
    await db
      .update(quizSessions)
      .set({
        lastPollId: null,
        correctCount: nextCorrect,
        wrongCount: nextWrong,
        currentIndex: nextIndex,
      })
      .where(eq(quizSessions.id, session.id))
      .run();

    // Advance to next question immediately
    await sendNextQuestionPoll(api, session.id);
  }
}

export async function advanceGroupRound(api, sessionIdOrChatId, timeLimit = 30, fromIndex = null) {
  let session = await db
    .select()
    .from(quizSessions)
    .where(and(eq(quizSessions.id, sessionIdOrChatId), eq(quizSessions.isActive, true)))
    .get();

  if (!session) {
    session = await db
      .select()
      .from(quizSessions)
      .where(and(eq(quizSessions.chatId, sessionIdOrChatId), eq(quizSessions.isActive, true)))
      .get();
  }

  if (!session) return;

  // Agar tugma eskirgan savoldan bosilgan bo'lsa (allaqachon boshqa savolga o'tib bo'lingan bo'lsa), e'tiborsiz qoldiramiz
  if (fromIndex !== null && session.currentIndex !== fromIndex) {
    console.log(`[advanceGroupRound] Already advanced (current=${session.currentIndex}, fromIndex=${fromIndex}), aborting`);
    return;
  }

  const nextIndex = session.currentIndex + 1;
  if (nextIndex >= session.totalQuestions) {
    await finishSession(api, session.id);
  } else {
    const quiz = await getQuizById(session.quizId);
    const roundTimeLimit = quiz?.timeLimit || timeLimit || CONFIG.POLL.DEFAULT_TIME_LIMIT;

    // Atomik CAS: Faqat currentIndex kutilgan holatda bo'lsagina yangilaymiz (orqama-ketin 2 marta bosilsa savol tashlab ketmaydi)
    const whereCond = fromIndex !== null
      ? and(eq(quizSessions.id, session.id), eq(quizSessions.currentIndex, fromIndex))
      : and(eq(quizSessions.id, session.id), eq(quizSessions.currentIndex, session.currentIndex));

    const res = await db
      .update(quizSessions)
      .set({ currentIndex: nextIndex, lastPollId: null })
      .where(whereCond)
      .run();

    const affected = res?.rowsAffected ?? res?.changes ?? -1;
    if (affected === 0) {
      console.log(`[advanceGroupRound] Concurrent advance detected (affected=0), aborting`);
      return;
    }

    await sendNextQuestionPoll(api, session.id, roundTimeLimit);
  }
}

export async function advanceGroupRoundByPollId(api, pollId) {
  const pId = String(pollId);
  const session = await db
    .select()
    .from(quizSessions)
    .where(and(eq(quizSessions.lastPollId, pId), eq(quizSessions.isActive, true)))
    .get();

  if (!session) return;

  const nextIndex = session.currentIndex + 1;
  // Clear lastPollId atomically so duplicate poll updates don't trigger twice
  const res = await db
    .update(quizSessions)
    .set({
      currentIndex: nextIndex,
      lastPollId: null,
    })
    .where(and(eq(quizSessions.id, session.id), eq(quizSessions.lastPollId, pId)))
    .run();

  // Use nullish coalescing: prefer rowsAffected, fall back to changes
  const affected = res?.rowsAffected ?? res?.changes ?? -1;
  console.log(`[advanceGroupRoundByPollId] CAS UPDATE result: affected=${affected}, session=${session.id}, pollId=${pId}`);

  // If another concurrent request already updated lastPollId, abort to avoid duplicate question!
  if (affected === 0) {
    console.log(`[advanceGroupRoundByPollId] Duplicate detected (affected=0), aborting for session ${session.id}`);
    return;
  }


  if (nextIndex >= session.totalQuestions) {
    await finishSession(api, session.id);
  } else {
    const quiz = await getQuizById(session.quizId);
    const timeLimit = quiz?.timeLimit || CONFIG.POLL.DEFAULT_TIME_LIMIT;
    await sendNextQuestionPoll(api, session.id, timeLimit);
  }
}

export async function finishSession(api, sessionId, isStopped = false) {
  const session = await db
    .select()
    .from(quizSessions)
    .where(eq(quizSessions.id, sessionId))
    .get();

  if (!session || !session.isActive) return;

  const res = await db
    .update(quizSessions)
    .set({ isActive: false })
    .where(and(eq(quizSessions.id, sessionId), eq(quizSessions.isActive, true)))
    .run();

  const affected = res?.rowsAffected ?? res?.changes ?? -1;
  if (affected === 0) {
    console.log(`[finishSession] Session ${sessionId} already finished concurrently`);
    return;
  }

  // If there is an active poll open, stop it so answers can no longer be clicked
  if (session.lastPollMessageId) {
    try {
      await api.stopPoll({
        chat_id: session.chatId,
        message_id: session.lastPollMessageId,
      });
    } catch {}
  }

  const user = await db
    .select()
    .from(users)
    .where(eq(users.telegramId, session.userId))
    .get();
  const lang = user?.lang || 'UZ';

  if (session.isGroup) {
    // Generate Leaderboard
    const answers = await db
      .select()
      .from(groupAnswers)
      .where(eq(groupAnswers.sessionId, sessionId))
      .all();

    const userStats = {};
    for (const a of answers) {
      if (!userStats[a.userId]) {
        userStats[a.userId] = {
          userId: a.userId,
          name: a.userName,
          correct: 0,
          answered: 0,
          totalTime: 0,
        };
      }
      userStats[a.userId].answered += 1;
      userStats[a.userId].totalTime += (a.timeTaken || 0);
      if (a.isCorrect) {
        userStats[a.userId].correct += 1;
      }
    }

    const quiz = await getQuizById(session.quizId);
    const quizTitle = quiz?.title || 'Test';

    // Sort by: correct desc, then totalTime asc
    const sorted = Object.values(userStats).sort((a, b) => {
      if (b.correct !== a.correct) return b.correct - a.correct;
      return a.totalTime - b.totalTime;
    });

    let text = `🏁 <b>${escapeHtml(quizTitle)}</b>\n`;
    text += `${getMessage('GROUP_LEADERBOARD_TITLE', lang)}\n\n`;

    if (sorted.length === 0) {
      text += `${getMessage('GROUP_NO_ANSWERS', lang)}\n`;
    } else {
      const top10 = sorted.slice(0, 10);
      const medals = { 0: '🥇', 1: '🥈', 2: '🥉' };
      for (let i = 0; i < top10.length; i++) {
        const u = top10[i];
        const rank = medals[i] ? `${medals[i]} ${i + 1}.` : `${i + 1}.`;
        const timeStr = getMessage('TIME_SECONDS', lang, { n: u.totalTime });
        const displayName = formatParticipantName(u.name, u.userId);
        text += `${rank} ${displayName} – <b>${u.correct}</b>/${u.answered} (${timeStr})\n`;
      }
    }

    const summary = getMessage('GROUP_QUIZ_SUMMARY', lang, {
      count: sorted.length,
      total: session.totalQuestions,
    });
    text += `\n${summary}`;

    const botUsername = CONFIG.BOT.USERNAME || 'Queasy_uz_Bot';
    const reply_markup = {
      inline_keyboard: [
        [
          {
            text: getMessage('BTN_REVIEW_MISTAKES', lang),
            url: `https://t.me/${botUsername}?start=quiz_${session.quizId}`,
          },
        ],
      ],
    };

    await api.sendMessage({
      chat_id: session.chatId,
      text,
      parse_mode: 'HTML',
      reply_markup,
      disable_web_page_preview: true,
      link_preview_options: { is_disabled: true },
    });
  } else {
    // Solo Scorecard
    const percent = Math.round((session.correctCount / (session.totalQuestions || 1)) * 100);
    const msgKey = isStopped ? 'QUIZ_STOPPED' : 'QUIZ_SOLO_FINISHED';
    let text = getMessage(msgKey, lang, {
      total: session.totalQuestions,
      correct: session.correctCount,
      wrong: session.wrongCount,
      percent,
    });

    let remainingMistakes = 0;
    try {
      remainingMistakes = await getUserMistakesCount(session.userId);
    } catch (err) {
      console.error('Error fetching remaining mistakes for finishSession:', err);
    }

    const isAdmin = CONFIG.ADMINS.includes(Number(session.userId));
    const hasMistakes = session.wrongCount > 0 || remainingMistakes > 0;
    const hasRemainingQuestions = !session.isGroup && (session.currentIndex < session.totalQuestions);

    const inline_keyboard = [];
    if (hasMistakes) {
      inline_keyboard.push([
        {
          text: getMessage('BTN_REVIEW_MISTAKES', lang),
          callback_data: `${ACTIONS.REVIEW_MISTAKES_PREFIX}${session.quizId || 0}`,
        },
      ]);
    }

    if (hasRemainingQuestions) {
      inline_keyboard.push([
        {
          text: getMessage('BTN_RESUME_QUIZ', lang),
          callback_data: `${ACTIONS.RESUME_QUIZ_PREFIX}${session.id}`,
        },
      ]);
    }

    if (inline_keyboard.length > 0) {
      try {
        await api.sendMessage({
          chat_id: session.chatId,
          text,
          parse_mode: 'HTML',
          reply_markup: { inline_keyboard },
        });
      } catch (err) {
        console.error('Error sending finishSession scorecard with inline keyboard:', err);
        try {
          await api.sendMessage({
            chat_id: session.chatId,
            text: text.replace(/<[^>]*>/g, ''),
            reply_markup: { inline_keyboard },
          });
        } catch {}
      }

      // Restore bottom reply keyboard back to Main Menu so "Testni to'xtatish" button disappears
      try {
        await api.sendMessage({
          chat_id: session.chatId,
          text: getMessage('MAIN_MENU_CAPTION', lang),
          parse_mode: 'HTML',
          reply_markup: getMainKeyboard(lang, isAdmin),
        });
      } catch (err) {
        console.error('Error sending MAIN_MENU_CAPTION in finishSession:', err);
      }
    } else {
      // All mistakes resolved or 100% correct - restore Main Reply Keyboard directly in single message (no extra menu message)
      try {
        await api.sendMessage({
          chat_id: session.chatId,
          text,
          parse_mode: 'HTML',
          reply_markup: getMainKeyboard(lang, isAdmin),
        });
      } catch (err) {
        console.error('Error sending finishSession scorecard with main keyboard:', err);
        try {
          await api.sendMessage({
            chat_id: session.chatId,
            text: text.replace(/<[^>]*>/g, ''),
            reply_markup: getMainKeyboard(lang, isAdmin),
          });
        } catch {}
      }
    }
  }
}

export async function stopSession(api, chatId) {
  try {
    const idNum = Number(chatId);
    const isGroupChat = idNum < 0;

    let session;
    if (isGroupChat) {
      session = await db
        .select()
        .from(quizSessions)
        .where(
          and(
            eq(quizSessions.chatId, idNum),
            eq(quizSessions.isGroup, true),
            eq(quizSessions.isActive, true)
          )
        )
        .orderBy(desc(quizSessions.id))
        .limit(1)
        .get();
    } else {
      session = await db
        .select()
        .from(quizSessions)
        .where(
          and(
            eq(quizSessions.chatId, idNum),
            eq(quizSessions.isGroup, false),
            eq(quizSessions.isActive, true)
          )
        )
        .orderBy(desc(quizSessions.id))
        .limit(1)
        .get();
    }

    if (!session) return false;

    await finishSession(api, session.id, true);
    return true;
  } catch (err) {
    console.error('Error in stopSession:', err);
    return false;
  }
}

export async function resumeQuizSession(api, sessionId, userId = null) {
  try {
    const session = await db
      .select()
      .from(quizSessions)
      .where(eq(quizSessions.id, Number(sessionId)))
      .get();

    if (!session) {
      return false;
    }

    if (session.isGroup || session.currentIndex >= session.totalQuestions) {
      return false;
    }

    // Deactivate any currently active sessions for this user to avoid conflicts
    await db
      .update(quizSessions)
      .set({ isActive: false })
      .where(and(eq(quizSessions.userId, session.userId), eq(quizSessions.isActive, true)))
      .run();

    // Reactivate this session
    await db
      .update(quizSessions)
      .set({ isActive: true, lastPollId: null })
      .where(eq(quizSessions.id, session.id))
      .run();

    const user = await db
      .select()
      .from(users)
      .where(eq(users.telegramId, session.userId))
      .get();
    const lang = user?.lang || 'UZ';

    // Restore bottom reply keyboard with "Testni to'xtatish" button
    await api.sendMessage({
      chat_id: session.chatId,
      text: getMessage('QUIZ_RESUMING', lang, {
        current: session.currentIndex + 1,
        total: session.totalQuestions,
      }),
      parse_mode: 'HTML',
      reply_markup: getStopKeyboard(lang),
    });

    const quiz = await getQuizById(session.quizId);
    const timeLimit = quiz?.timeLimit || CONFIG.POLL.DEFAULT_TIME_LIMIT;

    // Dispatch the skipped/next question
    await sendNextQuestionPoll(api, session.id, timeLimit);
    return true;
  } catch (err) {
    console.error('Error in resumeQuizSession:', err);
    return false;
  }
}

export async function saveUserMistake(userId, question, originalQuizId = null) {
  const origNum = question.originalNum || (question.orderIndex !== undefined ? question.orderIndex + 1 : null);
  const uid = Number(userId);

  if (CONFIG.TURSO?.ENABLED) {
    try {
      const existing = await turso.get(
        'SELECT id FROM user_mistakes WHERE user_id = ? AND question_text = ?',
        [uid, question.questionText]
      );
      if (!existing) {
        await turso.run(
          'INSERT INTO user_mistakes (user_id, question_text, options_json, correct_option_id, explanation, photo_file_id, original_quiz_id, original_num, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, unixepoch())',
          [
            uid,
            question.questionText,
            JSON.stringify(question.options || []),
            Number(question.correctOptionId) || 0,
            question.explanation || null,
            question.photoFileId || null,
            originalQuizId,
            origNum,
          ]
        );
      }
    } catch (err) {
      console.warn('[session_service] Turso saveUserMistake fallback to local db:', err.message);
    }
  }

  // Prevent duplicate mistake entries for same user and question (local db backup)
  try {
    const existing = await db
      .select()
      .from(userMistakes)
      .where(
        and(
          eq(userMistakes.userId, uid),
          eq(userMistakes.questionText, question.questionText)
        )
      )
      .get();

    if (existing) return;

    await db
      .insert(userMistakes)
      .values({
        userId: uid,
        questionText: question.questionText,
        optionsJson: JSON.stringify(question.options),
        correctOptionId: question.correctOptionId,
        explanation: question.explanation || null,
        photoFileId: question.photoFileId || null,
        photoCaption: question.photoCaption || null,
        originalQuizId,
        originalNum: origNum,
      })
      .run();
  } catch {}
}

export async function getUserMistakesCount(userId, quizId = null) {
  const uid = Number(userId);

  if (CONFIG.TURSO?.ENABLED) {
    try {
      if (quizId && Number(quizId) > 0) {
        const row = await turso.get(
          'SELECT count(*) as count FROM user_mistakes WHERE user_id = ? AND original_quiz_id = ?',
          [uid, Number(quizId)]
        );
        return Number(row?.count || 0);
      }
      const row = await turso.get(
        'SELECT count(*) as count FROM user_mistakes m INNER JOIN quizzes q ON m.original_quiz_id = q.id WHERE m.user_id = ?',
        [uid]
      );
      return Number(row?.count || 0);
    } catch (err) {
      console.warn('[session_service] Turso getUserMistakesCount fallback:', err.message);
    }
  }

  if (quizId && Number(quizId) > 0) {
    return await db.$count(
      userMistakes,
      and(eq(userMistakes.userId, uid), eq(userMistakes.originalQuizId, Number(quizId)))
    );
  }
  return await db.$count(userMistakes, eq(userMistakes.userId, uid));
}

export async function clearUserMistakes(userId) {
  const uid = Number(userId);

  if (CONFIG.TURSO?.ENABLED) {
    try {
      await turso.run('DELETE FROM user_mistakes WHERE user_id = ?', [uid]);
    } catch (err) {
      console.warn('[session_service] Turso clearUserMistakes fallback:', err.message);
    }
  }

  try {
    await db
      .delete(userMistakes)
      .where(eq(userMistakes.userId, uid))
      .run();
  } catch {}
}

export async function getUserMistakesGrouped(userId) {
  const uid = Number(userId);

  if (CONFIG.TURSO?.ENABLED) {
    try {
      const rows = await turso.all(
        `SELECT m.original_quiz_id as quizId, q.title as title, count(*) as count
         FROM user_mistakes m
         INNER JOIN quizzes q ON m.original_quiz_id = q.id
         WHERE m.user_id = ? AND m.original_quiz_id IS NOT NULL AND m.original_quiz_id > 0
         GROUP BY m.original_quiz_id, q.title
         HAVING count > 0`,
        [uid]
      );
      return rows.map(r => ({
        quizId: Number(r.quizId),
        title: r.title,
        count: Number(r.count),
      }));
    } catch (err) {
      console.warn('[session_service] Turso getUserMistakesGrouped fallback:', err.message);
    }
  }


  const mistakes = await db
    .select()
    .from(userMistakes)
    .where(eq(userMistakes.userId, uid))
    .all();

  if (mistakes.length === 0) return [];

  // Group mistakes by originalQuizId (only valid quizzes)
  const groupsMap = new Map();
  for (const m of mistakes) {
    const qId = m.originalQuizId;
    if (!qId || qId <= 0) continue;
    if (!groupsMap.has(qId)) {
      groupsMap.set(qId, { quizId: qId, count: 0 });
    }
    groupsMap.get(qId).count += 1;
  }

  const result = [];
  for (const [quizId, data] of groupsMap.entries()) {
    try {
      const qz = await db.select().from(quizzes).where(eq(quizzes.id, quizId)).get();
      if (qz?.title) {
        result.push({
          quizId,
          title: qz.title,
          count: data.count,
        });
      }
    } catch {}
  }

  return result;
}

export async function isChatAdmin(api, chatId, userId, senderChatId = null, bypassSuperAdmin = true) {
  if (senderChatId && Number(senderChatId) === Number(chatId)) return true;
  if (Number(userId) === 1087968824) return true; // Telegram Anonymous Group Admin
  if (bypassSuperAdmin && CONFIG.ADMINS.includes(Number(userId))) return true;
  try {
    const member = await api.getChatMember({ chat_id: chatId, user_id: userId });
    return ['creator', 'administrator'].includes(member.status);
  } catch (err) {
    const errMsg = String(err?.message || err);
    if (errMsg.includes('upgraded to a supergroup') || errMsg.includes('chat not found') || errMsg.includes('kicked')) {
      try {
        await db.update(groups).set({ isActive: false }).where(eq(groups.groupId, chatId)).run();
      } catch {}
    }
    return false;
  }
}

export async function announceGroupLobby(api, { chatId, userId, quizId }) {
  const user = await db
    .select()
    .from(users)
    .where(eq(users.telegramId, userId))
    .get();
  const lang = user?.lang || 'UZ';

  const quiz = await getQuizById(quizId);
  if (!quiz || quiz.questions.length === 0) {
    return { success: false, error: getMessage('ERR_QUIZ_EMPTY', lang) };
  }

  // Cancel any existing waiting lobbies for this group
  await db
    .update(groupLobbies)
    .set({ status: 'cancelled' })
    .where(and(eq(groupLobbies.chatId, chatId), eq(groupLobbies.status, 'waiting')))
    .run();

  // Insert new lobby record
  await db
    .insert(groupLobbies)
    .values({
      chatId,
      quizId,
      ownerId: userId,
      status: 'waiting',
      readyUsersJson: '[]',
    })
    .run();

  const lobby = await db
    .select()
    .from(groupLobbies)
    .where(and(eq(groupLobbies.chatId, chatId), eq(groupLobbies.status, 'waiting')))
    .orderBy(desc(groupLobbies.id))
    .limit(1)
    .get();

  const text = getMessage('QUIZ_LOBBY_MSG', lang, {
    title: quiz.title,
    count: quiz.questions.length,
    time: quiz.timeLimit || 30,
    shuffle: quiz.shuffleOptions !== false ? getMessage('LABEL_YES', lang) : getMessage('LABEL_NO', lang),
    ready_count: 0,
  });

  const reply_markup = {
    inline_keyboard: [
      [
        {
          text: `${getMessage('BTN_I_AM_READY', lang)} (0)`,
          callback_data: `${ACTIONS.LOBBY_JOIN_PREFIX}${lobby.id}`,
        },
      ],
      [
        {
          text: getMessage('BTN_START_QUIZ', lang),
          callback_data: `${ACTIONS.LOBBY_START_PREFIX}${lobby.id}`,
        },
        {
          text: getMessage('BTN_CANCEL', lang),
          callback_data: `${ACTIONS.LOBBY_CANCEL_PREFIX}${lobby.id}`,
        },
      ],
    ],
  };

  const msg = await api.sendMessage({
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
    reply_markup,
  });

  if (msg && msg.message_id) {
    await db
      .update(groupLobbies)
      .set({ messageId: msg.message_id })
      .where(eq(groupLobbies.id, lobby.id))
      .run();
  }

  return { success: true, lobbyId: lobby.id };
}

export async function handleLobbyJoin(api, lobbyId, tgUser) {
  const lobby = await db
    .select()
    .from(groupLobbies)
    .where(eq(groupLobbies.id, lobbyId))
    .get();

  if (!lobby || lobby.status !== 'waiting') {
    return { success: false, error: 'LOBBY_NOT_ACTIVE' };
  }

  let readyUsers = [];
  try {
    readyUsers = JSON.parse(lobby.readyUsersJson);
  } catch {
    readyUsers = [];
  }

  if (readyUsers.some((u) => u.id === tgUser.id)) {
    return { success: false, alreadyReady: true };
  }

  const quiz = await getQuizById(lobby.quizId);
  const lang = 'UZ';

  const userName = [tgUser.first_name, tgUser.last_name].filter(Boolean).join(' ') || getMessage('DEFAULT_USER_NAME', lang);
  readyUsers.push({ id: tgUser.id, name: userName });

  await db
    .update(groupLobbies)
    .set({ readyUsersJson: JSON.stringify(readyUsers) })
    .where(eq(groupLobbies.id, lobbyId))
    .run();

  const text = getMessage('QUIZ_LOBBY_MSG', lang, {
    title: quiz ? quiz.title : 'Test',
    count: quiz ? quiz.questions.length : 0,
    time: quiz ? (quiz.timeLimit || 30) : 30,
    shuffle: quiz && quiz.shuffleOptions !== false ? getMessage('LABEL_YES', lang) : getMessage('LABEL_NO', lang),
    ready_count: readyUsers.length,
  });

  const reply_markup = {
    inline_keyboard: [
      [
        {
          text: `${getMessage('BTN_I_AM_READY', lang)} (${readyUsers.length})`,
          callback_data: `${ACTIONS.LOBBY_JOIN_PREFIX}${lobby.id}`,
        },
      ],
      [
        {
          text: getMessage('BTN_START_QUIZ', lang),
          callback_data: `${ACTIONS.LOBBY_START_PREFIX}${lobby.id}`,
        },
        {
          text: getMessage('BTN_CANCEL', lang),
          callback_data: `${ACTIONS.LOBBY_CANCEL_PREFIX}${lobby.id}`,
        },
      ],
    ],
  };

  if (lobby.messageId) {
    try {
      await api.editMessageText({
        chat_id: lobby.chatId,
        message_id: lobby.messageId,
        text,
        parse_mode: 'HTML',
        reply_markup,
      });
    } catch {}
  }

  return { success: true, count: readyUsers.length };
}

export async function handleLobbyStart(api, lobbyId, callerId) {
  const lobby = await db
    .select()
    .from(groupLobbies)
    .where(eq(groupLobbies.id, lobbyId))
    .get();

  if (!lobby || lobby.status !== 'waiting') {
    return { success: false, error: 'LOBBY_NOT_ACTIVE' };
  }

  const isOwner = lobby.ownerId === callerId;
  const isAdmin = await isChatAdmin(api, lobby.chatId, callerId);

  if (!isOwner && !isAdmin) {
    return { success: false, error: 'NOT_ADMIN' };
  }

  let readyUsers = [];
  try {
    readyUsers = JSON.parse(lobby.readyUsersJson);
  } catch {
    readyUsers = [];
  }

  if (readyUsers.length === 0) {
    return { success: false, error: 'NO_PLAYERS' };
  }

  await db
    .update(groupLobbies)
    .set({ status: 'starting' })
    .where(eq(groupLobbies.id, lobbyId))
    .run();

  const quiz = await getQuizById(lobby.quizId);
  const quizTitle = quiz ? quiz.title : getMessage('DEFAULT_QUIZ_TITLE', 'UZ');

  if (lobby.messageId) {
    try {
      await api.editMessageText({
        chat_id: lobby.chatId,
        message_id: lobby.messageId,
        text: getMessage('GROUP_LOBBY_STARTED', 'UZ', { title: quizTitle, count: readyUsers.length }),
        parse_mode: 'HTML',
      });
    } catch {}
  }

  // Start the actual group session
  const res = await startQuizSession(api, {
    chatId: lobby.chatId,
    userId: lobby.ownerId,
    quizId: lobby.quizId,
    isGroup: true,
    mode: ACTIONS.MODE_FULL,
  });

  await db
    .update(groupLobbies)
    .set({ status: 'finished' })
    .where(eq(groupLobbies.id, lobbyId))
    .run();

  return res;
}

export async function handleLobbyCancel(api, lobbyId, callerId) {
  const lobby = await db
    .select()
    .from(groupLobbies)
    .where(eq(groupLobbies.id, lobbyId))
    .get();

  if (!lobby || lobby.status !== 'waiting') {
    return { success: false, error: 'LOBBY_NOT_ACTIVE' };
  }

  const isOwner = lobby.ownerId === callerId;
  const isAdmin = await isChatAdmin(api, lobby.chatId, callerId);

  if (!isOwner && !isAdmin) {
    return { success: false, error: 'NOT_ADMIN' };
  }

  await db
    .update(groupLobbies)
    .set({ status: 'cancelled' })
    .where(eq(groupLobbies.id, lobbyId))
    .run();

  if (lobby.messageId) {
    try {
      await api.editMessageText({
        chat_id: lobby.chatId,
        message_id: lobby.messageId,
        text: getMessage('LOBBY_CANCELLED', 'UZ'),
        parse_mode: 'HTML',
      });
    } catch {}
  }

  return { success: true };
}

export default {
  startQuizSession,
  sendNextQuestionPoll,
  handlePollAnswer,
  advanceGroupRound,
  advanceGroupRoundByPollId,
  finishSession,
  stopSession,
  resumeQuizSession,
  saveUserMistake,
  getUserMistakesCount,
  getUserMistakesGrouped,
  clearUserMistakes,
  isChatAdmin,
  announceGroupLobby,
  handleLobbyJoin,
  handleLobbyStart,
  handleLobbyCancel,
};
