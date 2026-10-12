// tgcloud/lib/utils/poll_helpers.js
// Truncation and formatting helpers for Telegram Poll API limits

/**
 * Truncates question text to fit within Telegram limit (300 chars)
 * Appends '...?' if question ends with '?' otherwise '...'
 */
export function truncateQuestion(prefix, text, max = 300) {
  const cleanPrefix = prefix ? String(prefix).trim() : '';
  const cleanText = text ? String(text).trim() : '';
  const full = cleanPrefix ? `${cleanPrefix} ${cleanText}` : cleanText;

  if (full.length <= max) {
    return full;
  }

  const isQuestion = cleanText.endsWith('?');
  const suffix = isQuestion ? '...?' : '...';
  const cutLen = Math.max(0, max - suffix.length);
  return `${full.slice(0, cutLen).trim()}${suffix}`;
}

/**
 * Truncates an option string to fit within Telegram limit (100 chars)
 */
export function truncateOption(opt, max = 100) {
  const str = String(opt || '').trim();
  if (str.length <= max) {
    return str;
  }
  return `${str.slice(0, max - 3).trim()}...`;
}

/**
 * Truncates explanation (bulb text) to fit within Telegram limit (200 chars)
 */
export function truncateExplanation(exp, max = 200) {
  if (!exp) return undefined;
  const str = String(exp).trim();
  if (!str) return undefined;
  if (str.length <= max) {
    return str;
  }
  return `${str.slice(0, max - 3).trim()}...`;
}

/**
 * Escapes HTML special characters for safe Telegram HTML parsing
 */
export function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Formats participant name with clickable Telegram profile link and handle
 */
export function formatParticipantName(rawName, userId = null, username = null) {
  let nameStr = rawName ? String(rawName).trim() : 'Foydalanuvchi';
  let cleanUser = username ? String(username).replace(/^@/, '').trim() : '';

  // If rawName contains (@username), extract clean username
  const handleMatch = nameStr.match(/\(@([a-zA-Z0-9_]+)\)/);
  if (handleMatch) {
    if (!cleanUser) cleanUser = handleMatch[1];
    nameStr = nameStr.replace(/\(@[a-zA-Z0-9_]+\)/, '').trim();
  }

  const cleanName = escapeHtml(nameStr || 'Foydalanuvchi');
  const profileUrl = cleanUser ? `https://t.me/${cleanUser}` : (userId ? `tg://user?id=${userId}` : '');
  const nameLink = profileUrl ? `<a href="${profileUrl}">${cleanName}</a>` : cleanName;
  const userTag = cleanUser ? ` (@${escapeHtml(cleanUser)})` : '';

  return `${nameLink}${userTag}`;
}
