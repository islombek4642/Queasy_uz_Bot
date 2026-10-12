// tgcloud/lib/parsers/abc_parser.js
// Advanced ABC Format parser with inline markers, Cyrillic/Latin letters, and end-of-text Answer Keys

// Numbered question regex (supports 1., 1), 1", №1, etc., with or without space or text on same line)
const Q_NUM_REGEX = /^(?:№|\b)?(\d{1,4})[.)"'](?:\s*(.*))?$/i;

// Option regex: A) or А) (Latin/Cyrillic), with optional *, #, + marker and optional space
const OPT_REGEX = /^[#*+]?\s*([a-fA-Fа-яА-ЯёЁ])[.)"']\s*(.+)$/;

const CORRECT_INDICATOR_REGEX = /^(?:to['']?g['']?ri\s+javob|javob|correct(?:\s+answer)?)\s*:\s*([a-fA-Fа-яА-ЯёЁ])/i;
const EXPLANATION_REGEX = /^(?:izoh|tushuntirish|yechimi?|yechim|💡|explanation|solution)\s*:\s*(.+)$/i;
const ANSWER_KEY_BLOCK_REGEX = /(?:javoblar|to['']?g['']?ri\s+javoblar|answers|keys)\s*:\s*([\s\S]+)$/i;

// Mapping Cyrillic letters to standard 0-indexed positions
const LETTER_INDEX_MAP = {
  // Latin
  A: 0, B: 1, C: 2, D: 3, E: 4, F: 5,
  // Cyrillic uppercase
  'А': 0, 'Б': 1, 'В': 2, 'Г': 3, 'Д': 4, 'Е': 5,
};

function letterToOptionIndex(letter) {
  if (!letter) return -1;
  const upper = letter.toUpperCase();
  if (LETTER_INDEX_MAP[upper] !== undefined) {
    return LETTER_INDEX_MAP[upper];
  }
  const code = upper.charCodeAt(0);
  if (code >= 65 && code <= 90) {
    return code - 65;
  }
  return -1;
}

/**
 * Extracts end-of-text answer keys (e.g. "1-A, 2-B, 3-D" or "1.A 2.B 3.C").
 */
function extractAnswerKeys(lines) {
  const fullText = lines.join('\n');
  const match = ANSWER_KEY_BLOCK_REGEX.exec(fullText);
  if (!match) return { keysMap: new Map(), remainingLines: lines };

  const rawKeys = match[1];
  const keysMap = new Map();
  const pairRegex = /(\d{1,4})\s*[-:.)]\s*([a-fA-Fа-яА-ЯёЁ])/g;
  let m;
  while ((m = pairRegex.exec(rawKeys)) !== null) {
    keysMap.set(parseInt(m[1], 10), m[2]);
  }

  // Remove the answer key lines from the bottom
  const cutIndex = lines.findIndex((l) => ANSWER_KEY_BLOCK_REGEX.test(l));
  const remaining = cutIndex !== -1 ? lines.slice(0, cutIndex) : lines;

  return { keysMap, remainingLines: remaining };
}

export function parseAbcFormat(lines) {
  const { keysMap, remainingLines } = extractAnswerKeys(lines);
  const questions = [];

  let currentQuestion = null;
  let currentOptions = [];
  let currentCorrect = -1;
  let currentExplanation = null;
  let questionNumber = 0;

  function commitQuestion() {
    if (currentQuestion && currentOptions.length >= 2) {
      // Check if external key map has the correct answer for this question number
      if (currentCorrect === -1 && keysMap.has(questionNumber)) {
        const letter = keysMap.get(questionNumber);
        const letterIndex = letterToOptionIndex(letter);
        if (letterIndex >= 0 && letterIndex < currentOptions.length) {
          currentCorrect = letterIndex;
        }
      }

      questions.push({
        questionText: currentQuestion.trim(),
        options: currentOptions,
        correctOptionId: currentCorrect,
        explanation: currentExplanation || null,
      });
    }
    currentQuestion = null;
    currentOptions = [];
    currentCorrect = -1;
    currentExplanation = null;
  }

  for (let i = 0; i < remainingLines.length; i++) {
    const line = remainingLines[i].trim();
    if (!line) continue;

    // Check for inline explanation (e.g., "Izoh: ...", "💡: ...", "Tushuntirish: ...")
    const expMatch = EXPLANATION_REGEX.exec(line);
    if (expMatch && currentQuestion !== null) {
      currentExplanation = expMatch[1].trim();
      continue;
    }

    // Check for inline answer indicator (e.g., "To'g'ri javob: B")
    const indicatorMatch = CORRECT_INDICATOR_REGEX.exec(line);
    if (indicatorMatch && currentQuestion !== null) {
      const letter = indicatorMatch[1];
      const letterIndex = letterToOptionIndex(letter);
      if (letterIndex >= 0 && letterIndex < currentOptions.length) {
        currentCorrect = letterIndex;
      }
      continue;
    }

    // Check for Question Number start (e.g., "1. Savol..." or "1.")
    const qMatch = Q_NUM_REGEX.exec(line);
    if (qMatch) {
      commitQuestion();
      questionNumber = parseInt(qMatch[1], 10);
      currentQuestion = (qMatch[2] || '').trim();
      continue;
    }

    // Check for Option line (e.g., "A) Option" or "#B) Option" or "*A) Option")
    const optMatch = OPT_REGEX.exec(line);
    if (optMatch && currentQuestion !== null) {
      let isCorrect = line.startsWith('#') || line.startsWith('*') || line.startsWith('+');
      let optText = optMatch[2].trim();

      // Check if option text starts with # or * (e.g., "A) #Javob")
      if (optText.startsWith('#') || optText.startsWith('*') || optText.startsWith('+')) {
        isCorrect = true;
        optText = optText.slice(1).trim();
      }

      // Check if option text ends with * (e.g. "A) Javob*")
      if (optText.endsWith('*')) {
        isCorrect = true;
        optText = optText.slice(0, -1).trim();
      }

      if (isCorrect) {
        currentCorrect = currentOptions.length;
      }

      currentOptions.push(optText);
      continue;
    }

    // If we have an active question, but no option marker yet, append to question stem
    if (currentQuestion !== null && currentOptions.length === 0) {
      currentQuestion = currentQuestion ? `${currentQuestion} ${line}` : line;
      continue;
    }

    // If options already started, append to last option (wrapped line)
    if (currentQuestion !== null && currentOptions.length > 0) {
      currentOptions[currentOptions.length - 1] = `${currentOptions[currentOptions.length - 1]} ${line}`;
      continue;
    }
  }

  commitQuestion();
  return questions;
}

export default { parseAbcFormat };
