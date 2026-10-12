// tests/test_keyboards_i18n.mjs
import assert from 'node:assert';
import { getTimeLimitKeyboard, getConfirmDeleteKeyboard } from '../tgcloud/lib/keyboards/quiz_keyboard.js';
import { getAdminChannelsKeyboard, getAdminConfirmBroadcastKeyboard } from '../tgcloud/lib/keyboards/admin_keyboard.js';
import { getLanguageKeyboard } from '../tgcloud/lib/keyboards/subscribe_keyboard.js';

console.log('--- Testing Keyboards i18n & Zero-Hardcode ---');

// 1. getTimeLimitKeyboard
const timeKbdUz = getTimeLimitKeyboard(1, 'UZ');
const timeKbdRu = getTimeLimitKeyboard(1, 'RU');
const timeKbdEn = getTimeLimitKeyboard(1, 'EN');

assert.strictEqual(timeKbdUz.inline_keyboard[0][0].text, '10 soniya');
assert.strictEqual(timeKbdRu.inline_keyboard[0][0].text, '10 сек');
assert.strictEqual(timeKbdEn.inline_keyboard[0][0].text, '10 sec');

assert.strictEqual(timeKbdUz.inline_keyboard[1][1].text, '1 daqiqa');
assert.strictEqual(timeKbdRu.inline_keyboard[1][1].text, '1 мин');
assert.strictEqual(timeKbdEn.inline_keyboard[1][1].text, '1 min');

assert.strictEqual(timeKbdUz.inline_keyboard[2][0].text, '⬅️ Orqaga');
assert.strictEqual(timeKbdRu.inline_keyboard[2][0].text, '⬅️ Назад');
assert.strictEqual(timeKbdEn.inline_keyboard[2][0].text, '⬅️ Back');

// 2. getConfirmDeleteKeyboard
const delKbdUz = getConfirmDeleteKeyboard(1, 'UZ');
const delKbdRu = getConfirmDeleteKeyboard(1, 'RU');
const delKbdEn = getConfirmDeleteKeyboard(1, 'EN');

assert.strictEqual(delKbdUz.inline_keyboard[0][0].text, '🗑 Ha, o\'chirilsin');
assert.strictEqual(delKbdRu.inline_keyboard[0][0].text, '🗑 Да, удалить');
assert.strictEqual(delKbdEn.inline_keyboard[0][0].text, '🗑 Yes, delete');

assert.strictEqual(delKbdUz.inline_keyboard[0][1].text, '❌ Yo\'q, bekor qilish');
assert.strictEqual(delKbdRu.inline_keyboard[0][1].text, '❌ Нет, отмена');
assert.strictEqual(delKbdEn.inline_keyboard[0][1].text, '❌ No, cancel');

// 3. getAdminChannelsKeyboard
const chKbdUz = getAdminChannelsKeyboard([{ id: 1, title: 'Kanal', inviteLink: 'https://t.me' }], 'UZ');
const chKbdRu = getAdminChannelsKeyboard([{ id: 1, title: 'Канал', inviteLink: 'https://t.me' }], 'RU');
const chKbdEn = getAdminChannelsKeyboard([{ id: 1, title: 'Channel', inviteLink: 'https://t.me' }], 'EN');

assert.strictEqual(chKbdUz.inline_keyboard[0][1].text, '🗑 O\'chirish');
assert.strictEqual(chKbdRu.inline_keyboard[0][1].text, '🗑 Удалить');
assert.strictEqual(chKbdEn.inline_keyboard[0][1].text, '🗑 Delete');

assert.strictEqual(chKbdUz.inline_keyboard[1][0].text, '➕ Kanal qo\'shish');
assert.strictEqual(chKbdRu.inline_keyboard[1][0].text, '➕ Добавить канал');
assert.strictEqual(chKbdEn.inline_keyboard[1][0].text, '➕ Add channel');

assert.strictEqual(chKbdUz.inline_keyboard[2][0].text, '⬅️ Admin menyu');
assert.strictEqual(chKbdRu.inline_keyboard[2][0].text, '⬅️ Меню админа');
assert.strictEqual(chKbdEn.inline_keyboard[2][0].text, '⬅️ Admin menu');

// 4. getAdminConfirmBroadcastKeyboard
const bcastKbdUz = getAdminConfirmBroadcastKeyboard('UZ');
const bcastKbdRu = getAdminConfirmBroadcastKeyboard('RU');
const bcastKbdEn = getAdminConfirmBroadcastKeyboard('EN');

assert.strictEqual(bcastKbdUz.inline_keyboard[0][0].text, '🚀 Yuborilsin');
assert.strictEqual(bcastKbdRu.inline_keyboard[0][0].text, '🚀 Отправить');
assert.strictEqual(bcastKbdEn.inline_keyboard[0][0].text, '🚀 Send broadcast');

assert.strictEqual(bcastKbdUz.inline_keyboard[0][1].text, '❌ Bekor qilish');
assert.strictEqual(bcastKbdRu.inline_keyboard[0][1].text, '❌ Отмена');
assert.strictEqual(bcastKbdEn.inline_keyboard[0][1].text, '❌ Cancel');

// 5. getLanguageKeyboard
const langKbdUz = getLanguageKeyboard('UZ');
const langKbdRu = getLanguageKeyboard('RU');
const langKbdEn = getLanguageKeyboard('EN');

assert.strictEqual(langKbdUz.inline_keyboard[2][0].text, '⬅️ Asosiy menyu');
assert.strictEqual(langKbdRu.inline_keyboard[2][0].text, '⬅️ Главное меню');
assert.strictEqual(langKbdEn.inline_keyboard[2][0].text, '⬅️ Main menu');

console.log('✅ ALL KEYBOARDS i18n TESTS PASSED!');
