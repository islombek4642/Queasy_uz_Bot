// tgcloud/endpoints/upload_media_batch.js
import { api } from 'sdk';
import { isUserAdmin, getMediaChannel } from '../lib/services/admin_service.js';

export default async function (input, ctx) {
  const callerId = ctx?.initData?.user?.id;
  if (!callerId || !isUserAdmin(callerId)) {
    return { success: false, error: 'UNAUTHORIZED_ADMIN_ONLY' };
  }

  const urls = Array.isArray(input?.urls) ? input.urls : [];
  const mediaChannel = await getMediaChannel();
  const channelId = mediaChannel?.channelId || '-1004332354841';
  const results = {};

  for (const url of urls) {
    try {
      const sent = await api.sendPhoto({
        chat_id: channelId,
        photo: url,
      });
      const fileId = sent?.photo?.[sent.photo.length - 1]?.file_id;
      results[url] = fileId || null;
    } catch (err) {
      console.error(`Failed to upload ${url}:`, err.message);
      results[url] = null;
    }
  }

  return { success: true, results };
}
