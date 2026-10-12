// tests/test_messages_parity.mjs
import assert from 'node:assert';
import { MESSAGES, getMessage, isButtonMatch } from '../tgcloud/lib/constants/messages.js';

console.log('--- Testing MESSAGES Catalog Key Parity ---');

const uzKeys = Object.keys(MESSAGES.UZ).sort();
const ruKeys = Object.keys(MESSAGES.RU).sort();
const enKeys = Object.keys(MESSAGES.EN).sort();

console.log(`UZ keys count: ${uzKeys.length}`);
console.log(`RU keys count: ${ruKeys.length}`);
console.log(`EN keys count: ${enKeys.length}`);

const missingInRu = uzKeys.filter((k) => !(k in MESSAGES.RU));
const missingInEn = uzKeys.filter((k) => !(k in MESSAGES.EN));

if (missingInRu.length > 0) {
  console.error('Missing in RU:', missingInRu);
}

if (missingInEn.length > 0) {
  console.error('Missing in EN:', missingInEn);
}

assert.strictEqual(missingInRu.length, 0, `RU is missing ${missingInRu.length} keys`);
assert.strictEqual(missingInEn.length, 0, `EN is missing ${missingInEn.length} keys`);

// Check required new keys
const requiredNewKeys = [
  'TIME_SECONDS',
  'TIME_MINUTES',
  'BTN_CONFIRM_DELETE',
  'BTN_CANCEL_DELETE',
  'BTN_MAIN_MENU',
  'BTN_ADMIN_MENU',
  'BTN_ADD_CHANNEL',
  'BTN_CONFIRM_BROADCAST',
  'BTN_SELECT_GROUP',
  'BTN_SELECT_AND_ADD_GROUP',
  'BTN_SHARE_TO_FRIENDS',
  'BTN_SOLVE_QUIZ',
  'BTN_CONTACT_ADMIN',
  'BTN_DELETE_ACTION',
  'GROUP_NO_ACTIVE_QUIZ',
  'GROUP_CURRENT_RESULTS',
  'GROUP_LOBBY_PREPARED',
  'GROUP_LOBBY_ANNOUNCED',
  'GROUP_CHOOSE_PROMPT',
  'GROUP_NONE_ADMIN_FOUND',
  'GROUP_ADD_PROMPT',
  'ERR_BROADCAST_COMMAND',
  'ERR_BROADCAST_BUTTON',
  'PROMPT_CONFIRM_BROADCAST',
  'PROMPT_BROADCAST_INPUT',
  'ERR_ADD_CHANNEL',
  'ERR_MESSAGE_EXPIRED',
  'ADMIN_CHANNELS_LIST_TITLE',
  'ADMIN_USERS_LIST_TITLE',
  'ADMIN_GROUPS_LIST_TITLE',
  'ADMIN_NO_USERNAME',
  'FILE_PROCESSING',
  'FILE_PROCESS_ERROR',
  'MAIN_MENU_CAPTION',
  'MY_QUIZZES_TITLE',
  'LANG_CHOOSE_PROMPT',
  'LANG_CHANGED_SUCCESS',
  'PROMPT_CHANGE_TIME',
  'ALERT_TIME_CHANGED',
  'PROMPT_CONFIRM_DELETE',
  'ALERT_QUIZ_CLONED',
  'ERR_CLONE_FAILED',
  'ERR_DELETE_FAILED',
  'SHARE_BOT_TEXT',
  'SHARE_BOT_CAPTION',
  'LABEL_YES',
  'LABEL_NO',
  'DEFAULT_USER_NAME',
  'ERR_MISTAKES_EMPTY_SUBJECT',
  'ERR_QUIZ_EMPTY',
  'INLINE_QUIZ_DESC',
  'INLINE_QUIZ_BODY',
];

for (const k of requiredNewKeys) {
  assert(k in MESSAGES.UZ, `Required key ${k} missing in UZ`);
  assert(k in MESSAGES.RU, `Required key ${k} missing in RU`);
  assert(k in MESSAGES.EN, `Required key ${k} missing in EN`);
}

// Test interpolations
const interpolated = getMessage('TIME_SECONDS', 'UZ', { n: 15 });
assert.strictEqual(interpolated, '15 soniya');

// Test isButtonMatch
assert.strictEqual(isButtonMatch('📚 Mening testlarim', 'BTN_MY_QUIZZES'), true);
assert.strictEqual(isButtonMatch('📚 Мои тесты', 'BTN_MY_QUIZZES'), true);
assert.strictEqual(isButtonMatch('📚 My Quizzes', 'BTN_MY_QUIZZES'), true);
assert.strictEqual(isButtonMatch('Random string', 'BTN_MY_QUIZZES'), false);

// Test Frontend i18n Parity
console.log('--- Testing Frontend Mini App Locales Parity ---');
const feUz = (await import('../src/i18n/locales/uz.js')).default;
const feRu = (await import('../src/i18n/locales/ru.js')).default;
const feEn = (await import('../src/i18n/locales/en.js')).default;

const feUzKeys = Object.keys(feUz).sort();
const feRuKeys = Object.keys(feRu).sort();
const feEnKeys = Object.keys(feEn).sort();

console.log(`Frontend UZ: ${feUzKeys.length}, RU: ${feRuKeys.length}, EN: ${feEnKeys.length}`);
const feMissingInRu = feUzKeys.filter((k) => !(k in feRu));
const feMissingInEn = feUzKeys.filter((k) => !(k in feEn));

assert.strictEqual(feMissingInRu.length, 0, `Frontend RU is missing: ${feMissingInRu.join(', ')}`);
assert.strictEqual(feMissingInEn.length, 0, `Frontend EN is missing: ${feMissingInEn.join(', ')}`);

console.log('✅ ALL MESSAGES & FRONTEND LOCALES TESTS PASSED!');
