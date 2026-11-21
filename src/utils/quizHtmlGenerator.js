// src/utils/quizHtmlGenerator.js
// Client-side utility for triggering offline standalone HTML quiz download

import { generateQuizHtml } from '../../tgcloud/lib/templates/quiz_html_template.js';

export function downloadQuizAsHtml(quiz, questions = []) {
  if (!quiz) return;

  const html = generateQuizHtml({ quiz, questions });
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');

  const rawTitle = quiz.title || 'quiz';
  const safeTitle = rawTitle
    .replace(/[^a-zA-Z0-9а-яА-ЯёЁўқғҳЎҚҒҲ\s_-]/g, '')
    .trim()
    .replace(/\s+/g, '_')
    .slice(0, 40) || 'quiz';

  a.href = url;
  a.download = `${safeTitle}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
}

