// tgcloud/lib/parsers/pdf_reader.js
// Pure JavaScript PDF Text Extractor
// Designed specifically for Telegram Serverless (V8 Isolate) with zero external binaries or node modules

import { inflateZlib, inflateRaw } from '../utils/unzip.js';
import { cleanRawTextLines } from './cleaner.js';

const STREAM_KW = new Uint8Array([115, 116, 114, 101, 97, 109]); // 'stream'
const ENDSTREAM_KW = new Uint8Array([101, 110, 100, 115, 116, 114, 101, 97, 109]); // 'endstream'

function findSubarray(haystack, needle, start = 0) {
  const hLen = haystack.length;
  const nLen = needle.length;
  if (nLen === 0) return 0;
  outer: for (let i = start; i <= hLen - nLen; i++) {
    for (let j = 0; j < nLen; j++) {
      if (haystack[i + j] !== needle[j]) continue outer;
    }
    return i;
  }
  return -1;
}

/**
 * Decodes PDF escaped characters in string literals: \(, \), \\, \r, \n, \t, etc.
 */
function decodePdfLiteral(str) {
  return str
    .replace(/\\([()\\])/g, '$1')
    .replace(/\\r/g, '\r')
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '\t')
    .replace(/\\([0-7]{1,3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)));
}

/**
 * Decodes hex string format <00410042> or <414243>.
 */
function decodePdfHex(hexStr) {
  const clean = hexStr.replace(/\s+/g, '');
  if (clean.length % 2 !== 0) return '';
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < clean.length; i += 2) {
    bytes[i / 2] = parseInt(clean.slice(i, i + 2), 16);
  }
  // Check if UTF-16BE (has null bytes in ASCII range)
  if (bytes.length >= 2 && bytes[0] === 0x00 && bytes[1] !== 0x00) {
    let s = '';
    for (let i = 0; i < bytes.length; i += 2) {
      s += String.fromCharCode((bytes[i] << 8) | bytes[i + 1]);
    }
    return s;
  }
  return new TextDecoder('utf-8').decode(bytes);
}

/**
 * Extracts text tokens from a decoded PDF content stream.
 */
function extractTextFromStreamContent(streamStr) {
  const extractedLines = [];

  // Match all BT ... ET (Begin Text ... End Text) blocks
  const btRegex = /BT[\s\S]*?ET/g;
  let btMatch;

  while ((btMatch = btRegex.exec(streamStr)) !== null) {
    const block = btMatch[0];

    // Regex to match:
    // 1. Literal strings: (text) Tj or ' or "
    // 2. Array of strings: [ (text1) -10 (text2) ] TJ
    // 3. Hex strings: <hex> Tj
    const tokenRegex = /(?:\(([\s\S]*?)\)\s*(?:Tj|'|")|\[([\s\S]*?)\]\s*TJ|<([0-9a-fA-F\s]+)>\s*Tj)/g;
    let tm;

    while ((tm = tokenRegex.exec(block)) !== null) {
      let segment = '';
      if (tm[1] !== undefined) {
        segment = decodePdfLiteral(tm[1]).trim();
      } else if (tm[2] !== undefined) {
        const arrContent = tm[2];
        const innerLitRegex = /\(([\s\S]*?)\)/g;
        let im;
        const parts = [];
        while ((im = innerLitRegex.exec(arrContent)) !== null) {
          parts.push(decodePdfLiteral(im[1]));
        }
        segment = parts.join('').trim();
      } else if (tm[3] !== undefined) {
        segment = decodePdfHex(tm[3]).trim();
      }

      if (segment.length > 0) {
        extractedLines.push(segment);
      }
    }
  }

  // Fallback: If no BT ... ET blocks found, scan standalone literal strings with Tj
  if (extractedLines.length === 0) {
    const fallbackRegex = /\(([\s\S]*?)\)\s*Tj/g;
    let fm;
    while ((fm = fallbackRegex.exec(streamStr)) !== null) {
      const decoded = decodePdfLiteral(fm[1]).trim();
      if (decoded.length > 0) {
        extractedLines.push(decoded);
      }
    }
  }

  return extractedLines;
}

/**
 * Extracts plain text lines from a PDF Buffer or Uint8Array.
 *
 * @param {Uint8Array|ArrayBuffer} pdfBuffer - Raw bytes of the PDF file.
 * @returns {string[]} Cleaned text lines ready for question parsing.
 * @throws {Error} If file is not a valid PDF or contains no extractable text.
 */
export function extractLinesFromPdf(pdfBuffer) {
  if (!pdfBuffer || pdfBuffer.length === 0) {
    throw new Error('PDF fayli bo\'sh.');
  }

  const rawBytes = pdfBuffer instanceof Uint8Array ? pdfBuffer : new Uint8Array(pdfBuffer);
  const latin1Decoder = new TextDecoder('latin1');
  const headerCheck = latin1Decoder.decode(rawBytes.subarray(0, 50));

  if (!headerCheck.includes('%PDF-')) {
    throw new Error('Noto\'g\'ri PDF formati: %PDF- sarlavhasi topilmadi.');
  }

  const allLines = [];
  let searchPos = 0;

  while (searchPos < rawBytes.length) {
    const sIdx = findSubarray(rawBytes, STREAM_KW, searchPos);
    if (sIdx === -1) break;

    // Stream content begins after "stream" keyword and following newline (\r\n or \n)
    let streamStart = sIdx + STREAM_KW.length;
    if (rawBytes[streamStart] === 0x0d) streamStart++; // \r
    if (rawBytes[streamStart] === 0x0a) streamStart++; // \n

    // Inspect preceding dictionary for /Filter and /Length
    const preHeaderStart = Math.max(0, sIdx - 400);
    const preHeader = latin1Decoder.decode(rawBytes.subarray(preHeaderStart, sIdx));
    const isFlate = /\/Filter\s*\/FlateDecode/i.test(preHeader) || /\/Filter\s*\[[^\]]*\/FlateDecode/i.test(preHeader);

    let streamEnd = -1;
    const lenMatch = preHeader.match(/\/Length\s+(\d+)/i);
    if (lenMatch) {
      const declaredLen = parseInt(lenMatch[1], 10);
      if (streamStart + declaredLen <= rawBytes.length) {
        streamEnd = streamStart + declaredLen;
      }
    }

    if (streamEnd === -1) {
      const endIdx = findSubarray(rawBytes, ENDSTREAM_KW, streamStart);
      if (endIdx !== -1) {
        streamEnd = endIdx;
      } else {
        streamEnd = rawBytes.length;
      }
    }

    const streamSlice = rawBytes.subarray(streamStart, streamEnd);
    searchPos = streamEnd + ENDSTREAM_KW.length;

    let decompressedStr = '';
    if (isFlate) {
      try {
        const decompBytes = inflateZlib(streamSlice);
        decompressedStr = new TextDecoder('utf-8').decode(decompBytes);
      } catch {
        try {
          const decompBytes = inflateRaw(streamSlice);
          decompressedStr = new TextDecoder('utf-8').decode(decompBytes);
        } catch {
          decompressedStr = latin1Decoder.decode(streamSlice);
        }
      }
    } else {
      decompressedStr = new TextDecoder('utf-8').decode(streamSlice);
    }

    if (
      decompressedStr &&
      (decompressedStr.includes('Tj') || decompressedStr.includes('TJ') || decompressedStr.includes('BT'))
    ) {
      const streamLines = extractTextFromStreamContent(decompressedStr);
      if (streamLines.length > 0) {
        allLines.push(...streamLines);
      }
    }
  }

  const cleaned = cleanRawTextLines(allLines.join('\n'));
  if (cleaned.length === 0) {
    throw new Error(
      'PDF_NO_TEXT: Ushbu PDF fayldan matn ajratib bo\'lmadi. Fayl faqat rasm yoki skanerlangan bo\'lishi mumkin. Iltimos, matnli PDF yoki Word (.docx) yuklang.'
    );
  }

  return cleaned;
}

export default { extractLinesFromPdf };
