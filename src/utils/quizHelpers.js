// src/utils/quizHelpers.js
// Utility helpers for client-side question preparation & option shuffling

/**
 * Shuffles question options using Fisher-Yates and returns remapped correctOptionId.
 * Preserves the actual correct answer text while changing its position (A, B, C, D).
 *
 * @param {Array<string>} options - Array of option strings
 * @param {number} correctOptionId - 0-based index of correct option
 * @returns {{ options: Array<string>, correctOptionId: number }}
 */
export function shuffleQuestionOptions(options, correctOptionId = 0) {
  if (!Array.isArray(options) || options.length < 2) {
    return {
      options: Array.isArray(options) ? [...options] : [],
      correctOptionId: 0,
    };
  }

  const safeCorrectId = Number(correctOptionId) >= 0 && Number(correctOptionId) < options.length
    ? Number(correctOptionId)
    : 0;

  const correctText = options[safeCorrectId];
  const indices = options.map((_, i) => i);

  // Fisher-Yates shuffle algorithm
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }

  const shuffledOptions = indices.map((idx) => options[idx]);
  const newCorrectId = shuffledOptions.indexOf(correctText);

  return {
    options: shuffledOptions,
    correctOptionId: newCorrectId !== -1 ? newCorrectId : 0,
  };
}

export default { shuffleQuestionOptions };
