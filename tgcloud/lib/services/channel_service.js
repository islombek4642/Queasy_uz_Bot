// tgcloud/lib/services/channel_service.js
// Forced channel subscription management & verification

import { db } from 'sdk';
import { eq } from 'sdk/db';
import { requiredChannels } from '../../schema.js';
import { CONFIG } from '../constants/config.js';
import turso from '../turso_client.js';

export async function getRequiredChannels() {
  if (CONFIG.TURSO?.ENABLED) {
    try {
      const rows = await turso.all('SELECT * FROM required_channels WHERE is_active = 1');
      return (rows || []).map(r => ({
        id: r.id,
        channelId: r.channel_id,
        channelUsername: r.channel_username,
        title: r.title,
        inviteLink: r.invite_link,
        isActive: Boolean(r.is_active),
      }));
    } catch (err) {
      console.warn('[channel_service] Turso fallback to local db:', err.message);
    }
  }

  return await db
    .select()
    .from(requiredChannels)
    .where(eq(requiredChannels.isActive, true))
    .all();
}

export async function addRequiredChannel({ channelId, channelUsername, title, inviteLink }) {
  if (CONFIG.TURSO?.ENABLED) {
    try {
      await turso.run(
        'INSERT INTO required_channels (channel_id, channel_username, title, invite_link, is_active, created_at) VALUES (?, ?, ?, ?, 1, unixepoch())',
        [channelId, channelUsername || null, title || 'Kanal', inviteLink || `https://t.me/${channelUsername.replace('@', '')}`]
      );
      return;
    } catch (err) {
      console.warn('[channel_service] Turso addRequiredChannel fallback to local db:', err.message);
    }
  }

  await db
    .insert(requiredChannels)
    .values({
      channelId,
      channelUsername: channelUsername || null,
      title: title || 'Kanal',
      inviteLink: inviteLink || `https://t.me/${channelUsername.replace('@', '')}`,
      isActive: true,
    })
    .run();
}

export async function deleteRequiredChannel(id) {
  if (CONFIG.TURSO?.ENABLED) {
    try {
      await turso.run('DELETE FROM required_channels WHERE id = ?', [Number(id)]);
      return;
    } catch (err) {
      console.warn('[channel_service] Turso deleteRequiredChannel fallback to local db:', err.message);
    }
  }

  await db
    .delete(requiredChannels)
    .where(eq(requiredChannels.id, id))
    .run();
}

export async function checkUserSubscribed(api, userId) {
  const channels = await getRequiredChannels();
  if (channels.length === 0) {
    return { isSubscribed: true, missingChannels: [] };
  }

  const missing = [];
  const allowedStatuses = ['creator', 'administrator', 'member'];

  for (const ch of channels) {
    try {
      const member = await api.getChatMember({
        chat_id: ch.channelId,
        user_id: userId,
      });

      if (!member || !allowedStatuses.includes(member.status)) {
        missing.push(ch);
      }
    } catch {
      // If bot cannot verify or user not found, treat as missing
      missing.push(ch);
    }
  }

  return {
    isSubscribed: missing.length === 0,
    missingChannels: missing,
  };
}

export default {
  getRequiredChannels,
  addRequiredChannel,
  deleteRequiredChannel,
  checkUserSubscribed,
};
