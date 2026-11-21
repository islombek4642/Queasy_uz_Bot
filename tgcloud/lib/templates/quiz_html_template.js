// tgcloud/lib/templates/quiz_html_template.js
// Generates a 100% self-contained, standalone offline interactive HTML quiz file
import { KATEX_CSS, KATEX_JS } from './katex_bundle.js';

function escapeHtml(str = '') {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function generateQuizHtml({ quiz, questions = [] }) {
  const safeTitle = escapeHtml(quiz?.title || 'Queasy Quiz');
  const safeTimeLimit = Number(quiz?.timeLimit) > 0 ? Number(quiz.timeLimit) : 30;

  const rawQuizPayload = {
    title: quiz?.title || 'Queasy Quiz',
    timeLimit: safeTimeLimit,
    totalQuestions: questions.length,
    questions: questions.map((q, idx) => {
      const qText = q.questionText !== undefined && q.questionText !== null
        ? String(q.questionText)
        : (q.question !== undefined && q.question !== null ? String(q.question) : '');

      let correct = 0;
      if (typeof q.correct === 'number') {
        correct = q.correct;
      } else if (typeof q.correctOptionId === 'number') {
        correct = q.correctOptionId;
      }

      let options = [];
      if (Array.isArray(q.options)) {
        options = q.options.map((opt) => {
          if (typeof opt === 'object' && opt !== null) {
            return String(opt.text || opt.title || '');
          }
          return String(opt ?? '');
        });
      }

      return {
        id: q.id || idx + 1,
        question: qText,
        options,
        correct,
        explanation: q.explanation ? String(q.explanation) : '',
      };
    }),
  };

  // Safe JSON serialization preventing script tag breakout
  const rawQuizJson = JSON.stringify(rawQuizPayload).replace(/<\/script/gi, '<\\/script');

  return `<!DOCTYPE html>
<html lang="uz">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>${safeTitle} — Queasy Quiz</title>
  <style>
${KATEX_CSS}
  </style>
  <script id="katex-lib">
${KATEX_JS}
  </script>
  <style>
    :root {
      --bg: #0b0f19;
      --card-bg: rgba(22, 29, 49, 0.8);
      --card-border: rgba(255, 255, 255, 0.08);
      --text: #f1f5f9;
      --text-muted: #94a3b8;
      --accent: #6366f1;
      --accent-hover: #4f46e5;
      --accent-glow: rgba(99, 102, 241, 0.25);
      --success: #10b981;
      --success-bg: rgba(16, 185, 129, 0.15);
      --danger: #ef4444;
      --danger-bg: rgba(239, 68, 68, 0.15);
      --warning: #f59e0b;
      --warning-bg: rgba(245, 158, 11, 0.15);
      --radius: 16px;
      --radius-sm: 10px;
      --font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    }

    [data-theme="light"] {
      --bg: #f8fafc;
      --card-bg: #ffffff;
      --card-border: rgba(0, 0, 0, 0.08);
      --text: #0f172a;
      --text-muted: #64748b;
      --accent: #4f46e5;
      --accent-hover: #4338ca;
      --accent-glow: rgba(79, 70, 229, 0.15);
      --success: #059669;
      --success-bg: rgba(5, 150, 105, 0.12);
      --danger: #dc2626;
      --danger-bg: rgba(220, 38, 38, 0.12);
      --warning: #d97706;
      --warning-bg: rgba(217, 119, 6, 0.12);
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      font-family: var(--font-family);
      -webkit-tap-highlight-color: transparent;
      overflow-wrap: break-word;
      word-break: break-word;
    }

    body {
      background-color: var(--bg);
      color: var(--text);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 16px;
      transition: background-color 0.25s ease, color 0.25s ease;
    }

    .container {
      width: 100%;
      max-width: 680px;
      display: flex;
      flex-direction: column;
      gap: 16px;
      margin: 0 auto;
    }

    .app-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 14px 18px;
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: var(--radius);
      backdrop-filter: blur(16px);
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
    }

    .icon-btn {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid var(--card-border);
      color: var(--text);
      width: 36px;
      height: 36px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .icon-btn:hover {
      background: var(--accent-glow);
      border-color: var(--accent);
    }

    .progress-track {
      width: 100%;
      height: 8px;
      background: rgba(255, 255, 255, 0.08);
      border-radius: 999px;
      overflow: hidden;
      position: relative;
    }

    .progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #6366f1, #ec4899);
      border-radius: 999px;
      transition: width 0.3s ease;
    }

    .timer-badge {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid var(--card-border);
      font-weight: 700;
      font-size: 0.85rem;
    }

    .timer-warning {
      color: var(--danger);
      background: var(--danger-bg);
      border-color: var(--danger);
      animation: pulse 1s infinite;
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.6; }
    }

    .card {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: var(--radius);
      padding: 24px;
      backdrop-filter: blur(16px);
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
      display: flex;
      flex-direction: column;
      gap: 18px;
    }

    .question-meta {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .badge-pill {
      font-size: 0.75rem;
      font-weight: 700;
      color: var(--accent);
      background: var(--accent-glow);
      padding: 4px 10px;
      border-radius: 999px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .question-text {
      font-size: 1.15rem;
      font-weight: 700;
      line-height: 1.5;
      word-break: break-word;
    }

    .katex {
      color: inherit;
      font-size: 1.05em;
    }

    .katex-display-wrapper {
      margin: 8px 0;
      text-align: center;
      overflow-x: auto;
    }

    .katex-inline-wrapper {
      display: inline-block;
      vertical-align: middle;
      margin: 0 2px;
    }

    .options-grid {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .option-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 14px 16px;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid var(--card-border);
      border-radius: var(--radius-sm);
      cursor: pointer;
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      user-select: none;
    }

    .option-item:hover {
      background: rgba(255, 255, 255, 0.06);
      border-color: rgba(255, 255, 255, 0.18);
      transform: translateY(-1px);
    }

    .option-item.selected {
      background: var(--accent-glow);
      border-color: var(--accent);
      color: #fff;
    }

    .option-item.correct {
      background: var(--success-bg) !important;
      border-color: var(--success) !important;
      color: var(--success) !important;
    }

    .option-item.correct .option-letter {
      background: var(--success) !important;
      color: #fff !important;
    }

    .option-item.wrong {
      background: var(--danger-bg) !important;
      border-color: var(--danger) !important;
      color: var(--danger) !important;
    }

    .option-item.wrong .option-letter {
      background: var(--danger) !important;
      color: #fff !important;
    }

    .option-letter {
      width: 28px;
      height: 28px;
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.08);
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 800;
      font-size: 0.85rem;
      flex-shrink: 0;
    }

    .option-item.selected .option-letter {
      background: var(--accent);
      color: #fff;
    }

    .option-text {
      font-size: 0.95rem;
      line-height: 1.4;
      flex: 1;
      min-width: 0;
      overflow-wrap: anywhere;
      word-break: break-word;
    }

    .explanation-box {
      margin-top: 10px;
      padding: 12px 16px;
      border-radius: var(--radius-sm);
      background: rgba(99, 102, 241, 0.08);
      border-left: 3px solid var(--accent);
      font-size: 0.86rem;
      line-height: 1.45;
      display: none;
    }
    .explanation-box.show {
      display: block;
      animation: fadeIn 0.3s ease;
    }

    .control-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
    }

    .btn {
      padding: 12px 20px;
      border-radius: var(--radius-sm);
      font-weight: 700;
      font-size: 0.92rem;
      border: none;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      transition: all 0.2s ease;
    }

    .btn-primary {
      background: linear-gradient(135deg, #6366f1, #8b5cf6);
      color: #fff;
      box-shadow: 0 4px 14px rgba(99, 102, 241, 0.3);
    }
    .btn-primary:hover {
      box-shadow: 0 6px 18px rgba(99, 102, 241, 0.45);
      transform: translateY(-1px);
    }

    .btn-secondary {
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid var(--card-border);
      color: var(--text);
    }
    .btn-secondary:hover {
      background: rgba(255, 255, 255, 0.1);
    }

    /* Quiz Viewport Shell (Sticky Header + Scrollable Middle + Floating Footer) */
    .quiz-view-shell {
      height: calc(100vh - 32px);
      height: calc(100dvh - 32px);
      max-height: calc(100dvh - 32px);
      display: flex;
      flex-direction: column;
      gap: 12px;
      overflow: hidden;
      width: 100%;
      max-width: 680px;
      margin: 0 auto;
    }

    .app-header-fixed {
      flex-shrink: 0;
      position: sticky;
      top: 0;
      z-index: 20;
    }

    .quiz-scroll-area {
      flex: 1;
      min-height: 0;
      overflow-y: auto;
      overflow-x: hidden;
      display: flex;
      flex-direction: column;
      -webkit-overflow-scrolling: touch;
      padding-right: 4px;
    }

    .quiz-scroll-area .card {
      min-height: min-content;
    }

    .quiz-scroll-area::-webkit-scrollbar {
      width: 5px;
    }
    .quiz-scroll-area::-webkit-scrollbar-track {
      background: transparent;
    }
    .quiz-scroll-area::-webkit-scrollbar-thumb {
      background: rgba(255, 255, 255, 0.15);
      border-radius: 999px;
    }
    .quiz-scroll-area::-webkit-scrollbar-thumb:hover {
      background: var(--accent);
    }

    .floating-bar {
      flex-shrink: 0;
      position: sticky;
      bottom: 0;
      z-index: 20;
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: var(--radius);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      box-shadow: 0 -6px 24px rgba(0, 0, 0, 0.25);
      padding: 10px 14px;
    }

    /* MODAL WIZARD OVERLAY */
    .modal-overlay {
      position: fixed;
      inset: 0;
      background: rgba(11, 15, 25, 0.85);
      backdrop-filter: blur(14px);
      -webkit-backdrop-filter: blur(14px);
      z-index: 100;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
      animation: fadeIn 0.25s ease;
    }

    .modal-window {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: var(--radius);
      width: 100%;
      max-width: 540px;
      display: flex;
      flex-direction: column;
      box-shadow: 0 20px 48px rgba(0, 0, 0, 0.35);
      overflow: hidden;
      max-height: 90vh;
    }

    .modal-header {
      padding: 18px 20px;
      border-bottom: 1px solid var(--card-border);
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .modal-body {
      padding: 20px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 18px;
    }

    .modal-footer {
      padding: 16px 20px;
      border-top: 1px solid var(--card-border);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      background: rgba(0, 0, 0, 0.15);
    }

    .info-summary-box {
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid var(--card-border);
      border-radius: var(--radius-sm);
      padding: 14px 16px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      max-width: 100%;
      overflow: hidden;
    }

    .info-row {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      font-size: 0.88rem;
      min-width: 0;
      max-width: 100%;
    }

    .info-row > div {
      min-width: 0;
      flex: 1;
      overflow-wrap: anywhere;
      word-break: break-word;
    }

    #modalQuizTitle {
      font-weight: 800;
      color: var(--text);
      overflow-wrap: anywhere;
      word-break: break-word;
      line-height: 1.4;
    }

    .info-icon {
      font-size: 1.1rem;
      width: 24px;
      text-align: center;
    }

    .time-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
    }

    .time-btn {
      padding: 12px 10px;
      border-radius: var(--radius-sm);
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid var(--card-border);
      color: var(--text);
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      cursor: pointer;
      font-weight: 700;
      transition: all 0.2s ease;
    }

    .time-btn:hover {
      background: rgba(255, 255, 255, 0.08);
      border-color: rgba(255, 255, 255, 0.2);
    }

    .time-btn.active {
      background: var(--accent-glow);
      border-color: var(--accent);
      color: #fff;
    }

    .time-sub {
      font-size: 0.7rem;
      color: var(--text-muted);
      font-weight: 500;
    }

    .time-btn.active .time-sub {
      color: #e0e7ff;
    }

    .input-box {
      width: 100%;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid var(--card-border);
      border-radius: var(--radius-sm);
      padding: 11px 14px;
      color: var(--text);
      font-size: 0.95rem;
      font-weight: 600;
      outline: none;
      transition: border-color 0.2s ease;
    }

    .input-box:focus {
      border-color: var(--accent);
      box-shadow: 0 0 0 2px var(--accent-glow);
    }

    .mode-card {
      border: 1px solid var(--card-border);
      border-radius: var(--radius-sm);
      padding: 14px 16px;
      background: rgba(255, 255, 255, 0.03);
      cursor: pointer;
      transition: all 0.2s ease;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .mode-card:hover {
      background: rgba(255, 255, 255, 0.06);
    }

    .mode-card.active {
      border-color: var(--accent);
      background: var(--accent-glow);
    }

    .mode-card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .mode-title {
      font-weight: 700;
      font-size: 0.96rem;
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .radio-circle {
      width: 20px;
      height: 20px;
      border-radius: 50%;
      border: 2px solid var(--card-border);
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s ease;
    }

    .mode-card.active .radio-circle {
      border-color: var(--accent);
    }

    .radio-inner {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: var(--accent);
      opacity: 0;
      transform: scale(0.5);
      transition: all 0.2s ease;
    }

    .mode-card.active .radio-inner {
      opacity: 1;
      transform: scale(1);
    }

    .sub-config-box {
      margin-top: 4px;
      padding-top: 10px;
      border-top: 1px solid rgba(255, 255, 255, 0.08);
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .pills-row {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
    }

    .preset-pill {
      font-size: 0.75rem;
      font-weight: 700;
      padding: 5px 10px;
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid var(--card-border);
      color: var(--text);
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .preset-pill:hover {
      background: rgba(255, 255, 255, 0.12);
    }

    .preset-pill.active {
      background: var(--accent);
      color: #fff;
      border-color: var(--accent);
    }

    .results-view {
      display: none;
      animation: fadeIn 0.3s ease;
    }

    .results-view.active {
      display: flex;
    }

    .score-hero {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      gap: 12px;
      padding: 16px 0;
    }

    .score-circle {
      width: 120px;
      height: 120px;
      border-radius: 50%;
      background: conic-gradient(var(--accent) var(--score-angle, 0deg), rgba(255, 255, 255, 0.08) 0deg);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      position: relative;
      box-shadow: 0 0 30px var(--accent-glow);
    }

    .score-circle::after {
      content: "";
      position: absolute;
      inset: 8px;
      background: var(--card-bg);
      border-radius: 50%;
    }

    .score-value {
      position: relative;
      z-index: 2;
      font-size: 1.8rem;
      font-weight: 800;
      color: var(--text);
    }

    .stats-breakdown {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
      width: 100%;
      margin-top: 14px;
    }

    .stat-box {
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid var(--card-border);
      border-radius: var(--radius-sm);
      padding: 12px;
      text-align: center;
    }

    .stat-box h4 {
      font-size: 1.25rem;
      font-weight: 800;
      margin-bottom: 2px;
    }

    .stat-box p {
      font-size: 0.75rem;
      color: var(--text-muted);
      text-transform: uppercase;
      font-weight: 600;
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(6px); }
      to { opacity: 1; transform: translateY(0); }
    }

    @media print {
      body {
        background: #fff !important;
        color: #000 !important;
      }
      .app-header, .control-bar, .modal-overlay, #quizView, #reconfigureBtn, #retryMistakesBtn, #printBtn {
        display: none !important;
      }
      #resultsView {
        display: block !important;
        border: none !important;
        box-shadow: none !important;
      }
    }
  </style>
</head>
<body data-theme="dark">

  <!-- MODAL WIZARD -->
  <div id="setupModal" class="modal-overlay">
    <div class="modal-window">
      <div class="modal-header">
        <div style="display: flex; align-items: center; gap: 8px;">
          <button id="wizardBackBtn" class="icon-btn" style="width: 30px; height: 30px; display: none;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <path d="m15 18-6-6 6-6"/>
            </svg>
          </button>
          <h3 id="wizardTitle" style="font-size: 1.05rem; font-weight: 800;">
            1-bosqich: Test Sozlamalari
          </h3>
        </div>
        <span id="wizardStepBadge" class="badge-pill">1 / 2 bosqich</span>
      </div>

      <div class="modal-body">
        <!-- STEP 1 -->
        <div id="step1Container" style="display: flex; flex-direction: column; gap: 16px;">
          <div id="resumeProgressBox" style="display: none; background: var(--accent-glow); border: 1.5px solid var(--accent); border-radius: var(--radius-sm); padding: 14px; flex-direction: column; gap: 8px;">
            <div style="font-weight: 800; font-size: 0.95rem; color: var(--accent); display: flex; align-items: center; gap: 6px;">
              <span>⚡</span> <span>Davom ettirish mumkin!</span>
            </div>
            <div style="font-size: 0.84rem; color: var(--text); line-height: 1.4;">
              Siz ushbu testni oldin boshlagansiz: <b id="resumeQuestionNum">#1</b>-savolgacha (<span id="resumeAnsweredCount">0</span> ta javob belgilangan).
            </div>
            <div style="display: flex; gap: 8px; margin-top: 4px;">
              <button type="button" id="resumeQuizBtn" class="btn btn-primary" style="flex: 1; padding: 10px; font-size: 0.85rem;">
                ▶️ Kelgan joydan davom etish
              </button>
              <button type="button" id="discardResumeBtn" class="btn btn-secondary" style="padding: 10px; font-size: 0.85rem;">
                🔄 Yangidan boshlash
              </button>
            </div>
          </div>

          <div class="info-summary-box">
            <div class="info-row">
              <span class="info-icon">📌</span>
              <div style="min-width: 0; flex: 1;">
                <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; font-weight: 700;">Nomi</div>
                <div id="modalQuizTitle" style="font-weight: 800; color: var(--text); overflow-wrap: anywhere; word-break: break-word; line-height: 1.4;">
                  ${safeTitle}
                </div>
              </div>
            </div>

            <div class="info-row">
              <span class="info-icon">📊</span>
              <div>
                <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; font-weight: 700;">Savollar soni</div>
                <div id="modalQuizCount" style="font-weight: 800; color: var(--accent);">
                  ${questions.length} ta savol
                </div>
              </div>
            </div>

            <div class="info-row">
              <span class="info-icon">⏱️</span>
              <div>
                <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; font-weight: 700;">Standart vaqt</div>
                <div id="modalQuizTime" style="font-weight: 800; color: var(--text);">
                  ${safeTimeLimit} soniya
                </div>
              </div>
            </div>
          </div>

          <div>
            <label style="font-size: 0.82rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; margin-bottom: 8px; display: block;">
              ⏱️ Savol vaqtini tanlang (yoki qo'lda kiriting)
            </label>
            <div class="time-grid" id="timePresetsGrid">
              <button class="time-btn" data-time="10"><span>10s</span><span class="time-sub">Tezkor</span></button>
              <button class="time-btn" data-time="15"><span>15s</span><span class="time-sub">Tez</span></button>
              <button class="time-btn active" data-time="${safeTimeLimit}"><span>${safeTimeLimit}s</span><span class="time-sub">Standart</span></button>
              <button class="time-btn" data-time="45"><span>45s</span><span class="time-sub">Qulay</span></button>
              <button class="time-btn" data-time="60"><span>1 daq</span><span class="time-sub">Keng</span></button>
              <button class="time-btn" data-time="120"><span>2 daq</span><span class="time-sub">Batafsil</span></button>
            </div>
          </div>

          <div style="display: flex; flex-direction: column; gap: 6px;">
            <label style="font-size: 0.78rem; font-weight: 700; color: var(--text-muted);">
              Qo'shimcha qo'lda vaqt kiritish (soniya, min: 10, max: 600):
            </label>
            <div style="display: flex; align-items: center; gap: 8px;">
              <input type="number" id="customTimeInput" class="input-box" placeholder="Masalan: 30" min="10" max="600" value="${safeTimeLimit}">
              <span style="font-size: 0.85rem; font-weight: 700; color: var(--text-muted);">sekund</span>
            </div>
          </div>
        </div>

        <!-- STEP 2 -->
        <div id="step2Container" style="display: none; flex-direction: column; gap: 14px;">
          <div class="mode-card active" data-mode="full" id="modeCardFull">
            <div class="mode-card-header">
              <div class="mode-title">
                <span>📚</span>
                <span>To'liq test (Barcha savollar)</span>
              </div>
              <div class="radio-circle"><div class="radio-inner"></div></div>
            </div>
            <p style="font-size: 0.8rem; color: var(--text-muted); margin-left: 28px;">
              Barcha <b id="fullCountLabel">${questions.length} ta</b> savol tartib bilan taqdim etiladi.
            </p>
          </div>

          <div class="mode-card" data-mode="range" id="modeCardRange">
            <div class="mode-card-header">
              <div class="mode-title">
                <span>📑</span>
                <span>Oraliq test (Range)</span>
              </div>
              <div class="radio-circle"><div class="radio-inner"></div></div>
            </div>
            <p style="font-size: 0.8rem; color: var(--text-muted); margin-left: 28px;">
              Savollar oralig'ini tanlang (masalan, 1 dan 25 gacha).
            </p>

            <div class="sub-config-box" id="rangeSubConfig" style="display: none;">
              <div class="pills-row" id="rangePillsContainer"></div>
              <div style="display: flex; gap: 10px; align-items: center; margin-top: 4px;">
                <div style="flex: 1;">
                  <span style="font-size: 0.72rem; color: var(--text-muted);">Boshlanish</span>
                  <input type="number" id="rangeStartInput" class="input-box" value="1" min="1">
                </div>
                <span style="margin-top: 14px; font-weight: 800; color: var(--text-muted);">-</span>
                <div style="flex: 1;">
                  <span style="font-size: 0.72rem; color: var(--text-muted);">Tugash</span>
                  <input type="number" id="rangeEndInput" class="input-box" value="${Math.min(25, questions.length || 1)}" min="1">
                </div>
              </div>
            </div>
          </div>

          <div class="mode-card" data-mode="random" id="modeCardRandom">
            <div class="mode-card-header">
              <div class="mode-title">
                <span>🔀</span>
                <span>Tasodifiy savollar (Random)</span>
              </div>
              <div class="radio-circle"><div class="radio-inner"></div></div>
            </div>
            <p style="font-size: 0.8rem; color: var(--text-muted); margin-left: 28px;">
              Umumiy bazadan tasodifiy saralab olingan savollar.
            </p>

            <div class="sub-config-box" id="randomSubConfig" style="display: none;">
              <div class="pills-row" id="randomPillsContainer">
                <button type="button" class="preset-pill" data-rand="10">10 ta</button>
                <button type="button" class="preset-pill active" data-rand="20">20 ta</button>
                <button type="button" class="preset-pill" data-rand="30">30 ta</button>
                <button type="button" class="preset-pill" data-rand="50">50 ta</button>
              </div>
              <div style="margin-top: 4px;">
                <span style="font-size: 0.72rem; color: var(--text-muted);">Savollar soni</span>
                <input type="number" id="randomCountInput" class="input-box" value="${Math.min(20, questions.length || 1)}" min="1">
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="modal-footer">
        <button id="wizardNextBtn" class="btn btn-primary" style="flex: 1; padding: 14px;">
          <span>Keyingisi</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="m9 18 6-6-6-6"/>
          </svg>
        </button>
      </div>
    </div>
  </div>

  <!-- MAIN QUIZ INTERFACE -->
  <div class="container" id="mainAppContainer">
    <div id="quizView" class="quiz-view-shell">
      <header class="app-header app-header-fixed" id="quizHeader" style="padding: 10px 16px; gap: 14px;">
        <div style="display: flex; align-items: baseline; gap: 4px; flex-shrink: 0;">
          <span style="font-size: 0.78rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">Savol:</span>
          <span id="progressText" style="font-size: 0.95rem; font-weight: 800; color: var(--text); white-space: nowrap;">1 / ${questions.length}</span>
        </div>

        <div class="progress-track" style="flex: 1; height: 8px;">
          <div id="progressBar" class="progress-fill" style="width: 1%;"></div>
        </div>

        <div style="display: flex; align-items: center; gap: 8px; flex-shrink: 0;">
          <div id="timerBadge" class="timer-badge">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
            <span id="timerText">00:${String(safeTimeLimit).padStart(2, '0')}</span>
          </div>

          <button id="themeToggle" class="icon-btn" title="Temani almashtirish" style="width: 32px; height: 32px;">
            <svg id="themeIcon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="5"></circle>
              <path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72 1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"></path>
            </svg>
          </button>
        </div>
      </header>

      <div class="quiz-scroll-area" id="quizScrollArea">
        <main class="card">
          <div class="question-meta">
            <span class="badge-pill" id="questionCategory">Test Savoli</span>
            <span style="font-size: 0.78rem; color: var(--text-muted); font-weight: 700;" id="qIndexBadge">#1</span>
          </div>

          <h2 class="question-text" id="questionTitle">
            Yuklanmoqda...
          </h2>

          <div class="options-grid" id="optionsContainer"></div>

          <div id="explanationBox" class="explanation-box">
            <strong style="color: var(--accent);">💡 Tushuntirish:</strong>
            <span id="explanationText"></span>
          </div>
        </main>
      </div>

      <footer class="control-bar floating-bar">
        <button id="prevBtn" class="btn btn-secondary" title="Oldingi savol" style="width: 44px; height: 44px; min-width: 44px; padding: 0;">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="m15 18-6-6 6-6"/>
          </svg>
        </button>

        <button id="finishBtn" class="btn btn-secondary" style="border-color: rgba(239, 68, 68, 0.4); color: var(--danger); font-size: 0.82rem; padding: 10px 14px;">
          Yakunlash
        </button>

        <button id="nextBtn" class="btn btn-primary" style="flex: 1; max-width: 140px; height: 44px; padding: 0 16px; gap: 6px;" title="Keyingi savol">
          <span id="nextBtnText" style="display: none; font-size: 0.84rem;">Yakunlash</span>
          <svg id="nextBtnIcon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="m9 18 6-6-6-6"/>
          </svg>
        </button>
      </footer>
    </div>

    <!-- Results Screen -->
    <div id="resultsView" class="card results-view">
      <div class="score-hero">
        <div class="score-circle">
          <span class="score-value" id="finalPercent">0%</span>
          <span style="font-size: 0.72rem; color: var(--text-muted); font-weight: 700;">ANIQLIK</span>
        </div>
        <h2 style="font-size: 1.4rem; font-weight: 800;" id="resultTitle">Natija</h2>
        <p style="font-size: 0.88rem; color: var(--text-muted);">
          Sinov yakunlandi. Quyida natijalaringiz bilan tanishing:
        </p>

        <div class="stats-breakdown">
          <div class="stat-box" style="border-color: rgba(16, 185, 129, 0.3);">
            <h4 style="color: var(--success);" id="statCorrect">0</h4>
            <p>To'g'ri</p>
          </div>
          <div class="stat-box" style="border-color: rgba(239, 68, 68, 0.3);">
            <h4 style="color: var(--danger);" id="statWrong">0</h4>
            <p>Xato</p>
          </div>
          <div class="stat-box">
            <h4 style="color: var(--accent);" id="statTime">00:00</h4>
            <p>Vaqt</p>
          </div>
        </div>
      </div>

      <div style="display: flex; flex-direction: column; gap: 8px;">
        <button id="reconfigureBtn" class="btn btn-primary">
          ⚙️ Yangi rejimda qayta boshlash
        </button>
        <button id="retryMistakesBtn" class="btn btn-secondary" style="border-color: var(--danger); color: var(--danger);">
          ❌ Faqat xatolar ustida ishlash
        </button>
        <button id="printBtn" class="btn btn-secondary">
          🖨️ Chop etish / PDF saqlash
        </button>
      </div>

      <div style="margin-top: 14px; display: flex; flex-direction: column; gap: 12px;">
        <h3 style="font-size: 1rem; font-weight: 800;">Savollar tahlili</h3>
        <div id="reviewContainer" style="display: flex; flex-direction: column; gap: 10px;"></div>
      </div>
    </div>
  </div>

  <script>
    const RAW_QUIZ = ${rawQuizJson};

    function escapeHtml(str = '') {
      return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    function formatMathText(text) {
      if (!text || typeof text !== 'string') return '';

      const cleanText = text
        .replace(/&lt;img[\\s\\S]*?&gt;/gi, '')
        .replace(/<img[\\s\\S]*?>/gi, '')
        .replaceAll('&apos;', "'")
        .replaceAll('&#39;', "'")
        .replaceAll('&quot;', '"')
        .replaceAll('&#34;', '"')
        .replaceAll('&nbsp;', ' ')
        .replaceAll('&amp;', '&')
        .replaceAll('&lt;', '<')
        .replaceAll('&gt;', '>')
        .replaceAll('&laquo;', '«')
        .replaceAll('&raquo;', '»')
        .replaceAll('&ndash;', '-')
        .replaceAll('&mdash;', '-')
        .trim();

      const hasKatex = typeof window !== 'undefined' && window.katex && typeof window.katex.renderToString === 'function';

      var mathCmds = ['\\frac', '\\sqrt', '\\int', '\\sum', '\\prod', '\\alpha', '\\beta', '\\gamma', '\\partial', '\\infty', '\\pm', '\\times', '\\div'];
      var hasCmd = false;
      for (var ci = 0; ci < mathCmds.length; ci++) {
        if (cleanText.indexOf(mathCmds[ci]) !== -1) {
          hasCmd = true;
          break;
        }
      }

      let preparedText = cleanText;
      if (!preparedText.includes('$') && hasCmd) {
        preparedText = '$' + preparedText + '$';
      }

      const parts = preparedText.split(/(\\$\\$[\\s\\S]+?\\$\\$|\\$[^\\$]+?\\$)/g);

      return parts.map(function(part) {
        const isDisplay = part.startsWith('$$') && part.endsWith('$$');
        const isInline = part.startsWith('$') && part.endsWith('$');

        if (isDisplay || isInline) {
          const math = isDisplay ? part.slice(2, -2).trim() : part.slice(1, -1).trim();
          if (hasKatex) {
            try {
              const rendered = window.katex.renderToString(math, {
                displayMode: isDisplay,
                throwOnError: false
              });
              return isDisplay
                ? '<div class="katex-display-wrapper">' + rendered + '</div>'
                : '<span class="katex-inline-wrapper">' + rendered + '</span>';
            } catch (e) {
              return '<span>' + escapeHtml(part) + '</span>';
            }
          }
        }
        return escapeHtml(part);
      }).join('');
    }

    const safeStorageId = (RAW_QUIZ.id ? String(RAW_QUIZ.id) : (RAW_QUIZ.title || 'quiz')).replace(/[^a-zA-Z0-9_-]/g, '_');
    const STORAGE_KEY = 'queasy_prog_' + safeStorageId;

    function saveProgress() {
      try {
        const data = {
          currentIndex: currentIndex,
          userAnswers: userAnswers,
          selectedTimeLimit: selectedTimeLimit,
          configuredQuestions: configuredQuestions,
          startTime: startTime,
          timestamp: Date.now()
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      } catch (e) {}
    }

    function clearProgress() {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch (e) {}
    }

    function loadProgress() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        return JSON.parse(raw);
      } catch (e) {
        return null;
      }
    }

    let configuredQuestions = [];
    let selectedTimeLimit = RAW_QUIZ.timeLimit || 30;
    let selectedQuizMode = 'full';
    let rangeConfig = [1, Math.min(25, RAW_QUIZ.totalQuestions || 1)];
    let randomCountConfig = Math.min(20, RAW_QUIZ.totalQuestions || 1);

    let wizardStep = 1;
    let currentIndex = 0;
    let userAnswers = {};
    let timer = selectedTimeLimit;
    let timerInterval = null;
    let startTime = Date.now();

    const setupModal = document.getElementById('setupModal');
    const wizardTitle = document.getElementById('wizardTitle');
    const wizardStepBadge = document.getElementById('wizardStepBadge');
    const wizardBackBtn = document.getElementById('wizardBackBtn');
    const wizardNextBtn = document.getElementById('wizardNextBtn');
    const step1Container = document.getElementById('step1Container');
    const step2Container = document.getElementById('step2Container');

    const modalQuizTitle = document.getElementById('modalQuizTitle');
    const modalQuizCount = document.getElementById('modalQuizCount');
    const modalQuizTime = document.getElementById('modalQuizTime');
    const timePresetsGrid = document.getElementById('timePresetsGrid');
    const customTimeInput = document.getElementById('customTimeInput');

    const modeCardFull = document.getElementById('modeCardFull');
    const modeCardRange = document.getElementById('modeCardRange');
    const modeCardRandom = document.getElementById('modeCardRandom');
    const fullCountLabel = document.getElementById('fullCountLabel');
    const rangeSubConfig = document.getElementById('rangeSubConfig');
    const rangePillsContainer = document.getElementById('rangePillsContainer');
    const rangeStartInput = document.getElementById('rangeStartInput');
    const rangeEndInput = document.getElementById('rangeEndInput');
    const randomSubConfig = document.getElementById('randomSubConfig');
    const randomPillsContainer = document.getElementById('randomPillsContainer');
    const randomCountInput = document.getElementById('randomCountInput');

    const quizView = document.getElementById('quizView');
    const resultsView = document.getElementById('resultsView');
    const questionTitle = document.getElementById('questionTitle');
    const optionsContainer = document.getElementById('optionsContainer');
    const progressText = document.getElementById('progressText');
    const progressBar = document.getElementById('progressBar');
    const timerText = document.getElementById('timerText');
    const timerBadge = document.getElementById('timerBadge');
    const qIndexBadge = document.getElementById('qIndexBadge');
    const explanationBox = document.getElementById('explanationBox');
    const explanationText = document.getElementById('explanationText');

    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    const finishBtn = document.getElementById('finishBtn');
    const themeToggle = document.getElementById('themeToggle');

    function initWizard() {
      const resumeProgressBox = document.getElementById('resumeProgressBox');
      const resumeQuestionNum = document.getElementById('resumeQuestionNum');
      const resumeAnsweredCount = document.getElementById('resumeAnsweredCount');
      const resumeQuizBtn = document.getElementById('resumeQuizBtn');
      const discardResumeBtn = document.getElementById('discardResumeBtn');

      const saved = loadProgress();
      if (saved && typeof saved.currentIndex === 'number' && saved.configuredQuestions && saved.configuredQuestions.length > 0 && Object.keys(saved.userAnswers || {}).length > 0) {
        if (resumeProgressBox) {
          resumeProgressBox.style.display = 'flex';
          if (resumeQuestionNum) resumeQuestionNum.textContent = '#' + (saved.currentIndex + 1);
          if (resumeAnsweredCount) resumeAnsweredCount.textContent = Object.keys(saved.userAnswers).length;
        }
      }

      if (resumeQuizBtn) {
        resumeQuizBtn.addEventListener('click', () => {
          const savedData = loadProgress();
          if (savedData && savedData.configuredQuestions && savedData.configuredQuestions.length > 0) {
            configuredQuestions = savedData.configuredQuestions;
            currentIndex = savedData.currentIndex || 0;
            userAnswers = savedData.userAnswers || {};
            selectedTimeLimit = savedData.selectedTimeLimit || selectedTimeLimit;
            startTime = savedData.startTime || Date.now();

            setupModal.style.display = 'none';
            resultsView.classList.remove('active');
            quizView.style.display = 'flex';
            renderQuestion();
          }
        });
      }

      if (discardResumeBtn) {
        discardResumeBtn.addEventListener('click', () => {
          clearProgress();
          if (resumeProgressBox) resumeProgressBox.style.display = 'none';
        });
      }

      modalQuizTitle.textContent = RAW_QUIZ.title;
      modalQuizCount.textContent = \`\${RAW_QUIZ.totalQuestions} ta savol\`;
      modalQuizTime.textContent = \`\${RAW_QUIZ.timeLimit} soniya\`;
      fullCountLabel.textContent = \`\${RAW_QUIZ.totalQuestions} ta\`;
      rangeEndInput.max = RAW_QUIZ.totalQuestions;
      rangeEndInput.value = Math.min(25, RAW_QUIZ.totalQuestions);
      randomCountInput.max = RAW_QUIZ.totalQuestions;

      timePresetsGrid.querySelectorAll('.time-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          timePresetsGrid.querySelectorAll('.time-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          const tVal = Number(btn.dataset.time);
          selectedTimeLimit = tVal;
          customTimeInput.value = tVal;
        });
      });

      customTimeInput.addEventListener('input', (e) => {
        let val = Number(e.target.value);
        if (val > 600) val = 600;
        selectedTimeLimit = Math.max(10, val || 30);
        timePresetsGrid.querySelectorAll('.time-btn').forEach(b => {
          b.classList.toggle('active', Number(b.dataset.time) === selectedTimeLimit);
        });
      });

      const totalQ = RAW_QUIZ.totalQuestions;
      const chunkSize = 25;
      rangePillsContainer.innerHTML = '';
      for (let i = 0; i < totalQ; i += chunkSize) {
        const start = i + 1;
        const end = Math.min(i + chunkSize, totalQ);
        const pill = document.createElement('button');
        pill.type = 'button';
        pill.className = 'preset-pill' + (i === 0 ? ' active' : '');
        pill.textContent = \`\${start}-\${end}\`;
        pill.dataset.start = start;
        pill.dataset.end = end;
        pill.addEventListener('click', () => {
          rangePillsContainer.querySelectorAll('.preset-pill').forEach(p => p.classList.remove('active'));
          pill.classList.add('active');
          rangeStartInput.value = start;
          rangeEndInput.value = end;
          rangeConfig = [start, end];
        });
        rangePillsContainer.appendChild(pill);
      }

      rangeStartInput.addEventListener('input', () => {
        rangeConfig[0] = Math.max(1, Number(rangeStartInput.value) || 1);
        rangePillsContainer.querySelectorAll('.preset-pill').forEach(p => p.classList.remove('active'));
      });
      rangeEndInput.addEventListener('input', () => {
        rangeConfig[1] = Math.min(totalQ, Math.max(1, Number(rangeEndInput.value) || totalQ));
        rangePillsContainer.querySelectorAll('.preset-pill').forEach(p => p.classList.remove('active'));
      });

      randomPillsContainer.querySelectorAll('.preset-pill').forEach(p => {
        p.addEventListener('click', () => {
          randomPillsContainer.querySelectorAll('.preset-pill').forEach(btn => btn.classList.remove('active'));
          p.classList.add('active');
          const count = Math.min(totalQ, Number(p.dataset.rand));
          randomCountInput.value = count;
          randomCountConfig = count;
        });
      });

      randomCountInput.addEventListener('input', (e) => {
        let val = Number(e.target.value) || 1;
        randomCountConfig = Math.min(totalQ, Math.max(1, val));
        randomPillsContainer.querySelectorAll('.preset-pill').forEach(p => {
          p.classList.toggle('active', Number(p.dataset.rand) === randomCountConfig);
        });
      });

      function selectMode(mode) {
        selectedQuizMode = mode;
        modeCardFull.classList.toggle('active', mode === 'full');
        modeCardRange.classList.toggle('active', mode === 'range');
        modeCardRandom.classList.toggle('active', mode === 'random');
        rangeSubConfig.style.display = mode === 'range' ? 'flex' : 'none';
        randomSubConfig.style.display = mode === 'random' ? 'flex' : 'none';
      }

      modeCardFull.addEventListener('click', () => selectMode('full'));
      modeCardRange.addEventListener('click', () => selectMode('range'));
      modeCardRandom.addEventListener('click', () => selectMode('random'));

      wizardNextBtn.addEventListener('click', () => {
        if (wizardStep === 1) {
          const customVal = Number(customTimeInput.value);
          if (customVal && customVal >= 10 && customVal <= 600) {
            selectedTimeLimit = customVal;
          }
          wizardStep = 2;
          wizardTitle.textContent = "2-bosqich: Test Rejimi";
          wizardStepBadge.textContent = "2 / 2 bosqich";
          step1Container.style.display = 'none';
          step2Container.style.display = 'flex';
          wizardBackBtn.style.display = 'flex';
          wizardNextBtn.querySelector('span').textContent = "🚀 Testni boshlash";
        } else if (wizardStep === 2) {
          startConfiguredQuiz();
        }
      });

      wizardBackBtn.addEventListener('click', () => {
        wizardStep = 1;
        wizardTitle.textContent = "1-bosqich: Test Sozlamalari";
        wizardStepBadge.textContent = "1 / 2 bosqich";
        step1Container.style.display = 'flex';
        step2Container.style.display = 'none';
        wizardBackBtn.style.display = 'none';
        wizardNextBtn.querySelector('span').textContent = "Keyingisi";
      });
    }

    function startConfiguredQuiz() {
      let pool = [...RAW_QUIZ.questions];

      if (selectedQuizMode === 'range') {
        const start = Math.max(1, rangeConfig[0]);
        const end = Math.min(pool.length, rangeConfig[1]);
        configuredQuestions = pool.slice(start - 1, end);
      } else if (selectedQuizMode === 'random') {
        const count = Math.min(pool.length, randomCountConfig);
        for (let i = pool.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [pool[i], pool[j]] = [pool[j], pool[i]];
        }
        configuredQuestions = pool.slice(0, count);
      } else {
        configuredQuestions = pool;
      }

      if (configuredQuestions.length === 0) {
        configuredQuestions = pool;
      }

      currentIndex = 0;
      userAnswers = {};
      timer = selectedTimeLimit;
      startTime = Date.now();
      clearProgress();
      saveProgress();

      setupModal.style.display = 'none';
      resultsView.classList.remove('active');
      quizView.style.display = 'flex';

      renderQuestion();
    }

    function startTimer() {
      clearInterval(timerInterval);
      timer = selectedTimeLimit;
      updateTimerDisplay();

      timerInterval = setInterval(() => {
        timer--;
        updateTimerDisplay();
        if (timer <= 0) {
          clearInterval(timerInterval);
          nextQuestion();
        }
      }, 1000);
    }

    function updateTimerDisplay() {
      const mins = Math.floor(timer / 60).toString().padStart(2, '0');
      const secs = (timer % 60).toString().padStart(2, '0');
      timerText.textContent = \`\${mins}:\${secs}\`;
      if (timer <= 5) {
        timerBadge.classList.add('timer-warning');
      } else {
        timerBadge.classList.remove('timer-warning');
      }
    }

    function renderQuestion() {
      const scrollArea = document.getElementById('quizScrollArea');
      if (scrollArea) scrollArea.scrollTop = 0;

      const q = configuredQuestions[currentIndex];
      questionTitle.innerHTML = formatMathText(q.question);
      qIndexBadge.textContent = \`#\${currentIndex + 1}\`;
      progressText.textContent = \`\${currentIndex + 1} / \${configuredQuestions.length}\`;
      progressBar.style.width = \`\${((currentIndex + 1) / configuredQuestions.length) * 100}%\`;

      prevBtn.style.visibility = currentIndex === 0 ? 'hidden' : 'visible';

      const isLast = currentIndex === configuredQuestions.length - 1;
      const nextBtnText = document.getElementById('nextBtnText');
      const nextBtnIcon = document.getElementById('nextBtnIcon');
      if (isLast) {
        if (nextBtnText) {
          nextBtnText.textContent = "Yakunlash";
          nextBtnText.style.display = "inline";
        }
        if (nextBtnIcon) {
          nextBtnIcon.innerHTML = '<polyline points="20 6 9 17 4 12"/>';
        }
      } else {
        if (nextBtnText) {
          nextBtnText.style.display = "none";
        }
        if (nextBtnIcon) {
          nextBtnIcon.innerHTML = '<path d="m9 18 6-6-6-6"/>';
        }
      }

      optionsContainer.innerHTML = '';
      const selectedAns = userAnswers[currentIndex];
      const hasAnswered = selectedAns !== undefined;

      q.options.forEach((opt, idx) => {
        const item = document.createElement('div');
        item.className = 'option-item';
        const letter = String.fromCharCode(65 + idx);

        if (selectedAns === idx) {
          item.classList.add('selected');
        }

        if (hasAnswered) {
          if (idx === q.correct) {
            item.classList.add('correct');
          } else if (selectedAns === idx) {
            item.classList.add('wrong');
          }
        }

        const optHtml = formatMathText(opt);

        item.innerHTML = \`
          <div class="option-letter">\${letter}</div>
          <div class="option-text">\${optHtml}</div>
        \`;

        item.addEventListener('click', () => {
          if (hasAnswered) return;
          userAnswers[currentIndex] = idx;
          saveProgress();
          renderQuestion();
        });

        optionsContainer.appendChild(item);
      });

      if (hasAnswered && q.explanation) {
        explanationText.innerHTML = formatMathText(q.explanation);
        explanationBox.classList.add('show');
      } else {
        explanationBox.classList.remove('show');
      }

      if (!hasAnswered) {
        startTimer();
      } else {
        clearInterval(timerInterval);
      }
    }

    function nextQuestion() {
      if (currentIndex < configuredQuestions.length - 1) {
        currentIndex++;
        saveProgress();
        renderQuestion();
      } else {
        finishQuiz();
      }
    }

    prevBtn.addEventListener('click', () => {
      if (currentIndex > 0) {
        currentIndex--;
        saveProgress();
        renderQuestion();
      }
    });

    nextBtn.addEventListener('click', nextQuestion);
    finishBtn.addEventListener('click', () => {
      if (confirm("Haqiqatan ham testni yakunlamoqchimisiz?")) {
        finishQuiz();
      }
    });

    function finishQuiz() {
      clearInterval(timerInterval);
      clearProgress();
      quizView.style.display = 'none';
      resultsView.classList.add('active');

      const total = configuredQuestions.length;
      let correct = 0;
      configuredQuestions.forEach((q, idx) => {
        if (userAnswers[idx] === q.correct) correct++;
      });
      const wrong = total - correct;
      const percent = total > 0 ? Math.round((correct / total) * 100) : 0;

      document.getElementById('finalPercent').textContent = \`\${percent}%\`;
      document.getElementById('statCorrect').textContent = correct;
      document.getElementById('statWrong').textContent = wrong;

      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      const m = Math.floor(elapsed / 60).toString().padStart(2, '0');
      const s = (elapsed % 60).toString().padStart(2, '0');
      document.getElementById('statTime').textContent = \`\${m}:\${s}\`;

      const reviewContainer = document.getElementById('reviewContainer');
      reviewContainer.innerHTML = '';
      configuredQuestions.forEach((q, idx) => {
        const isRight = userAnswers[idx] === q.correct;
        const div = document.createElement('div');
        div.style.cssText = \`padding: 12px; border-radius: 10px; background: rgba(255,255,255,0.03); border: 1px solid \${isRight ? 'var(--success)' : 'var(--danger)'};\`;
        div.innerHTML = \`
          <div style="font-weight: 700; font-size: 0.9rem; margin-bottom: 6px;">\${idx + 1}. \${formatMathText(q.question)}</div>
          <div style="font-size: 0.82rem; color: \${isRight ? 'var(--success)' : 'var(--danger)'};">
            Sizning javobingiz: \${userAnswers[idx] !== undefined ? formatMathText(q.options[userAnswers[idx]]) : "Belgilanmagan"}
          </div>
          \${!isRight ? \`<div style="font-size: 0.82rem; color: var(--success); margin-top: 2px;">To'g'ri javob: \${formatMathText(q.options[q.correct])}</div>\` : ''}
        \`;
        reviewContainer.appendChild(div);
      });
    }

    document.getElementById('reconfigureBtn').addEventListener('click', () => {
      wizardStep = 1;
      wizardTitle.textContent = "1-bosqich: Test Sozlamalari";
      wizardStepBadge.textContent = "1 / 2 bosqich";
      step1Container.style.display = 'flex';
      step2Container.style.display = 'none';
      wizardBackBtn.style.display = 'none';
      wizardNextBtn.querySelector('span').textContent = "Keyingisi";
      setupModal.style.display = 'flex';
    });

    document.getElementById('retryMistakesBtn').addEventListener('click', () => {
      const mistakes = configuredQuestions.filter((q, idx) => userAnswers[idx] !== q.correct);
      if (mistakes.length === 0) {
        alert("Tabriklaymiz! Sizda birorta ham xato yo'q!");
        return;
      }
      configuredQuestions = mistakes;
      currentIndex = 0;
      userAnswers = {};
      startTime = Date.now();
      resultsView.classList.remove('active');
      quizView.style.display = 'flex';
      renderQuestion();
    });

    document.getElementById('printBtn').addEventListener('click', () => {
      window.print();
    });

    themeToggle.addEventListener('click', () => {
      const currentTheme = document.body.getAttribute('data-theme');
      const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
      document.body.setAttribute('data-theme', newTheme);
    });

    initWizard();
  </script>
</body>
</html>`;
}

