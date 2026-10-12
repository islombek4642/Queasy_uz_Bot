# Phase 2: Group Host Hub, Live Leaderboard & Mini App Quiz Creator

Implementation plan for Phase 2 of Queasy Telegram Mini App.

## Proposed Changes

### 1. Constants & Endpoints
- `src/constants/endpoints.js`:
  - `EP_GET_LEADERBOARD = 'get_leaderboard'`
  - `EP_GET_GROUP_SESSIONS = 'get_group_sessions'`
  - `EP_SAVE_CUSTOM_QUIZ = 'save_custom_quiz'`
- `src/i18n/locales/uz.js`, `ru.js`, `en.js`:
  - Add keys for Leaderboard (podium, weekly/all time tabs, rank labels).
  - Add keys for Group Host (active sessions, launch in group guide, group link).
  - Add keys for Quiz Creator (quiz title, question prompt, option placeholders, correct option selector, save button, time limit).

### 2. Backend Serverless Endpoints (`tgcloud/endpoints/`)
- `tgcloud/endpoints/get_leaderboard.js`:
  - Compute top 20 players by XP / correct answers from `quizSessions` and `users`.
  - Return rankings with medal ranks (1, 2, 3), XP, level, accuracy.
- `tgcloud/endpoints/get_group_sessions.js`:
  - Fetch active group quiz sessions (`quizSessions` where `isActive = 1`).
  - Provide group launch URLs (`t.me/Queasy_uz_Bot?startgroup=quiz_<id>`).
- `tgcloud/endpoints/save_custom_quiz.js`:
  - Insert new quiz and questions into SQLite database schema (`quizzes` and `questions`).

### 3. Frontend Views & Components
- `src/views/LeaderboardView.jsx`:
  - Top 3 Podium (Gold, Silver, Bronze) with Avatars, crowns, and animations.
  - Ranked list for #4 to #20 with user rank highlight.
  - Timeframe switch (Weekly / All Time).
- `src/views/GroupHostView.jsx`:
  - Active group sessions monitor (live participant count, question progress).
  - One-click "Guruhda Boshlash" modal with deep links to share into groups.
  - Step-by-step interactive host guide.
- `src/components/quiz/QuizCreatorModal.jsx`:
  - Visual interactive quiz builder: Title, time limit, questions, 4 options each, correct answer picker.
  - Saves directly to SQLite database via `save_custom_quiz`.
- Update `src/views/HomeView.jsx` and `src/views/MyQuizzesView.jsx`:
  - Connect "+ Yangi test yaratish" buttons to open `QuizCreatorModal`.

### 4. Verification & Deployment
- Syntax checks (`node tests/test_syntax.mjs`).
- i18n parity check across UZ, RU, EN.
- Vite build (`npm run build`).
- Deploy to Telegram Serverless Cloud (`npx @tgcloud/cli push`).
- Update graph (`graphify update .`).
