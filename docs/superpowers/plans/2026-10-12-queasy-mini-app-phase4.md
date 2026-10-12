# Phase 4: Gamification, Achievements & Social Share Plan

Implementation plan for Phase 4 of Queasy Telegram Mini App.

## Proposed Changes

### 1. Achievements & Gamification Engine (`src/constants/achievements.js`)
- Define 8 interactive achievements with unique icons, title keys, description keys, and unlock condition evaluators:
  1. `FIRST_STEP`: Complete your first quiz
  2. `SNIPER`: 100% accuracy on any quiz
  3. `SPEED_DEMON`: Solve questions with fast average time
  4. `QUIZ_MASTER`: Complete 10+ quizzes
  5. `MISTAKE_SLAYER`: Complete mistakes training
  6. `TOP_TEN`: Reach top 10 on global leaderboard
  7. `LEVEL_FIVE`: Reach Level 5 or higher
  8. `CREATOR`: Create and publish your own quiz

### 2. Localization (UZ, RU, EN with 100% Parity)
- Add all Phase 4 keys in `src/i18n/locales/uz.js`, `ru.js`, `en.js`:
  - Achievement titles and descriptions.
  - XP progression (`XP_TO_NEXT_LEVEL`, `RANK_NOVICE`, `RANK_EXPLORER`, `RANK_SCHOLAR`, `RANK_MASTER`).
  - Share message templates for Telegram (`SHARE_RESULT_TEXT`, `BTN_SHARE_RESULT`).
  - Analytics labels (Correct answers, Wrong answers, Average accuracy).

### 3. Frontend Components & Views
- `src/components/profile/AchievementCard.jsx` / `AchievementModal.jsx`:
  - Sleek glassmorphic badge with glow effect when unlocked, locked state with padlock.
  - Modal or tooltip showing unlock criteria and XP reward.
- Update `src/views/ProfileView.jsx`:
  - Add interactive XP Progress Bar towards next level.
  - Add "Yutuqlar" (Achievements) grid with unlocked/locked indicators.
  - Add Performance Overview analytics (accuracy bar, total tests, XP rank badge).
- Update `src/components/quiz/ResultCard.jsx`:
  - Add direct "Telegramda Ulashish" (Share to Telegram) button using `https://t.me/share/url` and WebApp Haptic feedback.
- Update `src/views/HomeView.jsx`:
  - Display Level progress bar directly under user greeting card.

### 4. Verification & Deployment
- Check syntax and i18n parity.
- Run `npm run build`.
- Deploy via `npx @tgcloud/cli push`.
- Update graph with `graphify update .`.
