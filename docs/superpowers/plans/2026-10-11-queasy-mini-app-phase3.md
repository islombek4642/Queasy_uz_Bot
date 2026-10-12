# Phase 3: Quiz Studio & Advanced Management

Implementation plan for Phase 3 of Queasy Telegram Mini App.

## Proposed Changes

### 1. Backend Serverless Endpoints (`tgcloud/endpoints/`)
- `tgcloud/endpoints/delete_quiz.js`: Delete a quiz and its questions with ownership validation.
- `tgcloud/endpoints/update_quiz.js`: Edit an existing quiz and its questions.
- `tgcloud/endpoints/get_user_mistakes.js`: Fetch mistaken questions for targeted practice.
- Update `tgcloud/endpoints/submit_solo_result.js`: Persist failed questions into `userMistakes` table.

### 2. Frontend Services & Constants
- `src/constants/endpoints.js`: Add `EP_DELETE_QUIZ`, `EP_UPDATE_QUIZ`, `EP_GET_USER_MISTAKES`.
- `src/services/api.js`: Add mocks for Phase 3 endpoints.
- `src/services/quizService.js`: Add `deleteQuiz`, `updateQuiz`, `fetchUserMistakes`.

### 3. Frontend Views & Components
- `src/components/quiz/QuestionInspectorModal.jsx`: View all questions in a quiz with KaTeX formulas before starting.
- Update `src/components/quiz/QuizCreatorModal.jsx`: Support both creating new quiz and editing existing quiz (`initialQuiz` prop).
- Update `src/views/MyQuizzesView.jsx`: Add Edit, Delete (with confirmation modal), and Inspect buttons to each quiz card.
- Add "Xatolar ustida ishlash" (Mistakes Training) arena launcher to `HomeView.jsx` and `ProfileView.jsx`.

### 4. i18n & Zero Hardcoding
- Add all Phase 3 keys across `src/i18n/locales/uz.js`, `ru.js`, `en.js` with 100% parity.

### 5. Verification & Deployment
- Syntax and parity checks.
- Build production bundle (`npm run build`).
- Push to Telegram Serverless Cloud (`npx @tgcloud/cli push`).
- Update knowledge graph (`graphify update .`).
