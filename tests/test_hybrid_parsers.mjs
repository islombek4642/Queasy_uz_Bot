// tests/test_hybrid_parsers.mjs
// Automated test suite for Hybrid Parser Engine

import assert from 'node:assert';
import { parseQuizInput } from '../tgcloud/lib/parsers/parser_engine.js';
import { normalizeUzbekApostrophes, fixBrokenLineJoins } from '../tgcloud/lib/parsers/cleaner.js';

console.log('🧪 Starting Hybrid Parser Unit Tests...\n');

// 1. Text Cleaner & Apostrophes
{
  const raw = "O`zbekiston g‘o‘zasi – paxta; Toshkent";
  const norm = normalizeUzbekApostrophes(raw);
  assert.strictEqual(norm, "O'zbekiston g'o'zasi - paxta; Toshkent");
  console.log('✅ Cleaner: Apostrophe & dash normalization passed');
}

// 2. Line Joiner
{
  const lines = [
    "1. Birinchi savol matni bu yerda",
    "va uning davomi ikkinchi qatorda.",
    "A) Variant 1",
    "B) Variant 2"
  ];
  const joined = fixBrokenLineJoins(lines);
  assert.strictEqual(joined[0], "1. Birinchi savol matni bu yerda va uning davomi ikkinchi qatorda.");
  console.log('✅ Cleaner: Line joiner passed');
}

// 3. ABC Format with # Prefix
{
  const text = `
1. O'zbekiston Respublikasi poytaxti qaysi shahar?
#A) Toshkent
B) Samarqand
C) Buxoro
D) Xiva

2. Amir Temur tavallud topgan shahar?
A) Toshkent
#B) Shahrisabz
C) Samarqand
D) Termiz
  `;
  const res = parseQuizInput(text);
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.questions.length, 2);
  assert.strictEqual(res.questions[0].correctOptionId, 0);
  assert.strictEqual(res.questions[1].correctOptionId, 1);
  console.log('✅ Parser: ABC format with # prefix passed');
}

// 4. ABC Format with Suffix Indicator
{
  const text = `
1. Quyosh tizimidagi eng katta sayyora qaysi?
A) Mars
B) Yer
C) Yupiter
D) Venera
To'g'ri javob: C
  `;
  const res = parseQuizInput(text);
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.questions.length, 1);
  assert.strictEqual(res.questions[0].correctOptionId, 2);
  console.log('✅ Parser: ABC format with "To\'g\'ri javob: C" passed');
}

// 5. ABC Format with End-of-text Answer Keys
{
  const text = `
1. Alisher Navoiy qachon tug'ilgan?
A) 1441-yil
B) 1483-yil
C) 1336-yil

2. Zahiriddin Muhammad Bobur qachon tug'ilgan?
A) 1441-yil
B) 1483-yil
C) 1500-yil

Javoblar: 1-A, 2-B
  `;
  const res = parseQuizInput(text);
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.questions.length, 2);
  assert.strictEqual(res.questions[0].correctOptionId, 0);
  assert.strictEqual(res.questions[1].correctOptionId, 1);
  console.log('✅ Parser: ABC format with end-of-text Answer Keys passed');
}

// 6. GIFT Format
{
  const text = `
O'zbekiston mustaqillikka qachon erishgan? {
=1991-yil #1-sentabr
~1990-yil
~1992-yil
~1989-yil
}
  `;
  const res = parseQuizInput(text);
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.questions.length, 1);
  assert.strictEqual(res.questions[0].correctOptionId, 0);
  assert.strictEqual(res.questions[0].explanation, '1-sentabr');
  console.log('✅ Parser: GIFT format with feedback passed');
}

// 7. Block Format (++++ / ====)
{
  const text = `
++++
Tinch okeani Yer sharidagi eng katta okeanmi?
====
#Ha
====
Yo'q
====
Balki
  `;
  const res = parseQuizInput(text);
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.questions.length, 1);
  assert.strictEqual(res.questions[0].correctOptionId, 0);
  console.log('✅ Parser: Block format (++++ / ====) passed');
}

// 8. Legacy Format (? / + / =)
{
  const text = `
?2 + 2 nechaga teng?
+4
=3
=5
=6
  `;
  const res = parseQuizInput(text);
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.questions.length, 1);
  assert.strictEqual(res.questions[0].correctOptionId, 0);
  console.log('✅ Parser: Legacy format (? / + / =) passed');
}

// 9. Validator Error Detection
{
  const invalidText = `
1. To'g'ri javobi belgilanmagan savol
A) Variant 1
B) Variant 2
  `;
  const res = parseQuizInput(invalidText);
  assert.strictEqual(res.success, false);
  assert(res.error.includes("to'g'ri javob belgilanmagan"));
  console.log('✅ Validator: Successfully caught missing correct answer');
}

// 10. Legacy format with questions but no correct answer (all = options)
{
  const legacyNoAnswerText = `
?Historic buildings are___________.
= very old and important buildings
=very tall buildings
=places where there are a lot of rich people
=a place which is very good for something

?Wealthy areas are______________.
=wide street with trees planted along the sides
= places where there are a lot of rich people
= a place which is very good for something
  `;
  const res = parseQuizInput(legacyNoAnswerText, 'exam.txt', 'UZ');
  assert.strictEqual(res.success, false);
  assert.strictEqual(res.questions.length, 0);
  assert(res.error.includes('2 ta savol') && res.error.includes("to'g'ri javob belgilanmagan"));
  console.log('✅ Validator: Successfully caught answerless legacy questions and reported count');
}

console.log('\n🎉 ALL HYBRID PARSER TESTS PASSED PERFECTLY!\n');
