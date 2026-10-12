// tests/test_cleaner_syntax.mjs
import assert from 'node:assert';
import { cleanRawTextLines, preprocessSpacedSeparators, splitGluedQuestions } from '../tgcloud/lib/parsers/cleaner.js';
import { parseAbcFormat } from '../tgcloud/lib/parsers/abc_parser.js';
import { parseBlockFormat } from '../tgcloud/lib/parsers/block_parser.js';

console.log('--- Testing Cleaner & Syntax Normalization ---');

// 1. Spaced Separator Preprocessing (+ + + + and = = = =)
const spacedBlockText = `
+ + + +
O'zbekiston poytaxti qaysi shahar?
= = = =
#Toshkent
= = = =
Samarqand
= = = =
Buxoro
+ + + +
Amir Temur qachon tug'ilgan?
= = = =
#1336-yil
= = = =
1405-yil
`;

const preprocessed = preprocessSpacedSeparators(spacedBlockText);
assert.ok(preprocessed.includes('++++'), 'Spaced + + + + must be converted to ++++');
assert.ok(preprocessed.includes('===='), 'Spaced = = = = must be converted to ====');

const blockLines = cleanRawTextLines(preprocessed);
const blockResult = parseBlockFormat(blockLines);
assert.strictEqual(blockResult.length, 2, 'Should parse 2 block questions with spaced separators');
assert.strictEqual(blockResult[0].correctOptionId, 0, 'First option must be correct');
console.log('✅ Spaced separators test passed!');

// 2. Glued questions split
const gluedText = `Qaysi javob to'g'ri?
A) Javob bir
B) Javob ikkiQuyidagi so'zlardan qaysi biri ot?
A) Kitob
B) Chiroyli`;

const unglued = splitGluedQuestions(gluedText);
assert.ok(unglued.includes('\nQuyidagi so'), 'Glued question must be split onto a new line');
console.log('✅ Glued questions test passed!');

// 3. No-space numbering & Cyrillic option letters in ABC Parser
const noSpaceText = `
1.O'zbekiston mustaqilligi qachon e'lon qilingan?
A)1991-yil 1-sentabr
B)1990-yil
C)1992-yil
To'g'ri javob: A

2)Eng katta sayyora qaysi?
А)Yupiter
Б)Mars
В)Venera
To'g'ri javob: А
`;

const abcLines = cleanRawTextLines(noSpaceText);
const abcResult = parseAbcFormat(abcLines);
assert.strictEqual(abcResult.length, 2, 'Should parse 2 ABC questions with no-space numbering & Cyrillic options');
assert.strictEqual(abcResult[0].correctOptionId, 0);
assert.strictEqual(abcResult[1].correctOptionId, 0);
console.log('✅ No-space numbering and Cyrillic options test passed!');

console.log('🎉 ALL CLEANER & SYNTAX TESTS PASSED!');
