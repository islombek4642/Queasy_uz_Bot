// tgcloud/lib/parsers/legacy_parser.js
// Legacy format parser (?Question, +Correct answer, =Wrong answer)

export function parseLegacyFormat(lines) {
  const questions = [];
  let currentQuestion = null;
  let currentOptions = [];
  let currentCorrect = -1;

  function commit() {
    if (currentQuestion && currentOptions.length >= 2 && currentCorrect !== -1) {
      questions.push({
        questionText: currentQuestion,
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

    if (trimmed.startsWith('?')) {
      commit();
      currentQuestion = trimmed.slice(1).trim();
    } else if (trimmed.startsWith('+')) {
      if (currentQuestion) {
        currentOptions.push(trimmed.slice(1).trim());
        currentCorrect = currentOptions.length - 1;
      }
    } else if (trimmed.startsWith('=')) {
      if (currentQuestion) {
        currentOptions.push(trimmed.slice(1).trim());
      }
    } else if (currentOptions.length > 0) {
      currentOptions[currentOptions.length - 1] += ` ${trimmed}`;
    } else if (currentQuestion) {
      currentQuestion += ` ${trimmed}`;
    }
  }

  commit();
  return questions;
}

export default { parseLegacyFormat };
