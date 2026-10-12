// tests/test_pdf_reader.mjs
import assert from 'node:assert';
import zlib from 'node:zlib';
import { extractLinesFromPdf } from '../tgcloud/lib/parsers/pdf_reader.js';
import { parseAbcFormat } from '../tgcloud/lib/parsers/abc_parser.js';

console.log('--- Testing Pure JS PDF Text Reader ---');

// Helper to build a minimal valid PDF with a text stream
function buildSimplePdf(streamContent, isCompressed = true) {
  const contentBytes = Buffer.from(streamContent, 'utf8');
  let streamData = contentBytes;
  let filterStr = '';

  if (isCompressed) {
    streamData = zlib.deflateSync(contentBytes);
    filterStr = '/Filter /FlateDecode';
  }

  const pdfParts = [
    '%PDF-1.4\n',
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>\nendobj\n',
    `4 0 obj\n<< /Length ${streamData.length} ${filterStr} >>\nstream\n`,
    streamData,
    '\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f \n0000000009 00000 n \ntrailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n500\n%%EOF',
  ];

  return Buffer.concat(pdfParts.map((p) => (typeof p === 'string' ? Buffer.from(p, 'utf8') : p)));
}

// 1. Test compressed stream with standard Tj and TJ operators
const sampleStream = `
BT
/F1 12 Tf
(1. O'zbekistonning birinchi Prezidenti kim?) Tj
T*
[(A) ( Islom Karimov)] TJ
T*
(B) Shavkat Mirziyoyev) Tj
T*
(C) Abdulla Oripov) Tj
T*
(To'g'ri javob: A) Tj
ET
`;

const pdfBuffer = buildSimplePdf(sampleStream, true);
const lines = extractLinesFromPdf(pdfBuffer);

assert.ok(lines.length >= 4, 'Must extract at least 4 lines from PDF');
assert.ok(lines.some((l) => l.includes('Islom Karimov')), 'Must include option A');

const questions = parseAbcFormat(lines);
assert.strictEqual(questions.length, 1, 'Must parse 1 question from PDF text');
assert.strictEqual(questions[0].correctOptionId, 0, 'Option A must be correct');
console.log('✅ Standard compressed PDF text extraction passed!');

// 2. Test scanned / empty PDF error handling
const emptyPdf = buildSimplePdf('BT /F1 12 Tf ET', false);
assert.throws(
  () => {
    extractLinesFromPdf(emptyPdf);
  },
  /PDF_NO_TEXT|topilmadi/i,
  'Empty / image PDF must throw clear no-text error'
);
console.log('✅ Scanned/Empty PDF detection passed!');

console.log('🎉 ALL PDF READER TESTS PASSED!');
