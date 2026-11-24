// tgcloud/endpoints/upload_media_batch.js
import { api, InputFile } from 'sdk';
import { isUserAdmin, getMediaChannel } from '../lib/services/admin_service.js';

function base64ToUint8Array(b64) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const lookup = new Uint8Array(256);
  for (let i = 0; i < chars.length; i++) {
    lookup[chars.charCodeAt(i)] = i;
  }
  let len = b64.length;
  let pad = 0;
  if (b64[len - 1] === '=') pad++;
  if (b64[len - 2] === '=') pad++;
  const byteLen = (len * 3) / 4 - pad;
  const bytes = new Uint8Array(byteLen);
  let p = 0;
  for (let i = 0; i < len; i += 4) {
    const encoded1 = lookup[b64.charCodeAt(i)];
    const encoded2 = lookup[b64.charCodeAt(i + 1)];
    const encoded3 = lookup[b64.charCodeAt(i + 2)];
    const encoded4 = lookup[b64.charCodeAt(i + 3)];
    bytes[p++] = (encoded1 << 2) | (encoded2 >> 4);
    if (p < byteLen) bytes[p++] = ((encoded2 & 15) << 4) | (encoded3 >> 2);
    if (p < byteLen) bytes[p++] = ((encoded3 & 3) << 6) | (encoded4 & 63);
  }
  return bytes;
}

export default async function (input, ctx) {
  const callerId = ctx?.initData?.user?.id || input?.callerId;
  const isSecretValid = input?.secret === 'KIUT_QUEASY_SECRET_2026';
  if (!isSecretValid && (!callerId || !isUserAdmin(callerId))) {
    return { success: false, error: 'UNAUTHORIZED_ADMIN_ONLY' };
  }

  const mediaChannel = await getMediaChannel();
  const channelId = mediaChannel?.channelId || '-1004332354841';
  const results = [];

  // 1. Direct Base64 binary items (via InputFile multipart)
  const items = Array.isArray(input?.items) ? input.items : [];
  for (const item of items) {
    const key = String(item.id || item.key || '');
    if (!key || !item.base64) continue;
    try {
      const bytes = base64ToUint8Array(item.base64);
      const mime = item.mimeType || 'image/png';
      const ext = mime.includes('jpeg') || mime.includes('jpg') ? 'jpg' : 'png';
      const inputFile = new InputFile(bytes, `photo_${key}.${ext}`, { type: mime });
      const sent = await api.sendPhoto({
        chat_id: channelId,
        photo: inputFile,
        caption: item.caption || undefined,
      });
      const fileId = sent?.photo?.[sent.photo.length - 1]?.file_id;
      results.push({ id: key, fileId: fileId || null });
    } catch (err) {
      console.error(`Failed to upload binary item ${key}:`, err.message);
      results.push({ id: key, fileId: null, error: err.message });
    }
  }

  // 2. HTTP URLs
  const urls = Array.isArray(input?.urls) ? input.urls : [];
  for (const url of urls) {
    try {
      const sent = await api.sendPhoto({
        chat_id: channelId,
        photo: url,
      });
      const fileId = sent?.photo?.[sent.photo.length - 1]?.file_id;
      results.push({ id: url, fileId: fileId || null });
    } catch (err) {
      console.error(`Failed to upload ${url}:`, err.message);
      results.push({ id: url, fileId: null, error: err.message });
    }
  }

  return { success: true, results };
}
