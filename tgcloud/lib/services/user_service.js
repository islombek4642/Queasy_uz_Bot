// tgcloud/lib/services/user_service.js
// User profile, language, blocking, and FSM state manager

import { db } from 'sdk';
import { eq, sql } from 'sdk/db';
import { users, userStates } from '../../schema.js';
import { CONFIG } from '../constants/config.js';
import { STATES } from '../constants/actions.js';
import { getMessage } from '../constants/messages.js';

export async function getOrCreateUser(tgUser) {
  if (!tgUser || !tgUser.id) return null;

  const telegramId = Number(tgUser.id);
  const existing = await db
    .select()
    .from(users)
    .where(eq(users.telegramId, telegramId))
    .get();

  if (existing) {
    if (existing.lang) {
      existing.lang = existing.lang.toUpperCase();
    }
    // Update last active
    await db
      .update(users)
      .set({
        firstName: tgUser.first_name || existing.firstName,
        lastName: tgUser.last_name || existing.lastName,
        username: tgUser.username || existing.username,
        lastActiveAt: new Date(),
      })
      .where(eq(users.telegramId, telegramId))
      .run();
    return existing;
  }

  // Detect initial lang from Telegram user settings if supported
  let initialLang = CONFIG.I18N.DEFAULT_LANG;
  if (tgUser.language_code) {
    const code = tgUser.language_code.toLowerCase().slice(0, 2);
    if (code === 'ru') initialLang = 'RU';
    else if (code === 'en') initialLang = 'EN';
  }

  // Create new user
  await db
    .insert(users)
    .values({
      telegramId,
      firstName: tgUser.first_name || getMessage('DEFAULT_USER_NAME', initialLang),
      lastName: tgUser.last_name || null,
      username: tgUser.username || null,
      lang: initialLang,
      isBlocked: false,
      lastActiveAt: new Date(),
    })
    .run();

  const created = await db
    .select()
    .from(users)
    .where(eq(users.telegramId, telegramId))
    .get();

  if (created && created.lang) {
    created.lang = created.lang.toUpperCase();
  }
  return created;
}

export async function getUser(userId) {
  if (!userId) return null;
  const user = await db
    .select()
    .from(users)
    .where(eq(users.telegramId, Number(userId)))
    .get();

  if (user && user.lang) {
    user.lang = user.lang.toUpperCase();
  }
  return user;
}

export async function setUserLanguage(userId, lang) {
  const normalized = typeof lang === 'string' ? lang.toUpperCase() : 'UZ';
  if (!CONFIG.I18N.SUPPORTED.includes(normalized)) return;
  await db
    .update(users)
    .set({ lang: normalized })
    .where(eq(users.telegramId, Number(userId)))
    .run();
}

export async function getUserState(userId) {
  const row = await db
    .select()
    .from(userStates)
    .where(eq(userStates.userId, userId))
    .get();

  if (!row) {
    return { state: STATES.IDLE, data: {} };
  }

  let data = {};
  if (row.contextDataJson) {
    try {
      data = JSON.parse(row.contextDataJson);
    } catch {
      data = {};
    }
  }

  return { state: row.state, data };
}

export async function setUserState(userId, state, data = {}) {
  const contextDataJson = JSON.stringify(data);
  const existing = await db
    .select()
    .from(userStates)
    .where(eq(userStates.userId, userId))
    .get();

  if (existing) {
    await db
      .update(userStates)
      .set({
        state,
        contextDataJson,
        updatedAt: new Date(),
      })
      .where(eq(userStates.userId, userId))
      .run();
  } else {
    await db
      .insert(userStates)
      .values({
        userId,
        state,
        contextDataJson,
      })
      .run();
  }
}

export async function clearUserState(userId) {
  await setUserState(userId, STATES.IDLE, {});
}

export async function isUserBlocked(userId) {
  const user = await getUser(userId);
  return Boolean(user && user.isBlocked);
}

export default {
  getOrCreateUser,
  getUser,
  setUserLanguage,
  getUserState,
  setUserState,
  clearUserState,
  isUserBlocked,
};
