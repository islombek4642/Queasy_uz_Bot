// tests/test_question_sanitizer.mjs
import assert from 'assert';
import { sanitizeQuestionText, sanitizeOptionsList } from '../tgcloud/lib/parsers/sanitizer.js';

console.log('🧪 Starting Question & Option Sanitizer Tests...\n');

// 1. HTML Entities Decoding
{
  const input = "Amir Temurning uchinchi o&apos;g&apos;li Mironshohning chevarasi edi";
  const expected = "Amir Temurning uchinchi o'g'li Mironshohning chevarasi edi";
  assert.strictEqual(sanitizeQuestionText(input), expected);
  console.log('✅ HTML Entity: &apos; converted to apostrophe');
}

{
  const input = "&quot;O'tmish avlodlardan qolgan yodgorliklar&quot; asarining muallifi kim?";
  const expected = '"O\'tmish avlodlardan qolgan yodgorliklar" asarining muallifi kim?';
  assert.strictEqual(sanitizeQuestionText(input), expected);
  console.log('✅ HTML Entity: &quot; converted to regular quotes');
}

{
  const input = "Havoda 1 kubometrda 173 g suv bug&apos;i bo&apos;lishi mumkin &amp; bosim 760 mm sim. ust.";
  const expected = "Havoda 1 kubometrda 173 g suv bug'i bo'lishi mumkin & bosim 760 mm sim. ust.";
  assert.strictEqual(sanitizeQuestionText(input), expected);
  console.log('✅ HTML Entity: &amp; and multiple &apos; converted');
}

// 2. Embedded image tags removal
{
  const input = 'Scratchda bu mavjudodning nomi nima? &lt;img src=&quot;/api/media?path=KECHKI%20TA%27LIM/N23/sample.png&quot;&gt;';
  const expected = 'Scratchda bu mavjudodning nomi nima?';
  assert.strictEqual(sanitizeQuestionText(input), expected);
  console.log('✅ Image tags: &lt;img ...&gt; stripped from question text');
}

{
  const input = 'Quyidagi rasmda nima tasvirlangan? <img src="/test.jpg" alt="test">';
  const expected = 'Quyidagi rasmda nima tasvirlangan?';
  assert.strictEqual(sanitizeQuestionText(input), expected);
  console.log('✅ Image tags: raw <img ...> stripped from question text');
}

// 3. Weird punctuation prefixes
{
  const input = ',, Salib yurishlari”';
  const expected = '"Salib yurishlari"';
  assert.strictEqual(sanitizeQuestionText(input), expected);
  console.log('✅ Weird prefix: ,, text” converted to standard quotes');
}

{
  const input = '.. Afyun urushlari”';
  const expected = '"Afyun urushlari"';
  assert.strictEqual(sanitizeQuestionText(input), expected);
  console.log('✅ Weird prefix: .. text” converted to standard quotes');
}

{
  const input = '.Bioetika va inson huquqlari haqida umumjahon deklaratsiyasi qachon qabul qilingan?';
  const expected = 'Bioetika va inson huquqlari haqida umumjahon deklaratsiyasi qachon qabul qilingan?';
  assert.strictEqual(sanitizeQuestionText(input), expected);
  console.log('✅ Weird prefix: leading isolated dot stripped');
}

// 4. Excessive blanks / dots
{
  const input = "O'zbekiston Respublikasining boshqaruvga ko'ra shakli............";
  const expected = "O'zbekiston Respublikasining boshqaruvga ko'ra shakli...";
  assert.strictEqual(sanitizeQuestionText(input), expected);
  console.log('✅ Excessive dots normalized to standard ellipsis');
}

// 5. Option labels inside option list
{
  const inputOpts = [
    'A) Birinchi variant',
    'B) Ikkinchi variant',
    'C) Uchinchi variant',
    'D) To\'rtinchi variant',
  ];
  const cleaned = sanitizeOptionsList(inputOpts);
  assert.deepStrictEqual(cleaned, [
    'Birinchi variant',
    'Ikkinchi variant',
    'Uchinchi variant',
    'To\'rtinchi variant',
  ]);
  console.log('✅ Option letters: A), B), C), D) stripped from option text');
}

{
  // Russian person names with initials must NOT be stripped!
  const inputOpts = [
    'М. Скобелев',
    'Н. И. Корольков',
    'А. Кун',
    'Ф. Кауфман',
  ];
  const cleaned = sanitizeOptionsList(inputOpts);
  assert.deepStrictEqual(cleaned, [
    'М. Скобелев',
    'Н. И. Корольков',
    'А. Кун',
    'Ф. Кауфман',
  ]);
  console.log('✅ Person initials: Preserved safely without false positive stripping');
}

// 6. Double backslashes in math
{
  const input = 'Berilgan kasrni hisoblang: $\\\\frac{1}{2} + \\\\sqrt{4}$';
  const expected = 'Berilgan kasrni hisoblang: $\\frac{1}{2} + \\sqrt{4}$';
  assert.strictEqual(sanitizeQuestionText(input), expected);
  console.log('✅ Double escaped math slashes normalized');
}

// 7. Question numbering prefix
{
  const input = '? 1. Qadimgi Rim davlatida konsul lavozimi qachon joriy qilingan?';
  const expected = 'Qadimgi Rim davlatida konsul lavozimi qachon joriy qilingan?';
  assert.strictEqual(sanitizeQuestionText(input), expected);
  console.log('✅ Question prefix: ? 1. stripped from question start');
}

console.log('\n🎉 ALL QUESTION & OPTION SANITIZER TESTS PASSED PERFECTLY!\n');
