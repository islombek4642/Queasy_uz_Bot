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
 * Automatically restores missing integral symbols and limits lost during OMML parsing.
 */
export function repairIntegralFormulas(text) {
  if (!text || typeof text !== 'string') return text;

  let s = text;

  // 1. Double integrals with limits pattern: e.g. $01dx1 {x}^{2} dy$ or $01dx0xdy$ or $28dy0ydx$
  s = s.replace(/\$([0-9a-zA-Z\-]+?)\s*([0-9a-zA-Z\-]+?)\s*d([xy])\s*([0-9a-zA-Z\-]+?)\s*([0-9a-zA-Z\-\{\}\^\s]+?)\s*d([xy])\$/g, (match, l1, u1, v1, l2, u2, v2) => {
    if (match.includes('\\int')) return match;
    const cleanU2 = u2.trim();
    return `$\\int_{${l1}}^{${u1}} d${v1} \\int_{${l2}}^{${cleanU2}} d${v2}$`;
  });

  // 2. Indefinite integrals: e.g. "Aniqmas integralni toping. ${8}^{3x} dx$ ;"
  if (/aniqmas\s+integral/i.test(s)) {
    s = s.replace(/\$([^\$]+?)\$/g, (match, inner) => {
      if (inner.includes('\\int') || inner.includes('∫')) return match;
      const trimmed = inner.trim();
      if (/d[xytz](\s*|\s*[\;\.\,])$/.test(trimmed) || /^\\frac\{d[xytz]\}/.test(trimmed) || /d[xytz]/.test(trimmed)) {
        return `$\\int ${trimmed}$`;
      }
      return match;
    });
  }

  // 3. Definite integrals: e.g. "Integralni hisoblang. $0 \frac{3π}{4} \frac{1}{{cos}^{2} x} dx$ ;"
  if (/integralni\s+(hisoblang|toping)/i.test(s) && !/ikki\s+karrali/i.test(s)) {
    s = s.replace(/\$(0|[0-9a-zA-Z\-]+|\\frac\{[^\}]+\}\{[^\}]+\}|[π])\s+([0-9a-zA-Z\-]+|\\frac\{[^\}]+\}\{[^\}]+\}|[π])\s+([^\$]*?d[xy][^\$]*?)\$/g, (match, l, u, expr) => {
      if (match.includes('\\int')) return match;
      return `$\\int_{${l.trim()}}^{${u.trim()}} ${expr.trim()}$`;
    });

    s = s.replace(/\$([0-9])([0-9])\s*([0-9a-zA-Z\\].*?d[xy][^\$]*?)\$/g, (match, l, u, expr) => {
      if (match.includes('\\int')) return match;
      return `$\\int_{${l}}^{${u}} ${expr.trim()}$`;
    });
  }

  return s;
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
  res = repairIntegralFormulas(res);

  return res.trim();
}

/**
 * Universal sanitization for a list of option strings.
 * Safely strips option letter prefixes (A, B, C, D) without touching person initials (М. Скобелев).
 */
export function sanitizeOptionsList(options) {
  if (!Array.isArray(options)) return [];

  // 1. Sanitize individual option texts, keeping track of structured wrappers
  const cleaned = options.map((opt) => {
    const isObject = opt && typeof opt === 'object';
    const rawText = isObject ? String(opt.text || '') : String(opt || '');

    let s = rawText;
    s = stripImageTags(s);
    s = decodeHtmlEntities(s);
    s = cleanPunctuationAndArtifacts(s, true);
    s = normalizeMathSlashes(s);
    s = cleanInvisibleCharacters(s);

    const cleanedText = s.trim();

    if (isObject) {
      return {
        ...opt,
        text: cleanedText,
      };
    }
    return cleanedText;
  });

  // Extract texts to check for prefixes
  const optionTexts = cleaned.map((o) => (typeof o === 'object' ? o.text : o));

  // 2. Check if options have letter prefixes: "A) ", "B) ", etc.
  const allHaveParenPrefix = optionTexts.every((t) => /^[a-zA-Zа-яА-ЯёЁ0-9]\)\s+/.test(t));
  if (allHaveParenPrefix) {
    return cleaned.map((o) => {
      if (typeof o === 'object') {
        return { ...o, text: o.text.replace(/^[a-zA-Zа-яА-ЯёЁ0-9]\)\s+/, '').trim() };
      }
      return o.replace(/^[a-zA-Zа-яА-ЯёЁ0-9]\)\s+/, '').trim();
    });
  }

  // Rule B: Dot prefixes like "A. ", "B. ", "C. ", "D. "
  const dotPrefixPattern = /^([a-zA-Zа-яА-ЯёЁ])\.\s+/;
  const matches = optionTexts.map((t) => dotPrefixPattern.exec(t));
  const allMatchDot = matches.every(Boolean);

  if (allMatchDot && cleaned.length >= 2) {
    const letters = matches.map((m) => m[1].toUpperCase());
    const isLatinSeq = letters[0] === 'A' && letters[1] === 'B';
    const isCyrillicSeq = (letters[0] === 'А' && letters[1] === 'Б') || (letters[0] === 'А' && letters[1] === 'В');

    if (isLatinSeq || isCyrillicSeq) {
      return cleaned.map((o) => {
        if (typeof o === 'object') {
          return { ...o, text: o.text.replace(dotPrefixPattern, '').trim() };
        }
        return o.replace(dotPrefixPattern, '').trim();
      });
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
