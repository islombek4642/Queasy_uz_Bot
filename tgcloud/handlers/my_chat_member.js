// tgcloud/handlers/my_chat_member.js
// Handles bot addition, promotion, or removal in groups and supergroups

import { db } from 'sdk';
import { eq } from 'sdk/db';
import { groups } from '../schema.js';
import { upsertGroup, deactivateGroup } from '../lib/services/group_service.js';

export default async function (myChatMember, ctx) {
  if (!myChatMember || !myChatMember.chat) return;

  const chat = myChatMember.chat;
  const isGroup = ['group', 'supergroup'].includes(chat.type);
  if (!isGroup) return;

  const newStatus = myChatMember.new_chat_member?.status;

  if (['member', 'administrator', 'creator'].includes(newStatus)) {
    // Record group in database silently with the user who added/promoted the bot
    const addedBy = myChatMember.from?.id || null;
    await upsertGroup(chat.id, chat.title || 'Guruh', chat.username || null, addedBy);
  } else if (['left', 'kicked'].includes(newStatus)) {
    // Bot removed from group
    await deactivateGroup(chat.id);
  }
}
