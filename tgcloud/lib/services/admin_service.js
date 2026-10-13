// tgcloud/lib/services/admin_service.js
// Admin analytics, broadcast dispatcher, and user management

import { db } from 'sdk';
import { eq, desc, sql, and } from 'sdk/db';
import { users, quizzes, quizSessions, botSettings } from '../../schema.js';
import { getGroupsCount } from './group_service.js';
import { CONFIG } from '../constants/config.js';

export function isUserAdmin(userId) {
  if (!userId) return false;
  return CONFIG.ADMINS.includes(Number(userId));
}

export async function cleanupStaleSessions(timeoutSeconds = 300) {
  try {
    const cutoff = Math.floor(Date.now() / 1000) - timeoutSeconds;
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

  const oneDayAgoSec = Math.floor(Date.now() / 1000) - 86400;

  const [
    totalUsers,
    todayUsers,
    activeGroups,
    totalQuizzes,
    totalSessions,
    activeTotalSessions,
    activeGroupSessions,
    activePrivateSessions,
  ] = await Promise.all([
    db.$count(users),
    db.$count(users, sql`${users.createdAt} >= ${oneDayAgoSec}`),
    getGroupsCount(),
    db.$count(quizzes),
    db.$count(quizSessions),
    db.$count(quizSessions, eq(quizSessions.isActive, true)),
    db.$count(quizSessions, and(eq(quizSessions.isActive, true), eq(quizSessions.isGroup, true))),
    db.$count(quizSessions, and(eq(quizSessions.isActive, true), eq(quizSessions.isGroup, false))),
  ]);

  return {
    totalUsers,
    todayUsers,
    activeGroups,
    totalQuizzes,
    totalSessions,
    activeTotalSessions,
    activeGroupSessions,
    activePrivateSessions,
  };
}

export async function listUsers(page = 0, pageSize = CONFIG.PAGINATION.USERS) {
  const offset = Math.max(0, page * pageSize);
  return await db
    .select({
      telegramId: users.telegramId,
      firstName: users.firstName,
      lastName: users.lastName,
      username: users.username,
      createdAt: users.createdAt,
    })
    .from(users)
    .orderBy(desc(users.createdAt))
    .limit(pageSize)
    .offset(offset)
    .all();
}

export async function getUsersCount() {
  return await db.$count(users);
}

export async function setUserBlocked(userId, isBlocked = true) {
  await db
    .update(users)
    .set({ isBlocked })
    .where(eq(users.telegramId, userId))
    .run();
}

export async function broadcastMessage(api, payload) {
  const allUsers = await db
    .select({ id: users.telegramId })
    .from(users)
    .where(eq(users.isBlocked, false))
    .all();

  let success = 0;
  let fail = 0;

  for (const u of allUsers) {
    try {
      if (typeof payload === 'object' && payload.fromChatId && payload.messageId) {
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
      success++;
    } catch (err) {
      fail++;
      const errMsg = String(err?.message || err);
      if (err?.code === 403 || errMsg.includes('blocked') || errMsg.includes('deactivated')) {
        try {
          await setUserBlocked(u.id, true);
        } catch {}
      }
    }
  }

  return { success, fail, total: allUsers.length };
}

export async function getMediaChannel() {
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
  try {
    let channelId = channelIdOrObj;
    let title = titleParam;

    if (typeof channelIdOrObj === 'object' && channelIdOrObj !== null) {
      channelId = channelIdOrObj.channelId || channelIdOrObj.id;
      title = channelIdOrObj.title || '';
    }

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
