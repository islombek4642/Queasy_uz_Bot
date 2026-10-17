// tgcloud/lib/services/user_service.js
// User profile, language, blocking, and FSM state manager

import { db } from 'sdk';
import { eq, sql } from 'sdk/db';
import { users, userStates } from '../../schema.js';
import { CONFIG } from '../constants/config.js';
import { STATES } from '../constants/actions.js';
import { getMessage } from '../constants/messages.js';
import turso from '../turso_client.js';

function mapUserRow(r) {
  if (!r) return null;
  return {
    telegramId: r.telegram_id !== undefined ? Number(r.telegram_id) : (r.telegramId ? Number(r.telegramId) : 0),
    firstName: r.first_name || r.firstName || '',
    lastName: r.last_name !== undefined ? r.last_name : r.lastName,
    username: r.username,
    lang: (r.lang || 'UZ').toUpperCase(),
    isBlocked: Boolean(r.is_blocked || r.isBlocked),
    createdAt: r.created_at || r.createdAt,
    lastActiveAt: r.last_active_at || r.lastActiveAt,
  };
}

export async function getOrCreateUser(tgUser) {
  if (!tgUser || !tgUser.id) return null;

  const telegramId = Number(tgUser.id);

  if (CONFIG.TURSO?.ENABLED) {
    try {
      const existing = await turso.get('SELECT * FROM users WHERE telegram_id = ?', [telegramId]);
      if (existing) {
        await turso.run(
          'UPDATE users SET first_name = ?, last_name = ?, username = ?, last_active_at = unixepoch() WHERE telegram_id = ?',
          [tgUser.first_name || existing.first_name, tgUser.last_name || existing.last_name, tgUser.username || existing.username, telegramId]
        );
        return mapUserRow(existing);
      }

      let initialLang = CONFIG.I18N.DEFAULT_LANG;
      if (tgUser.language_code) {
        const code = tgUser.language_code.toLowerCase().slice(0, 2);
        if (code === 'ru') initialLang = 'RU';
        else if (code === 'en') initialLang = 'EN';
      }

      await turso.run(
        'INSERT INTO users (telegram_id, first_name, last_name, username, lang, is_blocked, created_at, last_active_at) VALUES (?, ?, ?, ?, ?, 0, unixepoch(), unixepoch())',
        [telegramId, tgUser.first_name || getMessage('DEFAULT_USER_NAME', initialLang), tgUser.last_name || null, tgUser.username || null, initialLang]
      );

      const created = await turso.get('SELECT * FROM users WHERE telegram_id = ?', [telegramId]);
      return mapUserRow(created);
    } catch (err) {
      console.warn('[user_service] Turso getOrCreateUser fallback to local db:', err.message);
    }
  }

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
  const telegramId = Number(userId);

  if (CONFIG.TURSO?.ENABLED) {
    try {
      const user = await turso.get('SELECT * FROM users WHERE telegram_id = ?', [telegramId]);
      return mapUserRow(user);
    } catch (err) {
      console.warn('[user_service] Turso getUser fallback to local db:', err.message);
    }
  }

  const user = await db
    .select()
    .from(users)
    .where(eq(users.telegramId, telegramId))
    .get();

  if (user && user.lang) {
    user.lang = user.lang.toUpperCase();
  }
  return user;
}

export async function setUserLanguage(userId, lang) {
  const normalized = typeof lang === 'string' ? lang.toUpperCase() : 'UZ';
  if (!CONFIG.I18N.SUPPORTED.includes(normalized)) return;
  const telegramId = Number(userId);

  if (CONFIG.TURSO?.ENABLED) {
    try {
      await turso.run('UPDATE users SET lang = ? WHERE telegram_id = ?', [normalized, telegramId]);
      return;
    } catch (err) {
      console.warn('[user_service] Turso setUserLanguage fallback to local db:', err.message);
    }
  }

  await db
    .update(users)
    .set({ lang: normalized })
    .where(eq(users.telegramId, telegramId))
    .run();
}

export async function getUserState(userId) {
  const uid = Number(userId);

  if (CONFIG.TURSO?.ENABLED) {
    try {
      const row = await turso.get('SELECT state, context_data_json as contextDataJson FROM user_states WHERE user_id = ?', [uid]);
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
    } catch (err) {
      console.warn('[user_service] Turso getUserState fallback to local db:', err.message);
    }
  }

  const row = await db
    .select()
    .from(userStates)
    .where(eq(userStates.userId, uid))
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
  const uid = Number(userId);
  const contextDataJson = JSON.stringify(data);

  if (CONFIG.TURSO?.ENABLED) {
    try {
      await turso.run(
        'INSERT OR REPLACE INTO user_states (user_id, state, context_data_json, updated_at) VALUES (?, ?, ?, unixepoch())',
        [uid, state, contextDataJson]
      );
      return;
    } catch (err) {
      console.warn('[user_service] Turso setUserState fallback to local db:', err.message);
    }
  }

  const existing = await db
    .select()
    .from(userStates)
    .where(eq(userStates.userId, uid))
    .get();

  if (existing) {
    await db
      .update(userStates)
      .set({
        state,
        contextDataJson,
        updatedAt: new Date(),
      })
      .where(eq(userStates.userId, uid))
      .run();
  } else {
    await db
      .insert(userStates)
      .values({
        userId: uid,
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
