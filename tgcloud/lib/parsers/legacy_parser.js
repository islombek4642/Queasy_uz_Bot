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
        questions.push({
          questionText: currentQuestion.trim(),
          options: currentOptions,
          correctOptionId: currentCorrect,
        });
      }
    }
    currentQuestion = null;
    currentOptions = [];
    currentCorrect = -1;
  }

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (/^\?+/.test(trimmed)) {
      const qText = trimmed.replace(/^\?+/, '').trim();
      if (currentOptions.length > 0) {
        commit();
        currentQuestion = qText;
      } else if (qText.length > 0) {
        if (currentQuestion === null) {
          currentQuestion = qText;
        } else {
          if (!currentQuestion) currentQuestion = qText;
          else currentQuestion += ` ${qText}`;
        }
      } else {
        if (currentQuestion === null) {
          currentQuestion = '';
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
