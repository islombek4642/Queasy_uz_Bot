// tgcloud/lib/parsers/gift_parser.js
// Robust Moodle GIFT Format Parser

export function parseGiftFormat(lines) {
  const questions = [];
  let currentQuestionLines = [];
  let insideBraces = false;
  let options = [];
  let correctId = -1;
  let explanation = null;

  function commit() {
    const questionText = currentQuestionLines.join(' ').trim();
    if (questionText && options.length >= 2 && correctId !== -1) {
      questions.push({
        questionText,
        options: [...options],
        correctOptionId: correctId,
        explanation,
      });
    }
    currentQuestionLines = [];
    options = [];
    correctId = -1;
    explanation = null;
    insideBraces = false;
  }

  function handleOptionToken(tok) {
    const trimmed = tok.trim();
    if (!trimmed) return;

    if (trimmed.startsWith('=')) {
      let text = trimmed.slice(1).trim();
      if (text.includes('#')) {
        const parts = text.split('#');
        text = parts[0].trim();
        explanation = parts[1].trim();
      }
      options.push(text);
      correctId = options.length - 1;
    } else if (trimmed.startsWith('~')) {
      let text = trimmed.slice(1).trim();
      if (text.includes('#')) {
        text = text.split('#')[0].trim();
      }
      options.push(text);
    }
  }

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (!insideBraces) {
      if (trimmed.includes('{')) {
        const parts = trimmed.split('{');
        if (parts[0].trim()) currentQuestionLines.push(parts[0].trim());
        insideBraces = true;

        const afterBrace = parts[1] || '';
        if (afterBrace.includes('}')) {
          const content = afterBrace.slice(0, afterBrace.indexOf('}'));
          content.split(/(?=[=~])/).forEach(handleOptionToken);
          commit();
        } else if (afterBrace.trim()) {
          afterBrace.split(/(?=[=~])/).forEach(handleOptionToken);
        }
      } else {
        currentQuestionLines.push(trimmed);
      }
    } else {
      if (trimmed.includes('}')) {
        const beforeClosing = trimmed.slice(0, trimmed.indexOf('}'));
        if (beforeClosing.trim()) {
          beforeClosing.split(/(?=[=~])/).forEach(handleOptionToken);
        }
        commit();
      } else {
        trimmed.split(/(?=[=~])/).forEach(handleOptionToken);
      }
    }
  }

  commit();
  return questions;
}

export default { parseGiftFormat };
