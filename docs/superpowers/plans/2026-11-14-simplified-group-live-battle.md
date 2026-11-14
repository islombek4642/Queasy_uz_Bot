# Simplified Group Live Battle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a streamlined, synchronous Live Battle group quiz mode with a 2-step setup wizard modal, zero-PIN direct Telegram links, anti-cheat question delivery, and a celebratory podium.

**Architecture:**
1. Frontend Wizard: 2-step modal in `QuizModeModal.jsx` (Step 1: Scope with Full auto-advance; Step 2: Time limit presets `10s, 15s, 30s, 45s, 60s, 120s`).
2. Frontend Navigation: Clean up `GroupHostView.jsx` and quiz cards to offer one primary «👥 Guruh bilan o'ynash» action.
3. Backend Live Room: Support time limit and live round answers in `schema.js`, `create_live_room.js`, `get_live_room_state.js`, and `start_live_room.js`.
4. Backend Anti-Cheat & Scoring: Endpoints `get_live_question.js` (omits `correctOptionId`) and `submit_live_answer.js` (server validates, computes speed bonus $100 + 50 \times \frac{t_{\text{rem}}}{T}$, records score).
5. Live Battle Frontend: `LiveRoomView.jsx` (Lobby without PIN, direct Telegram link) + `ArenaView.jsx` (Synchronous live battle with 3-2-1 start, live timer, 3-second intermediate leaderboard, final 3-tier podium).

**Tech Stack:** Node.js, SQLite/Turso, React 19, Vite, Telegram WebApp SDK, Vitest.

**Spec:** [docs/superpowers/specs/2026-11-14-simplified-group-live-battle-design.md](file:///d:/Serverless/Queasy_uz_Bot/docs/superpowers/specs/2026-11-14-simplified-group-live-battle-design.md)

---

## Global Constraints
- All paths and changes strictly inside `d:\Serverless\Queasy_uz_Bot`. Never touch `d:\Serverless\QuizBot`.
- Keep all existing 23 Vitest test suites green.
- Anti-cheat constraint: `get_live_question.js` must NEVER include `correctOptionId` or `explanation` in its response.
- Scoring constraint: $\text{Score} = 100 + \text{round}\left( 50 \times \frac{t_{\text{remaining}}}{T_{\text{total}}} \right)$ for correct answers; 0 for incorrect or timed out answers.
- Deep-link format: `https://t.me/<BOT_USERNAME>/app?startapp=battle_<roomCode>`.

---

## Review Focus
1. **Double Submission:** A player rapidly tapping an option must not be awarded multiple scores for the same question index.
2. **Time Limit Customization:** Host choosing a custom time (e.g. 15s or 45s) must be respected by both backend scoring calculations and frontend timer.
3. **Late Joiners:** Opening the deep link after `status === 'active'` must not crash or corrupt player state.
4. **Auto-advance on Full Mode:** Clicking «To'liq rejim» in Step 1 must transition seamlessly to Step 2 without needing an extra click.
5. **Turso / Local SQLite Sync:** Live room records and round answers must write to Turso when enabled and local SQLite container safely without schema mismatch.

---

### Task 1: Database Schema & Live Room Creation Updates

**Files:**
- Modify: `tgcloud/schema.js:186-206`
- Modify: `tgcloud/endpoints/create_live_room.js:20-80`
- Modify: `tgcloud/endpoints/get_live_room_state.js:170-215`
- Create: `tests/endpoints/live_room_create.test.js`

**Interfaces:**
- Consumes: `quizzes`, `liveRooms`, `roomPlayers` from `tgcloud/schema.js`
- Produces: `liveRoomAnswers` table in `schema.js`, updated `create_live_room` accepting `{ quizId, modeConfig: { mode, range, randomCount, timeLimit } }`

- [ ] **Step 1: Write failing test for `create_live_room` with customized `timeLimit`**

```javascript
// tests/endpoints/live_room_create.test.js
import { describe, it, expect, vi } from 'vitest';
import createLiveRoom from '../../tgcloud/endpoints/create_live_room.js';

describe('create_live_room endpoint', () => {
  it('saves modeConfig with custom timeLimit into room configuration', async () => {
    const input = {
      quizId: 1,
      modeConfig: { mode: 'random', randomCount: 15, timeLimit: 20 },
    };
    const ctx = { initData: { user: { id: 9999, first_name: 'TestHost' } } };
    const res = await createLiveRoom(input, ctx);
    expect(res.success).toBe(true);
    expect(res.roomCode).toBeDefined();
    expect(res.shareLink).toContain(`battle_${res.roomCode}`);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/endpoints/live_room_create.test.js`  
Expected: FAIL (missing `shareLink` format or `liveRoomAnswers` table)

- [ ] **Step 3: Update `schema.js` and `create_live_room.js`**

Add `liveRoomAnswers` table in `tgcloud/schema.js`:
```javascript
export const liveRoomAnswers = table('live_room_answers', {
  id:                integer('id').primaryKey({ autoIncrement: true }),
  roomCode:          text('room_code').notNull(),
  userId:            integer('user_id').notNull(),
  questionIndex:     integer('question_index').notNull(),
  selectedOptionId:  integer('selected_option_id').notNull(),
  isCorrect:         integer('is_correct', { mode: 'boolean' }).notNull(),
  scoreAwarded:      integer('score_awarded').notNull().default(0),
  timeTaken:         integer('time_taken').default(0),
  answeredAt:        integer('answered_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
});
```
In `create_live_room.js`:
Save `live_room_cfg:${roomCode}` with `modeConfig` (including `timeLimit`), and return `shareLink: https://t.me/${CONFIG.BOT.USERNAME}/app?startapp=battle_${roomCode}`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/endpoints/live_room_create.test.js`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git -C "d:\Serverless\Queasy_uz_Bot" add tgcloud/schema.js tgcloud/endpoints/create_live_room.js tgcloud/endpoints/get_live_room_state.js tests/endpoints/live_room_create.test.js
git -C "d:\Serverless\Queasy_uz_Bot" commit -m "feat(live-battle): add liveRoomAnswers schema and custom timeLimit in create_live_room"
```

---

### Task 2: Anti-Cheat Question Delivery & Server-Authoritative Scoring Endpoints

**Files:**
- Create: `tgcloud/endpoints/get_live_question.js`
- Create: `tgcloud/endpoints/submit_live_answer.js`
- Create: `tests/endpoints/live_battle_scoring.test.js`

**Interfaces:**
- Consumes: `liveRooms`, `roomPlayers`, `liveRoomAnswers`, `questions`, `botSettings`
- Produces:
  - `get_live_question`: `{ success, questionIndex, totalQuestions, timeLimit, question: { id, questionText, options, photoFileId } }`
  - `submit_live_answer`: `{ success, isCorrect, correctOptionId, scoreAwarded, totalScore }`

- [ ] **Step 1: Write failing tests for question delivery and scoring**

```javascript
// tests/endpoints/live_battle_scoring.test.js
import { describe, it, expect } from 'vitest';
import getLiveQuestion from '../../tgcloud/endpoints/get_live_question.js';
import submitLiveAnswer from '../../tgcloud/endpoints/submit_live_answer.js';

describe('Live battle anti-cheat and scoring', () => {
  it('get_live_question omits correctOptionId and explanation', async () => {
    const res = await getLiveQuestion({ roomCode: '123456', questionIndex: 0 }, { initData: { user: { id: 101 } } });
    if (res.success) {
      expect(res.question.correctOptionId).toBeUndefined();
      expect(res.question.explanation).toBeUndefined();
    }
  });

  it('submit_live_answer computes speed bonus correctly for correct answer', async () => {
    // formula: 100 + round(50 * (remaining / total))
    // e.g. total 15s, taken 3s -> remaining 12s -> 100 + round(50 * 12/15) = 100 + 40 = 140
    // test mock or logic
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/endpoints/live_battle_scoring.test.js`  
Expected: FAIL (endpoints do not exist)

- [ ] **Step 3: Implement `get_live_question.js` and `submit_live_answer.js`**

Implement `get_live_question.js`:
- Fetch `modeConfig` from `live_room_cfg:${roomCode}`.
- Resolve questions slice for `questionIndex`.
- Return sanitized question object (strip `correctOptionId` and `explanation`).

Implement `submit_live_answer.js`:
- Check duplicate in `live_room_answers` for `(roomCode, userId, questionIndex)`. Return error if already answered.
- Compare `selectedOptionId === question.correctOptionId`.
- If correct: `score = 100 + Math.round(50 * Math.max(0, timeLimit - timeTaken) / timeLimit)`. If wrong: `score = 0`.
- Record in `live_room_answers` and update `room_players.score`.
- Return `{ success: true, isCorrect, correctOptionId: question.correctOptionId, scoreAwarded: score, totalScore }`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/endpoints/live_battle_scoring.test.js`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git -C "d:\Serverless\Queasy_uz_Bot" add tgcloud/endpoints/get_live_question.js tgcloud/endpoints/submit_live_answer.js tests/endpoints/live_battle_scoring.test.js
git -C "d:\Serverless\Queasy_uz_Bot" commit -m "feat(live-battle): implement get_live_question anti-cheat and submit_live_answer scoring"
```

---

### Task 3: Refactor `QuizModeModal.jsx` into 2-Step Wizard

**Files:**
- Modify: `src/components/quiz/QuizModeModal.jsx`
- Create: `tests/components/QuizModeModal.test.jsx`

**Interfaces:**
- Consumes: `quizId`, `isOpen`, `onClose`, `onConfirmMode`
- Produces: `onConfirmMode({ quizId, mode, range, randomCount, timeLimit })`

- [ ] **Step 1: Write failing component test for 2-step wizard**

```javascript
// tests/components/QuizModeModal.test.jsx
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { QuizModeModal } from '../../src/components/quiz/QuizModeModal.jsx';

describe('QuizModeModal 2-step wizard', () => {
  it('auto-advances to step 2 when full mode is clicked', async () => {
    // renders step 1, click full mode card, step 2 (time limit) should appear
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/components/QuizModeModal.test.jsx`  
Expected: FAIL

- [ ] **Step 3: Implement 2-step wizard in `QuizModeModal.jsx`**

- State: `step: 1 | 2`, `selectedTimeLimit: 15`, `customTimeInput: ''`.
- Step 1 (Questions Count):
  - Card 1: «To'liq rejim» -> Click sets mode `'full'` and immediately sets `step = 2`.
  - Card 2: «Oraliq» -> Range selector + «Keyingisi ➡️» button to go to `step = 2`.
  - Card 3: «Tasodifiy» -> Random count selector + «Keyingisi ➡️» button to go to `step = 2`.
- Step 2 (Time Limit per question):
  - Back button `⬅️ Orqaga` returns to `step = 1`.
  - Grid of presets: `10s`, `15s`, `30s`, `45s`, `1 daqiqa (60s)`, `2 daqiqa (120s)`.
  - Optional custom number input.
  - Final Action Button: `«🚀 O'yinni boshlash»` calling `onConfirmMode({ quizId, mode, range, randomCount, timeLimit })`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/components/QuizModeModal.test.jsx`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git -C "d:\Serverless\Queasy_uz_Bot" add src/components/quiz/QuizModeModal.jsx tests/components/QuizModeModal.test.jsx
git -C "d:\Serverless\Queasy_uz_Bot" commit -m "feat(ui): refactor QuizModeModal into 2-step wizard with auto-advance and time limit selection"
```

---

### Task 4: Simplify `GroupHostView.jsx` and Entry Point Routing

**Files:**
- Modify: `src/views/GroupHostView.jsx:280-340`
- Modify: `src/App.jsx:70-90, 183-201`
- Modify: `src/services/quizService.js` (add API helpers for `fetchLiveQuestion`, `submitLiveAnswer`)

**Interfaces:**
- Consumes: `createLiveRoom(quizId, modeConfig)` from `quizService.js`
- Produces: Single unified «👥 Guruh bilan o'ynash» button on each quiz card; `startapp=battle_<roomCode>` deep link handler in `App.jsx`.

- [ ] **Step 1: Write failing test for `GroupHostView` single button layout**

Test verifies that only ONE primary group action button (`👥 Guruh bilan o'ynash`) is rendered per quiz card, and outdated tournament/bot buttons are removed.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/views/GroupHostView.test.jsx`  
Expected: FAIL

- [ ] **Step 3: Update `GroupHostView.jsx` and `App.jsx`**

In `GroupHostView.jsx`:
- Remove `BTN_LAUNCH_BOT_POLL`, `BTN_GROUP_TOURNAMENT`, `BTN_LIVE_ROOM`.
- Replace with single button: `«👥 Guruh bilan o'ynash»` which opens `QuizModeModal` and on confirm calls `createLiveRoom(quizId, modeConfig)`.
- Add primary header banner: `«➕ Yangi guruh jangi yaratish»`.

In `App.jsx`:
- Update URL/start_param parser:
```javascript
if (startParam && startParam.startsWith('battle_')) {
  setActiveRoomCode(startParam.replace('battle_', ''));
} else if (startParam && startParam.startsWith('room_')) {
  setActiveRoomCode(startParam.replace('room_', ''));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/views/GroupHostView.test.jsx`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git -C "d:\Serverless\Queasy_uz_Bot" add src/views/GroupHostView.jsx src/App.jsx src/services/quizService.js
git -C "d:\Serverless\Queasy_uz_Bot" commit -m "feat(ui): consolidate group quiz entry to single Live Battle button and battle deep-links"
```

---

### Task 5: Zero-PIN Lobby & Synchronous Arena Flow (`LiveRoomView.jsx` and `ArenaView.jsx`)

**Files:**
- Modify: `src/views/LiveRoomView.jsx:315-380`
- Modify: `src/views/ArenaView.jsx:155-220, 310-380`
- Create/Update tests: `tests/views/LiveRoomView.test.jsx`

**Interfaces:**
- Consumes: `fetchLiveRoomState`, `startLiveRoom`, `get_live_question`, `submit_live_answer`
- Produces: Complete synchronous multiplayer experience with 3-2-1 countdown, live round timer, 3-second intermediate scoreboard, and celebratory Podium.

- [ ] **Step 1: Write failing test for LiveRoomView zero-PIN share link**

Test verifies that lobby produces `battle_<roomCode>` link and hides manual PIN input requirements.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/views/LiveRoomView.test.jsx`  
Expected: FAIL

- [ ] **Step 3: Implement Zero-PIN Lobby and Synchronous Arena**

In `LiveRoomView.jsx`:
- Generate share link as `https://t.me/${APP_CONFIG.BOT_USERNAME}/app?startapp=battle_${roomCode}`.
- Render prominent `«✈️ Telegram orqali taklif qilish»` button.
- Clean up PIN display to be informational only (no manual entry prompt).

In `ArenaView.jsx`:
- When `liveRoomCode` is present:
  1. Trigger 3-2-1 visual countdown on game start.
  2. Fetch question round via `get_live_question(liveRoomCode, roundIndex)`.
  3. Start live timer matching `modeConfig.timeLimit`.
  4. On option tap: call `submit_live_answer(liveRoomCode, roundIndex, optionId, elapsed)`.
  5. Display 3-second intermediate result pill (*"+140 ball! 2-o'rindasiz"*).
  6. On last question: transition to final 3-tier Podium.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/views/LiveRoomView.test.jsx`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git -C "d:\Serverless\Queasy_uz_Bot" add src/views/LiveRoomView.jsx src/views/ArenaView.jsx
git -C "d:\Serverless\Queasy_uz_Bot" commit -m "feat(live-battle): complete zero-PIN lobby, live countdown, and synchronous battle rounds"
```

---

### Task 6: Full Regression Verification & Deployment Preparation

**Files:**
- Test: All test suites in `tests/`
- Build: Client build (`npm run build`)

- [ ] **Step 1: Run all tests**

Run: `npm test`  
Expected: All 23+ test suites PASS.

- [ ] **Step 2: Run client build**

Run: `npm run build`  
Expected: Build succeeds with 0 errors.

- [ ] **Step 3: Verification commit**

```bash
git -C "d:\Serverless\Queasy_uz_Bot" commit --allow-empty -m "chore: verify live battle implementation with passing test suite and clean build"
```
