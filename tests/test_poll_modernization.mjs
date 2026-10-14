// tests/test_poll_modernization.mjs
import assert from 'assert';
import { sanitizeOptionsList } from '../tgcloud/lib/parsers/sanitizer.js';

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

import { truncateOption } from '../tgcloud/lib/utils/poll_helpers.js';

// 3. Test truncateOption with object
const longOpt = { text: 'A'.repeat(120), media: { type: 'photo', media: 'file_id_x' } };
const truncatedOpt = truncateOption(longOpt, 100);
assert.strictEqual(truncatedOpt.text.length, 100, 'Option text should truncate to 100');
assert.strictEqual(truncatedOpt.media.media, 'file_id_x', 'Media should be preserved');
console.log('✅ truncateOption object truncation passed');

// 4. Test modern poll payload building
const modernPayload = {
  chat_id: 12345,
  question: 'Savol matni',
  options: [
    { text: 'Opt 1', media: { type: 'photo', media: 'file_1' } },
    { text: 'Opt 2' },
  ],
  media: { type: 'photo', media: 'header_file_id' },
  shuffle_options: true,
  members_only: true,
};
assert.strictEqual(modernPayload.shuffle_options, true);
assert.strictEqual(modernPayload.members_only, true);
assert.strictEqual(modernPayload.media.media, 'header_file_id');
console.log('✅ Modern poll payload validation passed');

console.log('\n🎉 ALL POLL TESTS PASSED!');
