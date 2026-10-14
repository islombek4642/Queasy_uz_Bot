// tgcloud/lib/parsers/validator.js
// Intelligent question and quiz validator

import { CONFIG } from '../constants/config.js';
import { getMessage } from '../constants/messages.js';
import { truncateQuestion, truncateOption, truncateExplanation } from '../utils/poll_helpers.js';
import { sanitizeQuestionText, sanitizeOptionsList } from './sanitizer.js';

const MIN_OPTIONS = CONFIG.POLL.MIN_OPTIONS;
const MAX_OPTIONS = CONFIG.POLL.MAX_OPTIONS;
const MAX_QUESTION_LENGTH = CONFIG.POLL.MAX_QUESTION_LENGTH;
const MAX_OPTION_LENGTH = CONFIG.POLL.MAX_OPTION_LENGTH;
const MAX_EXPLANATION_LENGTH = CONFIG.POLL.MAX_EXPLANATION_LENGTH;
const QUESTION_PREVIEW_LENGTH = 40;
const MIN_QUIZ_QUESTIONS = 1;

export function validateQuestion(q, index = 1, lang = 'UZ') {
  if (!q.questionText || typeof q.questionText !== 'string' || q.questionText.trim().length === 0) {
    return {
      isValid: false,
      error: getMessage('VALIDATOR_ERR_NO_QUESTION_TEXT', lang, { index }),
    };
  }

  if (!Array.isArray(q.options) || q.options.length < MIN_OPTIONS) {
    return {
      isValid: false,
      error: getMessage('VALIDATOR_ERR_MIN_OPTIONS', lang, {
        index,
        min: MIN_OPTIONS,
        current: q.options?.length || 0,
      }),
    };
  }

  if (q.options.length > MAX_OPTIONS) {
    if (typeof q.correctOptionId === 'number' && q.correctOptionId < MAX_OPTIONS) {
      q.options = q.options.slice(0, MAX_OPTIONS);
    } else {
      return {
        isValid: false,
        error: getMessage('VALIDATOR_ERR_MAX_OPTIONS', lang, { index, max: MAX_OPTIONS }),
      };
    }
  }

  if (
    typeof q.correctOptionId !== 'number' ||
    q.correctOptionId < 0 ||
    q.correctOptionId >= q.options.length
  ) {
    return {
      isValid: false,
      error: getMessage('VALIDATOR_ERR_INVALID_CORRECT', lang, {
        index,
        snippet: q.questionText.slice(0, QUESTION_PREVIEW_LENGTH),
      }),
    };
  }

  // Telegram character limits & formatting: sanitize and truncate cleanly
  const cleanQText = sanitizeQuestionText(q.questionText);
  const cleanOptions = sanitizeOptionsList(q.options);
  const sanitizedText = truncateQuestion('', cleanQText, MAX_QUESTION_LENGTH);
  const sanitizedOptions = cleanOptions.map((opt) => truncateOption(opt, MAX_OPTION_LENGTH));
  const sanitizedExplanation = truncateExplanation(q.explanation, MAX_EXPLANATION_LENGTH) || null;

  return {
    isValid: true,
    sanitized: {
      questionText: sanitizedText,
      options: sanitizedOptions,
      correctOptionId: q.correctOptionId,
      explanation: sanitizedExplanation,
      photoFileId: q.photoFileId || null,
      photoCaption: q.photoCaption || null,
      orderIndex: index - 1,
    },
  };
}

export function validateQuizQuestions(questions, lang = 'UZ') {
  if (!Array.isArray(questions) || questions.length === 0) {
    return {
      isValid: false,
      error: getMessage('VALIDATOR_ERR_MIN_QUIZ_QUESTIONS', lang, { min: MIN_QUIZ_QUESTIONS }),
      questions: [],
    };
  }

  const candidateQuestions = questions.filter(
    (q) =>
      q &&
      typeof q.questionText === 'string' &&
      q.questionText.trim().length > 0 &&
      Array.isArray(q.options) &&
      q.options.length >= MIN_OPTIONS
  );

  const validQuestions = [];
  for (let i = 0; i < questions.length; i++) {
    const res = validateQuestion(questions[i], i + 1, lang);
    if (res.isValid) {
      res.sanitized.orderIndex = validQuestions.length;
      validQuestions.push(res.sanitized);
    }
  }

  const totalFound = candidateQuestions.length || questions.length;
  const isAnswerlessBank =
    validQuestions.length === 0 ||
    (totalFound >= 10 && validQuestions.length / totalFound < 0.25);

  if (isAnswerlessBank && totalFound > 0) {
    return {
      isValid: false,
      error: getMessage('PARSER_ERR_NO_CORRECT_ANSWERS', lang, { count: totalFound }),
      questions: [],
      foundCount: totalFound,
      noCorrectAnswers: true,
    };
  }

  if (validQuestions.length === 0) {
    return {
      isValid: false,
      error: getMessage('VALIDATOR_ERR_NO_VALID_QUESTIONS', lang),
      questions: [],
    };
  }

  return {
    isValid: true,
    error: null,
    questions: validQuestions,
    foundCount: totalFound,
  };
}

export default { validateQuestion, validateQuizQuestions };
