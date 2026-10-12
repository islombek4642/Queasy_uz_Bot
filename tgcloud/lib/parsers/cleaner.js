// tgcloud/lib/parsers/cleaner.js
// Advanced text cleaning, line repairing, and normalisation pipeline
// Merges best practices from QuizBot & testyechar

const QUOTE_MAP = {
  '\u2018': "'", // LEFT SINGLE QUOTATION MARK
  '\u2019': "'", // RIGHT SINGLE QUOTATION MARK
  '\u201a': "'",
  '\u201b': "'",
  '`': "'",
  '´': "'",
  'ʻ': "'",
  'ʼ': "'",
  '«': '"',
  '»': '"',
};

const DASH_MAP = {
  '–': '-', // en-dash
  '—': '-', // em-dash
  '―': '-',
  '−': '-', // minus sign
};

/**
 * Normalizes spaced separator lines like "+ + + +" or "= = = =".
 */
export function preprocessSpacedSeparators(text) {
  if (!text) return '';
  return text
    .split(/\r?\n/)
    .map((line) => {
      const trimmed = line.trim();
      // Match 3 or more '+' separated by spaces: "+ + + +"
      if (/^\+(\s+\+){2,}\s*$/.test(trimmed)) {
        return '++++';
      }
      // Match 3 or more '=' separated by spaces: "= = = ="
      if (/^=(\s+=){2,}\s*$/.test(trimmed)) {
        return '====';
      }
      return line;
    })
    .join('\n');
}

/**
 * Splits lines where another question was glued directly to the end of an option with no newline.
 * E.g. "B) Javob ikkiQuyidagi so'zlardan qaysi biri ot?"
 */
export function splitGluedQuestions(text) {
  if (!text) return '';
  // Pattern: lowercase letter / closing parenthesis directly followed by capitalized question start with multiple words ending in '?'
  // We do NOT split on dots (.) because numbered questions like "1.Question" should stay intact!
  const gluedRegex = /([a-zа-яёʻʼ\)])([A-ZА-ЯЁ]\S*(?:\s+\S+){2,}\?)/g;
  return text.replace(gluedRegex, '$1\n$2');
}

/**
 * Normalizes Uzbek apostrophes (o', g', O', G') and Unicode quotes/dashes.
 */
export function normalizeUzbekApostrophes(text) {
  if (!text) return '';
  let res = text;
  for (const [k, v] of Object.entries(QUOTE_MAP)) {
    res = res.replaceAll(k, v);
  }
  for (const [k, v] of Object.entries(DASH_MAP)) {
    res = res.replaceAll(k, v);
  }
  // Standardize multiple spaces
  res = res.replace(/[ \t]+/g, ' ');
  return res.trim();
}

/**
 * Strips exam headers, metadata headers, and page numbering.
 */
export function stripExamHeadersAndPageNumbers(lines) {
  const result = [];
  const headerPatterns = [
    /^(?:buxoro|toshkent|samarqand|farg['']ona|andijon|namangan|xorazm)\s+davlat/i,
    /^(?:universiteti|instituti|akademiyasi|litseyi|maktabi)/i,
    /^(?:fan|fanidan|mavzu|variant|imtihon|test|nazorat)\s*:\s*/i,
    /^(?:1|2|3|4|5|6|7|8|9|10)-variant\b/i,
    /^(?:bet|sahifa|page)\s*\d+$/i,
    /^\d+\s*-\s*(?:bet|sahifa)$/i,
    /^\s*\d+\s*$/, // Standalone page numbers
  ];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const isHeader = headerPatterns.some((pattern) => pattern.test(trimmed));
    if (!isHeader) {
      result.push(trimmed);
    }
  }
  return result;
}

/**
 * Fixes broken line joins where a question or option sentence was wrapped across multiple lines.
 */
export function fixBrokenLineJoins(lines) {
  const result = [];
  const itemStartPattern = /^(?:\d{1,4}[.)"']|#?[*+]?[a-fA-Fа-яА-Я][.)"']|====|\+\+\+\+|\?|\+|\=|\{|~|to['']?g['']?ri|javob|correct|answers?)/i;

  for (let i = 0; i < lines.length; i++) {
    const current = lines[i].trim();
    if (!current) continue;

    if (result.length === 0) {
      result.push(current);
      continue;
    }

    const prev = result[result.length - 1];

    // If current line begins with a new question or option marker, keep it separate
    if (itemStartPattern.test(current)) {
      result.push(current);
      continue;
    }

    // If previous line does NOT end with sentence terminator and current is a continuation
    const endsWithTerminator = /[.!?:;]$/.test(prev) || prev === '====' || prev === '++++';
    if (!endsWithTerminator && !itemStartPattern.test(current)) {
      // Join to previous line
      result[result.length - 1] = `${prev} ${current}`;
    } else {
      result.push(current);
    }
  }

  return result;
}

/**
 * Clean and normalize a full list of raw text lines.
 */
export function cleanRawTextLines(text) {
  if (!text) return [];
  const preprocessed = preprocessSpacedSeparators(splitGluedQuestions(text));
  const rawLines = preprocessed
    .split(/\r?\n/)
    .map((l) => normalizeUzbekApostrophes(l))
    .filter((l) => l.length > 0);

  const withoutHeaders = stripExamHeadersAndPageNumbers(rawLines);
  return fixBrokenLineJoins(withoutHeaders);
}

export default {
  preprocessSpacedSeparators,
  splitGluedQuestions,
  normalizeUzbekApostrophes,
  stripExamHeadersAndPageNumbers,
  fixBrokenLineJoins,
  cleanRawTextLines,
};
