// tgcloud/lib/parsers/docx_reader.js
// Pure JavaScript Word .docx document extractor with Highlight & Styling detection
// Ported & optimized from testyechar & QuizBot best practices

import { extractFileFromZip } from '../utils/unzip.js';
import { cleanRawTextLines } from './cleaner.js';
import { ommlToLatex } from './math_engine.js';
import { getMessage } from '../constants/messages.js';

/**
 * Checks if run property XML contains highlight, shading, bold, or underline.
 */
function isHighlightedOrEmphasized(rPrXml) {
  if (!rPrXml) return false;

  // 1. Highlight tag: <w:highlight w:val="yellow" ... />
  const hlMatch = /<w:highlight(?:\s+[^>]*w:val="([^"]+)")?/i.exec(rPrXml);
  if (hlMatch) {
    const val = (hlMatch[1] || '').toLowerCase();
    if (val !== 'none' && val !== 'white') return true;
  }

  // 2. Shading / background fill: <w:shd w:fill="FFFF00" ... />
  const shdMatch = /<w:shd(?:\s+[^>]*w:fill="([^"]+)")?/i.exec(rPrXml);
  if (shdMatch) {
    const fill = (shdMatch[1] || '').toLowerCase();
    if (fill && fill !== 'none' && fill !== 'auto' && fill !== 'ffffff') return true;
  }

  // 3. Bold: <w:b/> or <w:b w:val="true"/> or <w:b w:val="1"/>
  const bMatch = /<w:b(?:\s+[^>]*w:val="([^"]+)")?/i.exec(rPrXml);
  if (bMatch) {
    const val = (bMatch[1] || '').toLowerCase();
    if (val !== '0' && val !== 'false' && val !== 'off') return true;
  }

  // 4. Underline: <w:u w:val="single"/>
  const uMatch = /<w:u(?:\s+[^>]*w:val="([^"]+)")?/i.exec(rPrXml);
  if (uMatch) {
    const val = (uMatch[1] || '').toLowerCase();
    if (val !== 'none' && val !== 'false') return true;
  }

  return false;
}

/**
 * Extracts plain text lines from a .docx file buffer, detecting highlighted options.
 */
export function extractLinesFromDocx(docxBuffer) {
  const xml = extractFileFromZip(docxBuffer, 'word/document.xml');
  if (!xml) {
    throw new Error(getMessage('DOCX_ERR_INVALID_FORMAT'));
  }

  const lines = [];

  // Match all paragraphs <w:p ...>...</w:p>
  const pRegex = /<w:p(?:\s[^>]*)?>([\s\S]*?)<\/w:p>/g;
  let pMatch;

  const optionStartRegex = /^[#*+]?\s*([a-fA-Fа-яА-ЯёЁ])[.)"']/;

  while ((pMatch = pRegex.exec(xml)) !== null) {
    let pContent = pMatch[1];

    // Preprocess any Word OMML math blocks into LaTeX $$ ... $$
    if (/<m:oMath/i.test(pContent)) {
      pContent = pContent.replace(/<m:oMath[^>]*>([\s\S]*?)<\/m:oMath>/gi, (match) => {
        const latex = ommlToLatex(match);
        return `<w:r><w:t> $$ ${latex} $$ </w:t></w:r>`;
      });
    }

    // Split paragraph by runs <w:r ...>...</w:r>
    const rRegex = /<w:r(?:\s[^>]*)?>([\s\S]*?)<\/w:r>/g;
    let rMatch;
    let textParts = [];
    let paragraphHasHighlight = false;

    while ((rMatch = rRegex.exec(pContent)) !== null) {
      const rContent = rMatch[1];

      // Extract run properties <w:rPr>...</w:rPr>
      const rPrMatch = /<w:rPr>([\s\S]*?)<\/w:rPr>/i.exec(rContent);
      const isRunHighlighted = rPrMatch ? isHighlightedOrEmphasized(rPrMatch[1]) : false;

      // Extract text nodes <w:t ...>text</w:t> or <m:t ...>math</m:t>
      const tRegex = /<[wm]:t(?:\s[^>]*)?>([^<]*)<\/[wm]:t>/g;
      let tm;
      let runText = '';
      while ((tm = tRegex.exec(rContent)) !== null) {
        runText += tm[1];
      }

      if (runText.length > 0) {
        if (isRunHighlighted) {
          paragraphHasHighlight = true;
        }
        textParts.push(runText);
      }
    }

    // Fallback if runs weren't standard or text was outside <w:r>
    if (textParts.length === 0) {
      const tRegex = /<[wm]:t(?:\s[^>]*)?>([^<]*)<\/[wm]:t>/g;
      let tm;
      while ((tm = tRegex.exec(pContent)) !== null) {
        textParts.push(tm[1]);
      }
    }

    let paragraphText = textParts.join('').trim();
    if (paragraphText.length > 0) {
      // If this paragraph contains highlight/bold styling and looks like an option (e.g. "B) 1441-yil"),
      // prepend '#' if it doesn't already have a correct marker
      if (
        paragraphHasHighlight &&
        optionStartRegex.test(paragraphText) &&
        !paragraphText.startsWith('#') &&
        !paragraphText.startsWith('*') &&
        !paragraphText.startsWith('+')
      ) {
        paragraphText = `#${paragraphText}`;
      }
      lines.push(paragraphText);
    }
  }

  return cleanRawTextLines(lines.join('\n'));
}

export default { extractLinesFromDocx };
