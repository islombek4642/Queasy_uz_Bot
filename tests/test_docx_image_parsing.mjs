import assert from 'node:assert';
import fs from 'node:fs';
import { extractLinesFromDocx } from '../tgcloud/lib/parsers/docx_reader.js';
import { parseLegacyFormat } from '../tgcloud/lib/parsers/legacy_parser.js';

console.log('🧪 Testing DOCX Image Extraction & Promotion to Question photoFileId...');

const docxPath = 'KIUT_TEST/SIRTQI TA\'LIM/N23 (2023-2027 O\'QUV YIL)/(B.A.) HISTORY (BY COUNTRIES AND DIRECTIONS) (TARIX)/2-SEMESTR/NAMANGAN COMPUTER 2 (HSTP,PREP,PRIP,PSYP)(2023-2024)(UZ).docx';
assert.ok(fs.existsSync(docxPath), 'Test docx file must exist');

const buf = fs.readFileSync(docxPath);
const lines = extractLinesFromDocx(buf);
assert.ok(lines.length > 100, 'Must extract lines');

const hasDataUri = lines.some((l) => l.includes('data:image/'));
assert.ok(hasDataUri, 'Extracted lines must contain embedded image data URIs');

const questions = parseLegacyFormat(lines);
assert.ok(questions.length > 50, 'Must parse legacy questions');

const allImgQuestions = questions.filter((q) => Boolean(q.photoFileId));
console.log(`Total questions with photoFileId extracted: ${allImgQuestions.length}`);
assert.ok(allImgQuestions.length > 0, 'Must extract questions with photoFileId');

for (const q of allImgQuestions.slice(0, 5)) {
  console.log('Question:', q.questionText.replace(/<img[\s\S]*?>/, '<IMG TAG>'));
  console.log('Options:', q.options);
  console.log('PhotoFileId length:', q.photoFileId.length);
  assert.ok(q.photoFileId.startsWith('data:image/'), 'photoFileId must be a data URI');
  for (const opt of q.options) {
    assert.ok(!opt.includes('<img'), 'Option must not contain raw img tags');
  }
}

console.log('🎉 ALL DOCX IMAGE EXTRACTION & PARSER TESTS PASSED!');
