import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { validateQuestion } from '../tgcloud/lib/parsers/validator.js';
import { parseAbcFormat } from '../tgcloud/lib/parsers/abc_parser.js';
import { parseLegacyFormat } from '../tgcloud/lib/parsers/legacy_parser.js';
import { CONFIG } from '../tgcloud/lib/constants/config.js';

console.log('🧪 Testing Clone Restrictions & 12 Options Limit...');

// 1. Verify CONFIG max options is 12 (Telegram Bot API standard)
assert.equal(CONFIG.POLL.MAX_OPTIONS, 12, 'MAX_OPTIONS must be 12 per Telegram Bot API update');

// 2. Test validator clamping options > 12
const mockOver12Q = {
  questionText: 'Test savol?',
  options: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14'],
  correctOptionId: 13,
};
const res = validateQuestion(mockOver12Q, 1, 'UZ');
assert.equal(res.isValid, true, 'Question should remain valid by clamping options');
assert.equal(res.sanitized.options.length, 12, 'Options must be clamped to 12');
assert.equal(res.sanitized.correctOptionId, 11, 'Correct option must be preserved within bounds');
console.log('✓ Validator successfully clamps >12 options and preserves correct answer');

// 3. Test legacy parser handling second '+' as new question
const legacyText = [
  '? Question 1',
  '+ Correct 1',
  '= Wrong 1',
  '+ Correct 2',
  '= Wrong 2'
];
const legacyParsed = parseLegacyFormat(legacyText);
assert.equal(legacyParsed.length, 2, 'Should detect second question when another + appears');
console.log('✓ Legacy parser successfully separates questions when second + appears');

// 4. Test ABC parser up to 12 options (A through L)
const abcText = [
  '1. Question 1?',
  'A) 1',
  'B) 2',
  'C) 3',
  'D) 4',
  'E) 5',
  'F) 6',
  'G) 7',
  'H) 8',
  'I) 9',
  'J) 10',
  'K) 11',
  'L) 12',
  'M) 13' // extra option beyond 12
];
const abcParsed = parseAbcFormat(abcText);
assert.equal(abcParsed[0].options.length, 12, 'ABC parser options should support up to 12 options');
console.log('✓ ABC parser successfully supports up to 12 options (A-L)');

// 5. Test SQLite DB: Quiz 2407 has 453 questions
const db = new DatabaseSync('D:/Serverless/Queasy_uz_Bot/queasy_ready.sqlite', { readOnly: true });
const q2407 = db.prepare('SELECT count(*) as cnt FROM questions WHERE quiz_id = 2407').get();
assert.equal(q2407.cnt, 453, 'Quiz 2407 must have 453 questions in SQLite');

// 6. Test SQLite DB: No stuck lobbies
const stuckLobbies = db.prepare("SELECT count(*) as cnt FROM group_lobbies WHERE status IN ('waiting', 'starting')").get();
assert.equal(stuckLobbies.cnt, 0, 'No lobbies should remain stuck in waiting/starting for 0-question quizzes');

console.log('✓ Database integrity check passed: Quiz 2407 has 453 questions and 0 stuck lobbies');
console.log('🎉 All Clone Restrictions & 12 Options Limit tests passed!');
