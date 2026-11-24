// tgcloud/endpoints/get_media.js
import { api } from 'sdk';

function bytesToBase64(bytes) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let result = '';
  const len = bytes.length;
  for (let i = 0; i < len; i += 3) {
    const b0 = bytes[i];
    const b1 = i + 1 < len ? bytes[i + 1] : 0;
    const b2 = i + 2 < len ? bytes[i + 2] : 0;
    result += chars[b0 >> 2];
    result += chars[((b0 & 3) << 4) | (b1 >> 4)];
    result += i + 1 < len ? chars[((b1 & 15) << 2) | (b2 >> 6)] : '=';
    result += i + 2 < len ? chars[b2 & 63] : '=';
  }
  return result;
}

export default async function (input) {
  const fileId = input?.fileId;
  if (!fileId || typeof fileId !== 'string') {
    return { success: false, error: 'MISSING_FILE_ID' };
  }

  // If already a data URL or HTTP URL, return as-is
  if (fileId.startsWith('data:') || fileId.startsWith('http://') || fileId.startsWith('https://')) {
    return { success: true, dataUrl: fileId };
  }

  try {
    const bytes = await api.getFileContent(fileId);
    if (!bytes || bytes.length === 0) {
      return { success: false, error: 'EMPTY_FILE_CONTENT' };
    }

    // Sniff MIME type
    let mime = 'image/jpeg';
    if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
      mime = 'image/png';
    } else if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
      mime = 'image/jpeg';
    } else if (bytes.length >= 6 && (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46)) {
      mime = 'image/gif';
    } else if (bytes.length >= 4 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) {
      mime = 'image/webp';
    }

    const b64 = bytesToBase64(bytes);
    return { success: true, dataUrl: `data:${mime};base64,${b64}` };
  } catch (err) {
    console.error(`[get_media] Error fetching file_id ${fileId}:`, err.message);
    return { success: false, error: err.message };
  }
}

