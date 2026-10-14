// tests/test_poll_modernization.mjs
import assert from 'assert';
import { sanitizeOptionsList } from '../tgcloud/lib/parsers/sanitizer.js';
import { truncateOption } from '../tgcloud/lib/utils/poll_helpers.js';
import { hasMathFormula, generateLatexImageUrl } from '../tgcloud/lib/parsers/math_engine.js';
import { CONFIG } from '../tgcloud/lib/constants/config.js';

console.log('🧪 Starting Poll Modernization Unit Tests...\n');

// 1. Test string options
const stringOptions = ['A) Option 1', 'B) Option 2', 'C) Option 3'];
const cleanedStrings = sanitizeOptionsList(stringOptions);
assert.deepStrictEqual(cleanedStrings, ['Option 1', 'Option 2', 'Option 3'], 'String options should be cleaned');
console.log('✅ String options sanitization passed');

// 2. Test structured InputPollOption objects
const structuredOptions = [
  { text: 'A) Formula A', media: { type: 'photo', media: 'file_id_1' } },
  { text: 'B) Formula B', media: { type: 'photo', media: 'file_id_2' } },
];
const cleanedStructured = sanitizeOptionsList(structuredOptions);

assert.strictEqual(cleanedStructured.length, 2, 'Should preserve 2 structured options');
assert.strictEqual(cleanedStructured[0].text, 'Formula A', 'Structured option text should strip prefix');
assert.deepStrictEqual(cleanedStructured[0].media, { type: 'photo', media: 'file_id_1' }, 'Structured option media preserved');
console.log('✅ Structured InputPollOption sanitization passed');

// 3. Test truncateOption with object
const longOpt = { text: 'A'.repeat(120), media: { type: 'photo', media: 'file_id_x' } };
const truncatedOpt = truncateOption(longOpt, 100);
assert.strictEqual(truncatedOpt.text.length, 100, 'Option text should truncate to 100');
assert.strictEqual(truncatedOpt.media.media, 'file_id_x', 'Media should be preserved');
console.log('✅ truncateOption object truncation passed');

// 4. Test auto-generating InputPollOption with formula image for math options
const mathOptionsRaw = ['$6x-6y$', '$6x+6y$', '$6x-y$', '$6x+y$'];
const sanitizedMath = sanitizeOptionsList(mathOptionsRaw);
const letters = ['A', 'B', 'C', 'D'];
const generatedModernOptions = sanitizedMath.map((opt, idx) => {
  const letter = letters[idx];
  const optText = typeof opt === 'object' ? opt.text : String(opt || '');
  if (hasMathFormula(optText)) {
    const cleanMathText = optText.replace(/\$/g, '').trim();
    const formulaImgUrl = generateLatexImageUrl(optText, 300);
    return {
      text: truncateOption(`${letter}) ${cleanMathText}`, CONFIG.POLL.MAX_OPTION_LENGTH),
      media: { type: 'photo', media: formulaImgUrl },
    };
  }
  return truncateOption(opt, CONFIG.POLL.MAX_OPTION_LENGTH);
});

assert.strictEqual(generatedModernOptions.length, 4);
assert.strictEqual(generatedModernOptions[0].text, 'A) 6x-6y');
assert.ok(generatedModernOptions[0].media.media.includes('latex.codecogs.com'), 'Should have CodeCogs 300 DPI URL');
assert.ok(generatedModernOptions[0].media.media.includes('dpi{300}'), 'Should specify 300 DPI');
assert.strictEqual(generatedModernOptions[1].text, 'B) 6x+6y');
console.log('✅ Math options formula image generation passed');

// 5. Test fallback extraction to stringOptions
const stringFallback = generatedModernOptions.map((o) => (typeof o === 'object' ? o.text : String(o)));
assert.deepStrictEqual(stringFallback, ['A) 6x-6y', 'B) 6x+6y', 'C) 6x-y', 'D) 6x+y']);
console.log('✅ Fallback string extraction passed');

// 6. Test non-math options remain plain strings
const plainOptionsRaw = ['Toshkent', 'Samarqand', 'Buxoro'];
const plainSanitized = sanitizeOptionsList(plainOptionsRaw);
const generatedPlain = plainSanitized.map((opt, idx) => {
  const optText = typeof opt === 'object' ? opt.text : String(opt || '');
  if (hasMathFormula(optText)) {
    return { text: optText, media: { type: 'photo', media: '...' } };
  }
  return truncateOption(opt, CONFIG.POLL.MAX_OPTION_LENGTH);
});
assert.deepStrictEqual(generatedPlain, ['Toshkent', 'Samarqand', 'Buxoro']);
console.log('✅ Plain non-math options remain strings passed');

// 7. Test modern poll payload building
const modernPayload = {
  chat_id: 12345,
  question: 'Savol matni',
  options: generatedModernOptions,
  media: { type: 'photo', media: 'header_file_id' },
  shuffle_options: true,
  members_only: true,
};
assert.strictEqual(modernPayload.shuffle_options, true);
assert.strictEqual(modernPayload.members_only, true);
assert.strictEqual(modernPayload.media.media, 'header_file_id');
assert.strictEqual(modernPayload.options.length, 4);
console.log('✅ Modern poll payload validation passed');

console.log('\n🎉 ALL POLL TESTS PASSED!');
