// tgcloud/lib/services/admin_service.js
// Admin analytics, broadcast dispatcher, and user management

import { db } from 'sdk';
import { eq, desc, sql, and } from 'sdk/db';
import { users, quizzes, quizSessions, botSettings } from '../../schema.js';
import { getGroupsCount } from './group_service.js';
import { CONFIG } from '../constants/config.js';
import turso from '../turso_client.js';

export function isUserAdmin(userId) {
  if (!userId) return false;
  return CONFIG.ADMINS.includes(Number(userId));
}


export async function cleanupStaleSessions(timeoutSeconds = 300) {
  try {
    const cutoff = Math.floor(Date.now() / 1000) - timeoutSeconds;
    if (CONFIG.TURSO?.ENABLED) {
      try {
        await turso.run(
          'UPDATE quiz_sessions SET is_active = 0 WHERE is_active = 1 AND ((last_poll_sent_at IS NOT NULL AND last_poll_sent_at < ?) OR (last_poll_sent_at IS NULL AND started_at < ?))',
          [cutoff, cutoff]
        );
      } catch (err) {
        console.warn('[admin_service] Turso cleanupStaleSessions error:', err.message);
      }
    }
    await db
      .update(quizSessions)
      .set({ isActive: false })
      .where(
        and(
          eq(quizSessions.isActive, true),
          sql`(${quizSessions.lastPollSentAt} IS NOT NULL AND ${quizSessions.lastPollSentAt} < ${cutoff})`
        )
      )
      .run();
  } catch (err) {
    console.error('Error cleaning up stale sessions:', err);
  }
}

export async function getBotStatistics() {
  await cleanupStaleSessions(300);

  if (CONFIG.TURSO?.ENABLED) {
    try {
      const [
        usersRow,
        todayRow,
        activeGroups,
        quizzesRow,
        sessionsRow,
        botPrivateRow,
        botGroupRow,
        webappSoloRow,
        webappLiveRow,
      ] = await Promise.all([
        turso.get('SELECT count(*) as count FROM users'),
        turso.get("SELECT count(*) as count FROM users WHERE created_at >= unixepoch('now', '+5 hours', 'start of day', '-5 hours')"),
        getGroupsCount(),
        turso.get('SELECT count(*) as count FROM quizzes'),
        turso.get('SELECT count(*) as count FROM quiz_sessions'),
        turso.get('SELECT count(*) as count FROM quiz_sessions WHERE is_active = 1 AND is_group = 0 AND chat_id > 0'),
        turso.get('SELECT count(*) as count FROM quiz_sessions WHERE is_active = 1 AND (is_group = 1 OR chat_id < 0)'),
        turso.get('SELECT count(*) as count FROM quiz_sessions WHERE is_active = 1 AND chat_id = 0'),
        turso.get("SELECT count(*) as count FROM live_rooms WHERE status = 'in_progress' AND created_at > unixepoch() - 7200"),
      ]);

      const botPrivate = Number(botPrivateRow?.count || 0);
      const botGroup = Number(botGroupRow?.count || 0);
      const webappSolo = Number(webappSoloRow?.count || 0);
      const webappLive = Number(webappLiveRow?.count || 0);
      const activeTotal = botPrivate + botGroup + webappSolo + webappLive;

      return {
        totalUsers: Number(usersRow?.count || 0),
        todayUsers: Number(todayRow?.count || 0),
        activeGroups: Number(activeGroups || 0),
        totalQuizzes: Number(quizzesRow?.count || 0),
        totalSessions: Number(sessionsRow?.count || 0),
        activeTotalSessions: activeTotal,
        botPrivateSessions: botPrivate,
        botGroupSessions: botGroup,
        webappSoloSessions: webappSolo,
        webappLiveSessions: webappLive,
        activeGroupSessions: botGroup,
        activePrivateSessions: botPrivate,
      };
    } catch (err) {
      console.warn('[admin_service] Turso getBotStatistics fallback to local db:', err.message);
    }
  }

  const [
    totalUsers,
    todayUsers,
    activeGroups,
    totalQuizzes,
    totalSessions,
    botPrivateSessions,
    botGroupSessions,
    webappSoloSessions,
  ] = await Promise.all([
    db.$count(users),
    db.$count(users, sql`${users.createdAt} >= unixepoch('now', '+5 hours', 'start of day', '-5 hours')`),
    getGroupsCount(),
    db.$count(quizzes),
    db.$count(quizSessions),
    db.$count(quizSessions, and(eq(quizSessions.isActive, true), eq(quizSessions.isGroup, false), sql`${quizSessions.chatId} > 0`)),
    db.$count(quizSessions, and(eq(quizSessions.isActive, true), sql`(${quizSessions.isGroup} = 1 OR ${quizSessions.chatId} < 0)`)),
    db.$count(quizSessions, and(eq(quizSessions.isActive, true), eq(quizSessions.chatId, 0))),
  ]);

  const webappLiveSessions = 0;
  const activeTotalSessions = botPrivateSessions + botGroupSessions + webappSoloSessions + webappLiveSessions;

  return {
    totalUsers,
    todayUsers,
    activeGroups,
    totalQuizzes,
    totalSessions,
    activeTotalSessions,
    botPrivateSessions,
    botGroupSessions,
    webappSoloSessions,
    webappLiveSessions,
    activeGroupSessions: botGroupSessions,
    activePrivateSessions: botPrivateSessions,
  };
}

export async function listUsers(page = 0, pageSize = CONFIG.PAGINATION.USERS) {
  const offset = Math.max(0, page * pageSize);

  if (CONFIG.TURSO?.ENABLED) {
    try {
      const list = await turso.all(
        'SELECT telegram_id as telegramId, first_name as firstName, last_name as lastName, username, created_at as createdAt FROM users ORDER BY created_at DESC, telegram_id DESC LIMIT ? OFFSET ?',
        [pageSize, offset]
      );
      return list || [];
    } catch (err) {
      console.warn('[admin_service] Turso listUsers fallback to local db:', err.message);
    }
  }

  return await db
    .select({
      telegramId: users.telegramId,
      firstName: users.firstName,
      lastName: users.lastName,
      username: users.username,
      createdAt: users.createdAt,
    })
    .from(users)
    .orderBy(desc(users.createdAt), desc(users.telegramId))
    .limit(pageSize)
    .offset(offset)
    .all();
}

export async function getUsersCount() {
  if (CONFIG.TURSO?.ENABLED) {
    try {
      const row = await turso.get('SELECT count(*) as count FROM users');
      return Number(row?.count || 0);
    } catch (err) {
      console.warn('[admin_service] Turso getUsersCount fallback to local db:', err.message);
    }
  }

  return await db.$count(users);
}

export async function setUserBlocked(userId, isBlocked = true) {
  const uid = Number(userId);

  if (CONFIG.TURSO?.ENABLED) {
    try {
      await turso.run('UPDATE users SET is_blocked = ? WHERE telegram_id = ?', [isBlocked ? 1 : 0, uid]);
      return;
    } catch (err) {
      console.warn('[admin_service] Turso setUserBlocked fallback to local db:', err.message);
    }
  }

  await db
    .update(users)
    .set({ isBlocked })
    .where(eq(users.telegramId, uid))
    .run();
}


export async function broadcastMessage(api, payload) {
  let allUsers = [];

  if (CONFIG.TURSO?.ENABLED) {
    try {
      allUsers = await turso.all('SELECT DISTINCT telegram_id as id FROM users WHERE is_blocked = 0 AND telegram_id > 1000');
    } catch (err) {
      console.warn('[admin_service] Turso broadcastMessage fallback to local db:', err.message);
      allUsers = [];
    }
  }

  if (!allUsers || allUsers.length === 0) {
    allUsers = await db
      .select({ id: users.telegramId })
      .from(users)
      .where(eq(users.isBlocked, false))
      .all();
  }

  let success = 0;
  let fail = 0;
  const isCopy = typeof payload === 'object' && payload.fromChatId && payload.messageId;

  // Process in concurrent batches of 10 for ultra-fast and reliable delivery within webhook timeout
  const BATCH_SIZE = 10;
  for (let i = 0; i < allUsers.length; i += BATCH_SIZE) {
    const chunk = allUsers.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      chunk.map(async (u) => {
        try {
          if (isCopy) {
            await api.copyMessage({
              chat_id: u.id,
              from_chat_id: payload.fromChatId,
              message_id: payload.messageId,
            });
          } else {
            await api.sendMessage({
              chat_id: u.id,
              text: String(payload),
              parse_mode: 'HTML',
            });
          }
          return { ok: true, id: u.id };
        } catch (err) {
          const errMsg = String(err?.message || err);
          if (err?.code === 403 || errMsg.includes('blocked') || errMsg.includes('deactivated')) {
            try {
              await setUserBlocked(u.id, true);
            } catch {}
          }
          return { ok: false, id: u.id, error: errMsg };
        }
      })
    );

    for (const res of results) {
      if (res.status === 'fulfilled' && res.value.ok) {
        success++;
      } else {
        fail++;
      }
    }
  }

  return { success, fail, total: allUsers.length };
}

export async function getMediaChannel() {
  if (CONFIG.TURSO?.ENABLED) {
    try {
      const idRow = await turso.get('SELECT value FROM bot_settings WHERE key = ?', ['media_channel_id']);
      const titleRow = await turso.get('SELECT value FROM bot_settings WHERE key = ?', ['media_channel_title']);
      if (!idRow || !idRow.value || idRow.value === '[object Object]') return null;
      return {
        channelId: idRow.value,
        title: titleRow && titleRow.value !== '[object Object]' ? titleRow.value : '',
      };
    } catch (err) {
      console.warn('[admin_service] Turso getMediaChannel fallback to local db:', err.message);
    }
  }

  try {
    const idRow = await db.select().from(botSettings).where(eq(botSettings.key, 'media_channel_id')).get();
    const titleRow = await db.select().from(botSettings).where(eq(botSettings.key, 'media_channel_title')).get();
    if (!idRow || !idRow.value || idRow.value === '[object Object]') return null;
    return {
      channelId: idRow.value,
      title: titleRow && titleRow.value !== '[object Object]' ? titleRow.value : '',
    };
  } catch (err) {
    console.error('Error fetching media channel setting:', err);
    return null;
  }
}

export async function setMediaChannel(channelIdOrObj, titleParam = '') {
  let channelId = channelIdOrObj;
  let title = titleParam;

  if (typeof channelIdOrObj === 'object' && channelIdOrObj !== null) {
    channelId = channelIdOrObj.channelId || channelIdOrObj.id;
    title = channelIdOrObj.title || '';
  }

  if (CONFIG.TURSO?.ENABLED) {
    try {
      await turso.run(
        'INSERT OR REPLACE INTO bot_settings (key, value, updated_at) VALUES (?, ?, unixepoch())',
        ['media_channel_id', String(channelId)]
      );
      await turso.run(
        'INSERT OR REPLACE INTO bot_settings (key, value, updated_at) VALUES (?, ?, unixepoch())',
        ['media_channel_title', String(title || '')]
      );
      return true;
    } catch (err) {
      console.warn('[admin_service] Turso setMediaChannel fallback to local db:', err.message);
    }
  }

  try {
    await db
      .insert(botSettings)
      .values({ key: 'media_channel_id', value: String(channelId) })
      .onConflictDoUpdate({
        target: botSettings.key,
        set: { value: String(channelId) },
      })
      .run();

    await db
      .insert(botSettings)
      .values({ key: 'media_channel_title', value: String(title || '') })
      .onConflictDoUpdate({
        target: botSettings.key,
        set: { value: String(title || '') },
      })
      .run();

    return true;
  } catch (err) {
    console.error('Error setting media channel setting:', err);
    return false;
  }
}

export async function removeMediaChannel() {
  if (CONFIG.TURSO?.ENABLED) {
    try {
      await turso.run('DELETE FROM bot_settings WHERE key = ?', ['media_channel_id']);
      await turso.run('DELETE FROM bot_settings WHERE key = ?', ['media_channel_title']);
      return true;
    } catch (err) {
      console.warn('[admin_service] Turso removeMediaChannel fallback to local db:', err.message);
    }
  }

  try {
    await db.delete(botSettings).where(eq(botSettings.key, 'media_channel_id')).run();
    await db.delete(botSettings).where(eq(botSettings.key, 'media_channel_title')).run();
    return true;
  } catch (err) {
    console.error('Error removing media channel setting:', err);
    return false;
  }
}

export default {
  isUserAdmin,
  cleanupStaleSessions,
  getBotStatistics,
  listUsers,
  getUsersCount,
  setUserBlocked,
  broadcastMessage,
  getMediaChannel,
  setMediaChannel,
  removeMediaChannel,
};
