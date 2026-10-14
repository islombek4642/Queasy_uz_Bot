// tgcloud/lib/parsers/validator.js
// Intelligent question and quiz validator

import { CONFIG } from '../constants/config.js';
import { truncateQuestion, truncateOption, truncateExplanation } from '../utils/poll_helpers.js';
import { sanitizeQuestionText, sanitizeOptionsList } from './sanitizer.js';

const MIN_OPTIONS = CONFIG.POLL.MIN_OPTIONS;
const MAX_OPTIONS = CONFIG.POLL.MAX_OPTIONS;
const MAX_QUESTION_LENGTH = CONFIG.POLL.MAX_QUESTION_LENGTH;
const MAX_OPTION_LENGTH = CONFIG.POLL.MAX_OPTION_LENGTH;
const MAX_EXPLANATION_LENGTH = CONFIG.POLL.MAX_EXPLANATION_LENGTH;
const QUESTION_PREVIEW_LENGTH = 40;
const MIN_QUIZ_QUESTIONS = 1;

export function validateQuestion(q, index = 1) {
  if (!q.questionText || typeof q.questionText !== 'string' || q.questionText.trim().length === 0) {
    return {
      isValid: false,
      error: `${index}-savolda savol matni topilmadi.`,
    };
  }

  if (!Array.isArray(q.options) || q.options.length < MIN_OPTIONS) {
    return {
      isValid: false,
      error: `${index}-savolda kamida ${MIN_OPTIONS} ta variant bo'lishi kerak. Hozirda: ${q.options?.length || 0} ta.`,
    };
  }

  if (q.options.length > MAX_OPTIONS) {
    // If correct option is within top MAX_OPTIONS, clamp to MAX_OPTIONS
    if (typeof q.correctOptionId === 'number' && q.correctOptionId < MAX_OPTIONS) {
      q.options = q.options.slice(0, MAX_OPTIONS);
    } else {
      return {
        isValid: false,
        error: `${index}-savolda variantlar soni ${MAX_OPTIONS} tadan oshmasligi kerak.`,
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
      error: `${index}-savolda to'g'ri javob belgilanmagan yoki noto'g'ri belgilangan. Savol: "${q.questionText.slice(0, QUESTION_PREVIEW_LENGTH)}..."`,
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

export function validateQuizQuestions(questions) {
  if (!Array.isArray(questions) || questions.length === 0) {
    return {
      isValid: false,
      error: `Testda kamida ${MIN_QUIZ_QUESTIONS} ta to'g'ri savol bo'lishi kerak.`,
      questions: [],
    };
  }

  const validQuestions = [];
  for (let i = 0; i < questions.length; i++) {
    const res = validateQuestion(questions[i], i + 1);
    if (res.isValid) {
      res.sanitized.orderIndex = validQuestions.length;
      validQuestions.push(res.sanitized);
    }
  }

  if (validQuestions.length === 0) {
    return {
      isValid: false,
      error: 'Testda birorta ham yaroqli savol topilmadi.',
      questions: [],
    };
  }

  return {
    isValid: true,
    error: null,
    questions: validQuestions,
  };
}

export default { validateQuestion, validateQuizQuestions };
