// tgcloud/lib/parsers/gift_parser.js
// Robust Moodle GIFT Format Parser

export function parseGiftFormat(linesOrText) {
  const rawText = Array.isArray(linesOrText) ? linesOrText.join('\n') : (linesOrText || '');
  if (!rawText.trim()) return [];

  // Filter out GIFT line comments (// ...)
  const filteredText = rawText
    .split(/\r?\n/)
    .filter((l) => !l.trim().startsWith('//'))
    .join('\n');

  const questions = [];
  let currentQuestionText = '';
  let insideBraces = false;
  let options = [];
  let correctId = -1;
  let explanation = null;
  let currentBraceContent = '';

  function commit() {
    let qText = currentQuestionText.trim();
    if (!qText && options.length === 0) return;

    // Handle GIFT title ::title:: question text
    const titleMatch = qText.match(/^::(.*?)::\s*([\s\S]*)$/);
    if (titleMatch) {
      const title = titleMatch[1].trim();
      const body = titleMatch[2].trim();
      qText = body || title;
    }

    // Clean up excessive whitespace
    qText = qText.replace(/\s+/g, ' ').trim();

    if (qText && options.length >= 2 && correctId !== -1) {
      questions.push({
        questionText: qText,
        options: [...options],
        correctOptionId: correctId,
        explanation,
      });
    }

    currentQuestionText = '';
    insideBraces = false;
    options = [];
    correctId = -1;
    explanation = null;
    currentBraceContent = '';
  }

  function parseOptions(content) {
    const trimmed = content.trim();
    // Support True/False questions in GIFT: {T}, {TRUE}, {F}, {FALSE}
    if (trimmed === 'T' || trimmed === 'TRUE') {
      options = ["To'g'ri", "Noto'g'ri"];
      correctId = 0;
      return;
    }
    if (trimmed === 'F' || trimmed === 'FALSE') {
      options = ["To'g'ri", "Noto'g'ri"];
      correctId = 1;
      return;
    }

    // Split on = or ~
    const tokens = content.split(/(?=[=~])/);
    for (const tok of tokens) {
      const t = tok.trim();
      if (!t) continue;
      if (t.startsWith('=')) {
        let opt = t.slice(1).trim();
        opt = opt.replace(/^%-?\d+(?:\.\d+)?%/, '').trim(); // Remove weight if any
        if (opt.includes('#')) {
          const parts = opt.split('#');
          opt = parts[0].trim();
          explanation = parts[1].trim();
        }
        options.push(opt.replace(/\s+/g, ' '));
        correctId = options.length - 1;
      } else if (t.startsWith('~')) {
        let opt = t.slice(1).trim();
        opt = opt.replace(/^%-?\d+(?:\.\d+)?%/, '').trim(); // Remove weight if any
        if (opt.includes('#')) {
          opt = opt.split('#')[0].trim();
        }
        options.push(opt.replace(/\s+/g, ' '));
      }
    }
  }

  let i = 0;
  while (i < filteredText.length) {
    if (!insideBraces) {
      const openIdx = filteredText.indexOf('{', i);
      if (openIdx === -1) {
        currentQuestionText += filteredText.slice(i);
        break;
      }
      currentQuestionText += filteredText.slice(i, openIdx);
      insideBraces = true;
      i = openIdx + 1;
    } else {
      const closeIdx = filteredText.indexOf('}', i);
      if (closeIdx === -1) {
        currentBraceContent += filteredText.slice(i);
        parseOptions(currentBraceContent);
        commit();
        break;
      }
      currentBraceContent += filteredText.slice(i, closeIdx);
      parseOptions(currentBraceContent);
      commit();
      i = closeIdx + 1;
    }
  }

  return questions;
}

export default { parseGiftFormat };
