// tests/test_quiz_html_export.mjs
// Test-Driven Development: Verification for Offline Standalone Quiz HTML Template Generator and Bot Keyboard
import assert from 'node:assert/strict';
import { generateQuizHtml } from '../tgcloud/lib/templates/quiz_html_template.js';
import { getQuizCardKeyboard } from '../tgcloud/lib/keyboards/quiz_keyboard.js';
import { ACTIONS } from '../tgcloud/lib/constants/actions.js';
import { getMessage } from '../tgcloud/lib/constants/messages.js';

console.log('🧪 Starting test_quiz_html_export.mjs...');

// 1. Test generateQuizHtml output
const sampleQuiz = {
  id: 42,
  title: 'Tarix Fani Testi (Olimpiada)',
  timeLimit: 30,
  isPublic: 1,
};

const sampleQuestions = [
  {
    id: 1,
    questionText: 'Amir Temur nechanchi yilda tug\'ilgan?', // using questionText as returned by getQuizById
    options: ['1336-yil', '1340-yil', '1356-yil', '1360-yil'],
    correctOptionId: 0, // using correctOptionId as returned by getQuizById
    explanation: 'Amir Temur 1336-yil 9-aprelda Kesh (Shahrisabz) yaqinidagi Xoja Ilg\'or qishlog\'ida tavallud topgan.',
  },
  {
    id: 2,
    question: 'Alisher Navoiy qaysi asarni yozgan?', // using question as fallback
    options: [{ text: 'Hamsa' }, { text: 'Boburnoma' }, { text: 'O\'tkan kunlar' }, { text: 'Qutadg\'u bilig' }],
    correct: 0, // using correct as fallback
    explanation: 'Alisher Navoiy turkiy tilda birinchi bo\'lib Xamsa yaratgan.',
  },
  {
    id: 3,
    questionText: 'Aniqmas integralni toping. $\\int {8}^{3x} dx$',
    options: ['$\\frac{3}{8} {8}^{3x}$', '$\\frac{1}{3ln8} ⋅ {8}^{3x}$'],
    correctOptionId: 1,
    explanation: 'Integral formulasi bo\'yicha yechiladi.',
  },
];

const html = generateQuizHtml({ quiz: sampleQuiz, questions: sampleQuestions });

assert.ok(typeof html === 'string', 'generateQuizHtml should return an HTML string');
assert.ok(html.includes('<!DOCTYPE html>'), 'HTML must start with doctype');
assert.ok(html.includes('Tarix Fani Testi (Olimpiada)'), 'HTML must include quiz title');
assert.ok(html.includes('Amir Temur nechanchi yilda tug\'ilgan?'), 'HTML must include questionText');
assert.ok(html.includes('Aniqmas integralni toping.'), 'HTML must include math questionText');
assert.ok(html.includes('id="setupModal"'), 'HTML must have setup modal wizard');
assert.ok(html.includes('id="quizHeader"'), 'HTML must have pinned quiz header');
assert.ok(html.includes('id="quizScrollArea"'), 'HTML must have scrollable middle area');
assert.ok(html.includes('class="control-bar floating-bar"'), 'HTML must have floating control bar');
assert.ok(html.includes('id="prevBtn"'), 'HTML must have previous button');
assert.ok(html.includes('id="nextBtn"'), 'HTML must have next button');
assert.ok(html.includes('id="finishBtn"'), 'HTML must have finish button');
assert.ok(html.includes('id="katex-lib"'), 'HTML must have embedded KaTeX library for offline math');
assert.ok(html.includes('id="resumeProgressBox"'), 'HTML must have resume progress banner');
assert.ok(html.includes('overflow-wrap: anywhere'), 'HTML must have robust word break to prevent text overflow');
assert.ok(!html.includes('questionPalette'), 'HTML must NOT have old question palette map');

// Verify that JS inside HTML executes without errors in mock browser environment
const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
assert.ok(scriptMatch, 'HTML must contain a <script> block');
assert.ok(scriptMatch[1].includes('STORAGE_KEY'), 'HTML script must contain localStorage progress tracking');

const mockBrowser = `
  const el = () => ({
    addEventListener: () => {},
    querySelector: () => ({ textContent: '', style: {} }),
    querySelectorAll: () => [],
    classList: { add: () => {}, remove: () => {}, toggle: () => {} },
    style: {},
    appendChild: () => {},
    scrollTop: 0,
    innerHTML: '',
    textContent: '',
    dataset: {}
  });
  const document = {
    getElementById: el,
    createElement: el,
    querySelectorAll: () => [],
    body: { getAttribute: () => 'dark', setAttribute: () => {} }
  };
  const window = { print: () => {} };
  const alert = () => {};
  const confirm = () => true;
  const localStorage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {}
  };
`;

new Function(mockBrowser + scriptMatch[1])();
console.log('✅ HTML generation and embedded JS execution verified.');

// 2. Test Keyboard integration
assert.ok(ACTIONS.DOWNLOAD_HTML_PREFIX, 'ACTIONS.DOWNLOAD_HTML_PREFIX must exist');

const kbUz = getQuizCardKeyboard(sampleQuiz, 'UZ', true);
const allButtonsUz = kbUz.inline_keyboard.flat();
const downloadBtnUz = allButtonsUz.find(b => b.callback_data?.startsWith(ACTIONS.DOWNLOAD_HTML_PREFIX));
assert.ok(downloadBtnUz, 'Quiz card keyboard must include download HTML button in UZ');

const kbRu = getQuizCardKeyboard(sampleQuiz, 'RU', false);
const allButtonsRu = kbRu.inline_keyboard.flat();
const downloadBtnRu = allButtonsRu.find(b => b.callback_data?.startsWith(ACTIONS.DOWNLOAD_HTML_PREFIX));
assert.ok(downloadBtnRu, 'Quiz card keyboard must include download HTML button in RU for viewers');

// 3. Test Messages Parity
for (const lang of ['UZ', 'RU', 'EN']) {
  const btnMsg = getMessage('BTN_DOWNLOAD_HTML', lang);
  assert.ok(btnMsg && btnMsg.length > 0, `BTN_DOWNLOAD_HTML must exist in ${lang}`);
}

console.log('🎉 test_quiz_html_export.mjs PASSED PERFECTLY!');
