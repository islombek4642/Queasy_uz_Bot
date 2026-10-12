// tgcloud/lib/parsers/validator.js
// Intelligent question and quiz validator

import { CONFIG } from '../constants/config.js';
import { truncateQuestion, truncateOption, truncateExplanation } from '../utils/poll_helpers.js';

export function validateQuestion(q, index = 1) {
  if (!q.questionText || typeof q.questionText !== 'string' || q.questionText.trim().length === 0) {
    return {
      isValid: false,
      error: `${index}-savolda savol matni topilmadi.`,
    };
  }

  if (!Array.isArray(q.options) || q.options.length < CONFIG.POLL.MIN_OPTIONS) {
    return {
      isValid: false,
      error: `${index}-savolda kamida 2 ta variant bo'lishi kerak. Hozirda: ${q.options?.length || 0} ta.`,
    };
  }

  if (q.options.length > CONFIG.POLL.MAX_OPTIONS) {
    // If correct option is within top 10, clamp to 10
    if (typeof q.correctOptionId === 'number' && q.correctOptionId < CONFIG.POLL.MAX_OPTIONS) {
      q.options = q.options.slice(0, CONFIG.POLL.MAX_OPTIONS);
    } else {
      return {
        isValid: false,
        error: `${index}-savolda variantlar soni ${CONFIG.POLL.MAX_OPTIONS} tadan oshmasligi kerak.`,
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
      error: `${index}-savolda to'g'ri javob belgilanmagan yoki noto'g'ri belgilangan. Savol: "${q.questionText.slice(0, 40)}..."`,
    };
  }

  // Telegram character limits: truncate cleanly using poll_helpers
  const sanitizedText = truncateQuestion('', q.questionText, CONFIG.POLL.MAX_QUESTION_LENGTH);
  const sanitizedOptions = q.options.map((opt) => truncateOption(opt, CONFIG.POLL.MAX_OPTION_LENGTH));
  const sanitizedExplanation = truncateExplanation(q.explanation, CONFIG.POLL.MAX_EXPLANATION_LENGTH) || null;

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
      error: 'Testda kamida 1 ta to\'g\'ri savol bo\'lishi kerak.',
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
