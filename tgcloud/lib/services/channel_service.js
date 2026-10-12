// tgcloud/lib/services/channel_service.js
// Forced channel subscription management & verification

import { db } from 'sdk';
import { eq } from 'sdk/db';
import { requiredChannels } from '../../schema.js';

export async function getRequiredChannels() {
  return await db
    .select()
    .from(requiredChannels)
    .where(eq(requiredChannels.isActive, true))
    .all();
}

export async function addRequiredChannel({ channelId, channelUsername, title, inviteLink }) {
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
