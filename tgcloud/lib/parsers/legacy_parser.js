// tgcloud/lib/parsers/legacy_parser.js
// Legacy format parser (?Question, +Correct answer, =Wrong answer)

export function parseLegacyFormat(lines) {
  const questions = [];
  let currentQuestion = null;
  let currentOptions = [];
  let currentCorrect = -1;

  function commit() {
    if (currentQuestion && currentQuestion.trim() && currentOptions.length >= 2) {
      questions.push({
        questionText: currentQuestion.trim(),
        options: currentOptions,
        correctOptionId: currentCorrect,
      });
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
        currentOptions.push(trimmed.slice(1).trim());
        currentCorrect = currentOptions.length - 1;
      }
    } else if (trimmed.startsWith('=')) {
      if (currentQuestion !== null) {
        currentOptions.push(trimmed.slice(1).trim());
      }
    } else if (currentOptions.length > 0) {
      currentOptions[currentOptions.length - 1] += ` ${trimmed}`;
    } else if (currentQuestion !== null) {
      currentQuestion += (currentQuestion ? ' ' : '') + trimmed;
    }
  }

  commit();
  return questions;
}

export default { parseLegacyFormat };
