// tgcloud/lib/parsers/legacy_parser.js
// Legacy format parser (?Question, +Correct answer, =Wrong answer)

import { hasMathFormula } from './math_engine.js';

/**
 * Checks if an option is a mathematical equation or formula (e.g. "x = 5", "f(x) = 2", "a = b + c")
 */
function isMathEquationOption(text) {
  if (!text || typeof text !== 'string') return false;
  if (hasMathFormula(text)) return true;
  // Match variable assignment equations like "x = 5", "y = -2", "f(x) = 3", "a = b + c", "S = vt"
  if (/^\s*[a-zA-Zα-ωΑ-Ω](?:\([a-zA-Z0-9]+\))?\s*=\s*.+/i.test(text)) return true;
  return false;
}

export function parseLegacyFormat(lines) {
  const questions = [];
  let currentQuestion = null;
  let currentOptions = [];
  let currentCorrect = -1;

  function commit() {
    if (currentQuestion && currentQuestion.trim() && currentOptions.length >= 1) {
      // Auto-repair inline options (e.g. "+Can =couldnt =be able to" or "=faylasuflar =boylar")
      // Math guard: NEVER split options if question or option contains a mathematical formula or equation
      const isMath = hasMathFormula(currentQuestion) || currentOptions.some(isMathEquationOption);
      if (!isMath && currentOptions.length < 4 && currentOptions.some((o) => o.includes('='))) {
        const expanded = [];
        let newCorrect = currentCorrect;
        for (let i = 0; i < currentOptions.length; i++) {
          const opt = currentOptions[i];
          if (opt.includes('=') && !isMathEquationOption(opt)) {
            const parts = opt.split(/\s*=\s*/).map((p) => p.trim()).filter(Boolean);
            if (parts.length > 1) {
              if (i === currentCorrect) newCorrect = expanded.length;
              expanded.push(...parts);
              continue;
            }
          }
          if (i === currentCorrect) newCorrect = expanded.length;
          expanded.push(opt.trim());
        }
        // Strict guard: only accept if it expands cleanly to exactly 4 standard options!
        if (expanded.length === 4) {
          currentOptions = expanded;
          currentCorrect = newCorrect;
        }
      }

      if (currentOptions.length >= 2) {
        let photoFileId = null;
        const imgMatch = currentQuestion.match(/<img[^>]*src=["']([^"']+)["'][^>]*>/i);
        if (imgMatch) {
          photoFileId = imgMatch[1];
        } else {
          // If question has no image, check if an option contains an accidental question illustration
          const optsWithImg = currentOptions
            .map((o, idx) => ({ idx, match: typeof o === 'string' ? o.match(/<img[^>]*src=["']([^"']+)["'][^>]*>/i) : null }))
            .filter((x) => x.match);
          if (optsWithImg.length === 1) {
            photoFileId = optsWithImg[0].match[1];
            currentOptions[optsWithImg[0].idx] = currentOptions[optsWithImg[0].idx].replace(/<img[^>]*>/gi, '').trim();
          }
        }
        questions.push({
          questionText: currentQuestion.trim(),
          options: currentOptions,
          correctOptionId: currentCorrect,
          photoFileId: photoFileId,
        });
      }
    }
    currentQuestion = null;
    currentOptions = [];
    currentCorrect = -1;
  }

  let pendingImage = '';

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Detect standalone img lines
    if (trimmed.startsWith('<img') || trimmed.includes('<img')) {
      if (currentQuestion !== null && currentOptions.length === 0) {
        currentQuestion += ` ${trimmed}`;
        continue;
      } else if (currentQuestion === null) {
        pendingImage += (pendingImage ? ' ' : '') + trimmed;
        continue;
      }
    }

    if (/^\?+/.test(trimmed)) {
      const qText = trimmed.replace(/^\?+/, '').trim();
      if (currentOptions.length > 0) {
        commit();
        currentQuestion = (pendingImage ? `${pendingImage} ` : '') + qText;
        pendingImage = '';
      } else if (qText.length > 0) {
        if (currentQuestion === null) {
          currentQuestion = (pendingImage ? `${pendingImage} ` : '') + qText;
          pendingImage = '';
        } else {
          if (!currentQuestion) currentQuestion = qText;
          else currentQuestion += ` ${qText}`;
        }
      } else {
        if (currentQuestion === null) {
          currentQuestion = pendingImage ? `${pendingImage}` : '';
          pendingImage = '';
        } else {
          if (!currentQuestion.endsWith('?')) currentQuestion += '?';
        }
      }
    } else if (trimmed.startsWith('+')) {
      if (currentQuestion !== null) {
        if (currentCorrect >= 0 && currentOptions.length >= 2) {
          // A second '+' appeared: previous question has finished and a new question started
          commit();
          currentQuestion = 'Savol';
        }
        currentOptions.push(trimmed.slice(1).trim());
        currentCorrect = currentOptions.length - 1;
      }
    } else if (trimmed.startsWith('=')) {
      if (currentQuestion !== null) {
        if (currentOptions.length < 12) {
          currentOptions.push(trimmed.slice(1).trim());
        }
      }
    } else if (currentOptions.length > 0) {
      if (/^\?+/.test(trimmed)) {
        commit();
        currentQuestion = trimmed.replace(/^\?+/, '').trim();
      } else {
        currentOptions[currentOptions.length - 1] += ` ${trimmed}`;
      }
    } else if (currentQuestion !== null) {
      currentQuestion += (currentQuestion ? ' ' : '') + trimmed;
    }
  }

  commit();
  return questions;
}

export default { parseLegacyFormat };
