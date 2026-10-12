// tgcloud/lib/parsers/parser_engine.js
// Universal Hybrid Parser Engine with Auto-Detection & Smart Validation

import { cleanRawTextLines } from './cleaner.js';
import { parseAbcFormat } from './abc_parser.js';
import { parseGiftFormat } from './gift_parser.js';
import { parseBlockFormat } from './block_parser.js';
import { parseLegacyFormat } from './legacy_parser.js';
import { extractLinesFromDocx } from './docx_reader.js';
import { extractQuestionsFromXlsx } from './xlsx_reader.js';
import { extractLinesFromPdf } from './pdf_reader.js';
import { validateQuizQuestions } from './validator.js';

export function detectFormatAndParse(lines) {
  if (!lines || lines.length === 0) return [];
  const sample = lines.slice(0, 100).join('\n');

  // 1. Check Legacy format (?Savol, +To'g'ri, =Xato)
  if (sample.includes('?') && (sample.includes('+') || sample.includes('='))) {
    const legacyQ = parseLegacyFormat(lines);
    if (legacyQ.length > 0) return legacyQ;
  }

  // 2. Check Block format (++++ and ====)
  if (sample.includes('++++') && sample.includes('====')) {
    const q = parseBlockFormat(lines);
    if (q.length > 0) return q;
  }

  // 3. Check GIFT format ({ =Correct ~Wrong }) - must contain real GIFT curly braces with = or ~
  const hasGiftPattern = sample.includes('{=') || sample.includes('{~') || /\{\s*[=~]/.test(sample);
  if (hasGiftPattern) {
    const q = parseGiftFormat(lines);
    if (q.length > 0) return q;
  }

  // 4. Default / Enhanced ABC format
  const abcQuestions = parseAbcFormat(lines);
  if (abcQuestions.length > 0) {
    return abcQuestions;
  }

  // Fallbacks
  return parseLegacyFormat(lines);
}

/**
 * Universal parse entrypoint.
 * Accepts:
 *  - string (raw pasted text)
 *  - Buffer / Uint8Array (file bytes with fileName: .pdf, .docx, .xlsx, .txt)
 */
export function parseQuizInput(input, fileName = 'test.txt') {
  try {
    let rawQuestions = [];
    const lowerName = fileName.toLowerCase();

    if (lowerName.endsWith('.xlsx')) {
      rawQuestions = extractQuestionsFromXlsx(input);
    } else if (lowerName.endsWith('.docx')) {
      const lines = extractLinesFromDocx(input);
      rawQuestions = detectFormatAndParse(lines);
    } else if (lowerName.endsWith('.pdf')) {
      const lines = extractLinesFromPdf(input);
      rawQuestions = detectFormatAndParse(lines);
    } else {
      // Plain text or .txt
      const text = typeof input === 'string' ? input : Buffer.from(input).toString('utf8');
      const lines = cleanRawTextLines(text);
      rawQuestions = detectFormatAndParse(lines);
    }

    if (rawQuestions.length === 0) {
      return {
        success: false,
        questions: [],
        error: 'Fayl yoki matn ichidan mos formatdagi savollar topilmadi. ABC, GIFT yoki Jadval formatida ekanligini tekshiring.',
      };
    }

    // Run validator
    const validation = validateQuizQuestions(rawQuestions);
    if (!validation.isValid) {
      return {
        success: false,
        questions: [],
        error: validation.error,
      };
    }

    // Default title from file name or first question
    let title = fileName.replace(/\.[^/.]+$/, '').trim();
    if (!title || title === 'test' || title === 'document') {
      title = validation.questions[0].questionText.slice(0, 40) + '...';
    }

    return {
      success: true,
      title,
      questions: validation.questions,
      error: null,
    };
  } catch (err) {
    return {
      success: false,
      questions: [],
      error: `Testni o'qishda xatolik: ${err.message}`,
    };
  }
}

export default { parseQuizInput, detectFormatAndParse };
