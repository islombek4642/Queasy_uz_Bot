// tgcloud/lib/constants/messages.js
// Centralized multi-language messages hub with individual locale modules

import uz from './locales/uz.js';
import ru from './locales/ru.js';
import en from './locales/en.js';

export const MESSAGES = {
  UZ: uz,
  RU: ru,
  EN: en,
};

/**
 * Helper to fetch a localized message and interpolate {placeholders}.
 */
export function getMessage(key, lang = 'UZ', params = {}) {
  const normalizedLang = typeof lang === 'string' ? lang.toUpperCase() : 'UZ';
  const selectedLang = MESSAGES[normalizedLang] ? normalizedLang : 'UZ';
  let template = MESSAGES[selectedLang]?.[key] || MESSAGES.UZ[key] || `[${key}]`;

  for (const [k, v] of Object.entries(params)) {
    template = template.replaceAll(`{${k}}`, v !== undefined && v !== null ? String(v) : '');
  }

  return template;
}

/**
 * Helper to match an incoming button text across all supported languages.
 * Useful when user switched language or still has an old reply keyboard in chat.
 */
export function isButtonMatch(inputText, key) {
  if (!inputText || !key) return false;
  return (
    inputText === MESSAGES.UZ[key] ||
    inputText === MESSAGES.RU[key] ||
    inputText === MESSAGES.EN[key]
  );
}

export default { MESSAGES, getMessage, isButtonMatch };
