// tgcloud/lib/parsers/sanitizer.js
// Production-grade text sanitizer & normalizer for Quiz questions and options
// Fixes HTML entities, embedded image tags, punctuation quirks, and formatting artifacts

const HTML_ENTITIES = {
  '&apos;': "'",
  '&#39;': "'",
  '&quot;': '"',
  '&#34;': '"',
  '&nbsp;': ' ',
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&laquo;': '«',
  '&raquo;': '»',
  '&ndash;': '-',
  '&mdash;': '-',
};

/**
 * Decodes all HTML entities into standard characters.
 */
export function decodeHtmlEntities(text) {
  if (!text || typeof text !== 'string') return '';

  let res = text;
  for (const [entity, replacement] of Object.entries(HTML_ENTITIES)) {
    res = res.replaceAll(entity, replacement);
  }

  // Handle numeric decimal entities: &#123;
  res = res.replace(/&#(\d+);/g, (_, code) => {
    try {
      return String.fromCharCode(parseInt(code, 10));
    } catch {
      return _;
    }
  });

  // Handle numeric hex entities: &#x1f;
  res = res.replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => {
    try {
      return String.fromCharCode(parseInt(hex, 16));
    } catch {
      return _;
    }
  });

  return res;
}

/**
 * Strips raw and escaped <img> tags from text.
 */
export function stripImageTags(text) {
  if (!text || typeof text !== 'string') return '';
  return text
    .replace(/&lt;img[\s\S]*?&gt;/gi, '')
    .replace(/<img[\s\S]*?>/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * Cleans weird punctuation prefixes and formatting quirks:
 *  - ",, Text”" -> "\"Text\""
 *  - ".. Text”" -> "\"Text\""
 *  - ".Bioetika..." -> "Bioetika..."
 *  - "? 1. Savol" -> "Savol"
 *  - "........" -> "..."
 */
export function cleanPunctuationAndArtifacts(text, isOption = false) {
  if (!text || typeof text !== 'string') return '';

  let res = text.trim();

  // 1. Weird opening comma/dots quotes: ,, Salib yurishlari” -> "Salib yurishlari"
  if (/^[,.]{2,}\s*/.test(res)) {
    const hasClosingQuote = /[”"»]$/.test(res);
    res = res.replace(/^[,.]{2,}\s*/, '');
    if (hasClosingQuote) {
      res = res.replace(/[”"»]$/, '');
      res = `"${res.trim()}"`;
    }
  }

  // 2. Stray leading single dot before word: .Bioetika -> Bioetika
  res = res.replace(/^\.\s*(?=[a-zA-Zа-яА-ЯёЁ])/g, '');

  // 3. Question-specific prefixes: leading '?' or '? 1. ' or '1. ' (only for questions, not options)
  if (!isOption) {
    // Strip leading '?'
    res = res.replace(/^\?+\s*/, '');

    // Strip leading number only if followed by dot/paren and space and capital/letter:
    // e.g. "1. Qadimgi" -> "Qadimgi", but keep "1992- yilda" or "2024 yil"
    res = res.replace(/^\d{1,3}[\.\)]\s+(?=[a-zA-Zа-яА-ЯёЁ"“«'`])/g, '');
  }

  // 4. Excessive dots or underscores for fill-in-the-blank
  // 5 or more dots -> standard ellipsis "..."
  res = res.replace(/\.{5,}/g, '...');
  // 5 or more underscores -> standard 3 underscores "___"
  res = res.replace(/_{5,}/g, '___');

  // 5. Clean parser tokens if leftover: "++++", "===="
  res = res.replace(/\+{4,}|={4,}/g, '').trim();

  return res;
}

/**
 * Normalizes double-escaped LaTeX math slashes (\\frac -> \frac).
 */
export function normalizeMathSlashes(text) {
  if (!text || typeof text !== 'string') return '';
  // Convert \\frac, \\sqrt, \\alpha to \frac, \sqrt, \alpha
  return text.replace(/\\\\([a-zA-Z])/g, '\\$1');
}

/**
 * Removes non-printable / zero-width characters and normalizes spaces.
 */
export function cleanInvisibleCharacters(text) {
  if (!text || typeof text !== 'string') return '';
  return text
    .replace(/[\u200B-\u200D\uFEFF\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, '')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

/**
 * Universal sanitization for a single question text.
 */
export function sanitizeQuestionText(text) {
  if (!text || typeof text !== 'string') return '';

  let res = text;
  res = stripImageTags(res);
  res = decodeHtmlEntities(res);
  res = cleanPunctuationAndArtifacts(res, false);
  res = normalizeMathSlashes(res);
  res = cleanInvisibleCharacters(res);

  return res.trim();
}

/**
 * Universal sanitization for a list of option strings.
 * Safely strips option letter prefixes (A, B, C, D) without touching person initials (М. Скобелев).
 */
export function sanitizeOptionsList(options) {
  if (!Array.isArray(options)) return [];

  // 1. Sanitize individual option texts
  const cleaned = options.map((opt) => {
    let s = String(opt || '');
    s = stripImageTags(s);
    s = decodeHtmlEntities(s);
    s = cleanPunctuationAndArtifacts(s, true);
    s = normalizeMathSlashes(s);
    s = cleanInvisibleCharacters(s);
    return s.trim();
  });

  // 2. Check if options have letter prefixes: "A) ", "B) ", etc.
  // Rule A: Parenthesis prefixes like "A)", "b)" are ALWAYS option letters (initials never use closing parenthesis!)
  const allHaveParenPrefix = cleaned.every((o) => /^[a-zA-Zа-яА-ЯёЁ0-9]\)\s+/.test(o));
  if (allHaveParenPrefix) {
    return cleaned.map((o) => o.replace(/^[a-zA-Zа-яА-ЯёЁ0-9]\)\s+/, '').trim());
  }

  // Rule B: Dot prefixes like "A. ", "B. ", "C. ", "D. "
  // Only strip if they follow sequential order A, B, C, D to avoid stripping initials like "М. Скобелев", "А. Кун"
  const dotPrefixPattern = /^([a-zA-Zа-яА-ЯёЁ])\.\s+/;
  const matches = cleaned.map((o) => dotPrefixPattern.exec(o));
  const allMatchDot = matches.every(Boolean);

  if (allMatchDot && cleaned.length >= 2) {
    const letters = matches.map((m) => m[1].toUpperCase());
    const isLatinSeq = letters[0] === 'A' && letters[1] === 'B';
    const isCyrillicSeq = (letters[0] === 'А' && letters[1] === 'Б') || (letters[0] === 'А' && letters[1] === 'В');

    if (isLatinSeq || isCyrillicSeq) {
      return cleaned.map((o) => o.replace(dotPrefixPattern, '').trim());
    }
  }

  return cleaned;
}

export default {
  decodeHtmlEntities,
  stripImageTags,
  cleanPunctuationAndArtifacts,
  normalizeMathSlashes,
  cleanInvisibleCharacters,
  sanitizeQuestionText,
  sanitizeOptionsList,
};
