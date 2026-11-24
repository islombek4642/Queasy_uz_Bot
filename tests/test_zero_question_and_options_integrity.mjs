// tests/test_zero_question_and_options_integrity.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { getQuizCardKeyboard } from '../tgcloud/lib/keyboards/quiz_keyboard.js';
import { CONFIG } from '../tgcloud/lib/constants/config.js';
import { validateQuestion } from '../tgcloud/lib/parsers/validator.js';
import startSoloSession from '../tgcloud/endpoints/start_solo_session.js';

console.log('🧪 Testing 0-Question Quizzes & Options Integrity Protection...');

// 1. getQuizCardKeyboard for empty quiz (questions: [])
const emptyQuiz = {
  id: 2908,
  title: 'Quiz with 0 questions',
  questions: [],
  timeLimit: 30,
  shuffleOptions: true,
};
const kbEmpty = getQuizCardKeyboard(emptyQuiz, 'UZ', true);
const allButtons = kbEmpty.inline_keyboard.flat();
const emptyBtn = allButtons.find((b) => b.callback_data === 'quiz_empty:2908');
assert.ok(emptyBtn, 'Must render empty quiz warning button for quiz with questions: []');
assert.ok(emptyBtn.text.toLowerCase().includes('savol'), 'Warning button must contain empty questions notice');

const playSoloBtn = allButtons.find((b) => b.callback_data && b.callback_data.startsWith('mode_select:'));
assert.equal(playSoloBtn, undefined, 'Must not render start solo button for empty quiz');
const playGroupBtn = allButtons.find((b) => b.callback_data && b.callback_data.startsWith('start_group_quiz:'));
assert.equal(playGroupBtn, undefined, 'Must not render start group button for empty quiz');
const downloadBtn = allButtons.find((b) => b.callback_data && b.callback_data.startsWith('dl_html:'));
assert.equal(downloadBtn, undefined, 'Must not render download HTML button for empty quiz');
console.log('✓ getQuizCardKeyboard correctly replaces action buttons with warning for questions: []');

// 2. getQuizCardKeyboard for questionCount === 0
const emptyQuizMeta = {
  id: 3001,
  title: 'Quiz with questionCount 0',
  questionCount: 0,
  timeLimit: 30,
  shuffleOptions: true,
};
const kbMeta = getQuizCardKeyboard(emptyQuizMeta, 'UZ', false);
const allButtonsMeta = kbMeta.inline_keyboard.flat();
assert.ok(allButtonsMeta.some((b) => b.callback_data === 'quiz_empty:3001'), 'Must render warning for questionCount === 0');
console.log('✓ getQuizCardKeyboard correctly handles questionCount === 0');

// 3. Normal quiz gets full action buttons
const validQuiz = {
  id: 101,
  title: 'Valid Quiz',
  questions: [
    { questionText: 'Q1?', options: ['A', 'B'], correctOptionId: 0 }
  ],
  timeLimit: 30,
  shuffleOptions: true,
};
const kbValid = getQuizCardKeyboard(validQuiz, 'UZ', true);
const validButtons = kbValid.inline_keyboard.flat();
assert.ok(validButtons.some((b) => b.callback_data === 'start_quiz:101'), 'Must render start button for valid quiz');
console.log('✓ getQuizCardKeyboard renders standard actions for non-empty quiz');

// 4. Verify CONFIG.POLL.MIN_OPTIONS is 2
assert.equal(CONFIG.POLL.MIN_OPTIONS, 2, 'Telegram Bot API requires minimum 2 options for polls');
console.log('✓ CONFIG.POLL.MIN_OPTIONS is strictly 2');

// 5. Test validator rejects 0 and 1 options
const qZeroOpts = { questionText: 'Savol?', options: [], correctOptionId: 0 };
assert.equal(validateQuestion(qZeroOpts, 1, 'UZ').isValid, false, 'Must reject 0 options');

const qOneOpt = { questionText: 'Savol?', options: ['Faqat bitta'], correctOptionId: 0 };
assert.equal(validateQuestion(qOneOpt, 1, 'UZ').isValid, false, 'Must reject 1 option');

const qTwoOpts = { questionText: 'Savol?', options: ['A', 'B'], correctOptionId: 1 };
assert.equal(validateQuestion(qTwoOpts, 1, 'UZ').isValid, true, 'Must accept 2 options');
console.log('✓ Validator strictly requires at least 2 options');

// 6. Test start_solo_session rejects totalQuestions <= 0
async function testStartSoloRejection() {
  const ctx = { initData: { user: { id: 8826149564 } } };
  const res1 = await startSoloSession({ quizId: 2908, totalQuestions: 0 }, ctx);
  assert.equal(res1.success, false);
  assert.equal(res1.error, 'QUIZ_HAS_NO_QUESTIONS');

  const res2 = await startSoloSession({ quizId: 2908, totalQuestions: -5 }, ctx);
  assert.equal(res2.success, false);
  assert.equal(res2.error, 'QUIZ_HAS_NO_QUESTIONS');
  console.log('✓ start_solo_session endpoint strictly rejects sessions with totalQuestions <= 0');
}

// 7. Verify site index categories match catalog definition
const siteIndexFile = path.join(process.cwd(), 'kiut_site_index.json');
if (fs.existsSync(siteIndexFile)) {
  const siteData = JSON.parse(fs.readFileSync(siteIndexFile, 'utf8'));
  const forms = new Set(siteData.map((it) => it.form || it.pathParts[0]));
  const expectedForms = [
    "KUNDUZGI TA'LIM",
    "SIRTQI TA'LIM",
    "KECHKI TA'LIM",
    "MASOFAVIY TA'LIM",
    "FANLAR FARQI",
    "KUNDUZGI TA'LIM (TIBBIYOT)",
  ];
  for (const ef of expectedForms) {
    assert.ok(forms.has(ef), `Site index must contain expected form: ${ef}`);
  }
  console.log('✓ All 6 root catalog education forms 100% matched with site index');
}

testStartSoloRejection().then(() => {
  console.log('\n🎉 ALL 0-QUESTION & OPTIONS INTEGRITY TESTS PASSED!');
});
