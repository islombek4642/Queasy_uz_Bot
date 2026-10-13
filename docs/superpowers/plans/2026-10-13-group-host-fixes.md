# WebApp Group Host, Tournament & Live Room Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the infinite loop trap in Live Rooms, implement real-time score recording and winners podium, wire the Telegram Bot Poll launcher in Group Host, enable catalog test discovery for all users, and localize all group views.

**Architecture:** 
Add two new backend endpoints (`submit_live_room_result`, `finish_live_room`) to manage live room player scores and completion. Update `get_live_room_state` and `get_group_sessions` for state and catalog support. Refactor `App.jsx`, `ArenaView.jsx`, and `LiveRoomView.jsx` to pass `liveRoomCode` through the game lifecycle and render a Podium/Leaderboard screen upon completion without re-triggering the game loop. Wire the 3 launch mechanisms in `GroupHostView.jsx` and localize all strings into `uz.js` and `ru.js`.

**Tech Stack:** Telegram Serverless Cloud (`@tgcloud/cli`, SQLite, Drizzle ORM syntax), React 19, Vite, `@iconify/react`.

**Spec:** [`docs/superpowers/specs/2026-10-13-group-host-fixes-design.md`](file:///d:/Serverless/Queasy_uz_Bot/docs/superpowers/specs/2026-10-13-group-host-fixes-design.md)

## Global Constraints
- Backend endpoints run in V8 isolate without external npm modules or Node fs.
- All database operations in `tgcloud/` must use `sdk` and `sdk/db` with Drizzle SQLite schema from `tgcloud/schema.js`.
- Frontend code must use named exports and lazy loading compatibility with Vite.
- All user-facing strings must use `useTranslation().t` without hardcoded text.
- Timestamps must use integer unix seconds `Math.floor(Date.now() / 1000)`.

## Review Focus
1. Live Room exit must never re-trigger game start when `status === 'active'`.
2. Live Room score submission must update existing player record in `roomPlayers` rather than duplicating rows.
3. Host authorization must be enforced on `finish_live_room`.
4. Users with 0 personal quizzes must still see launchable catalog/public quizzes in Group Host.
5. Telegram bot group poll launcher (`startgroup=quiz_${id}`) must correctly trigger native group selection.

---

### Task 1: Backend Endpoints for Live Room Score & Completion

**Files:**
- Create: `tgcloud/endpoints/submit_live_room_result.js`
- Create: `tgcloud/endpoints/finish_live_room.js`
- Test: `tests/test_live_room_endpoints.mjs`

**Interfaces:**
- Consumes: `liveRooms`, `roomPlayers` from `tgcloud/schema.js`
- Produces: 
  - `submit_live_room_result(input: { roomCode, score, totalQuestions, totalTimeSeconds }, ctx)` -> `{ success: true, rank, score, totalPlayers }`
  - `finish_live_room(input: { roomCode }, ctx)` -> `{ success: true, status: 'finished' }`

- [ ] **Step 1: Write failing test for live room endpoints**

Create `tests/test_live_room_endpoints.mjs` testing:
1. `submit_live_room_result` inserts or updates player score in `roomPlayers` and calculates rank.
2. `finish_live_room` rejects non-host and updates status to `'finished'` for host.

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/test_live_room_endpoints.mjs`  
Expected: FAIL (cannot find modules `submit_live_room_result.js` and `finish_live_room.js`)

- [ ] **Step 3: Implement `tgcloud/endpoints/submit_live_room_result.js`**

Implement endpoint:
- Validate `roomCode`.
- Extract `currentUserId` and `userName`.
- Update existing player in `roomPlayers` with `score` and `finishedAt`, or insert if missing.
- Compute rank among all players in room sorted by `score DESC, joinedAt ASC`.
- Return `{ success: true, rank, score, totalPlayers }`.

- [ ] **Step 4: Implement `tgcloud/endpoints/finish_live_room.js`**

Implement endpoint:
- Validate `roomCode`.
- Fetch `liveRooms` where `roomCode = input.roomCode`.
- Check `ctx?.initData?.user?.id === room.hostId`. Return error `NOT_HOST` if unauthorized.
- Update `liveRooms` set `status = 'finished'`.
- Return `{ success: true, status: 'finished' }`.

- [ ] **Step 5: Run test to verify it passes**

Run: `node tests/test_live_room_endpoints.mjs`  
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add tgcloud/endpoints/submit_live_room_result.js tgcloud/endpoints/finish_live_room.js tests/test_live_room_endpoints.mjs
git commit -m "feat(backend): implement live room score submission and completion endpoints"
```

---

### Task 2: Backend Enhancements for State & Catalog Availability

**Files:**
- Modify: `tgcloud/endpoints/get_live_room_state.js`
- Modify: `tgcloud/endpoints/get_group_sessions.js`
- Test: `tests/test_group_catalog_sessions.mjs`

**Interfaces:**
- Consumes: `liveRooms`, `roomPlayers`, `quizzes`, `questions`, `quizSessions`
- Produces:
  - `get_live_room_state` returns `{ room, quiz, players, hasFinished, totalPlayers }`
  - `get_group_sessions` returns `{ activeSessions, launchableQuizzes }` where `launchableQuizzes` includes public quizzes (`ownerId = 0`) when user has < 5 quizzes

- [ ] **Step 1: Write failing test for state & catalog enhancements**

Create `tests/test_group_catalog_sessions.mjs` asserting:
1. `get_group_sessions` returns public quizzes (`ownerId = 0`) if user quizzes < 5.
2. `get_live_room_state` returns `hasFinished = true` when current player has `finishedAt`.

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/test_group_catalog_sessions.mjs`  
Expected: FAIL

- [ ] **Step 3: Update `tgcloud/endpoints/get_live_room_state.js`**

Add check for current user's `finishedAt` in `roomPlayers` and return `hasFinished: Boolean(currentPlayer?.finishedAt)`. Include `isFinished: room.status === 'finished'`.

- [ ] **Step 4: Update `tgcloud/endpoints/get_group_sessions.js`**

When `userQuizzes.length < 5`:
- Fetch public/catalog quizzes (`eq(quizzes.ownerId, 0)`).
- Merge up to 10 quizzes into `launchableQuizzes`.
- Tag each with `isPublic: q.ownerId === 0`.
- Include `shareLink: https://t.me/Queasy_uz_Bot?startgroup=quiz_${q.id}`.

- [ ] **Step 5: Run test to verify it passes**

Run: `node tests/test_group_catalog_sessions.mjs`  
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add tgcloud/endpoints/get_live_room_state.js tgcloud/endpoints/get_group_sessions.js tests/test_group_catalog_sessions.mjs
git commit -m "feat(backend): enhance live room state detection and provide catalog quizzes in group sessions"
```

---

### Task 3: Frontend Constants, Services & Localization

**Files:**
- Modify: `src/constants/endpoints.js`
- Modify: `src/services/quizService.js`
- Modify: `src/i18n/locales/uz.js`
- Modify: `src/i18n/locales/ru.js`

**Interfaces:**
- Produces:
  - `EP_SUBMIT_LIVE_ROOM_RESULT`, `EP_FINISH_LIVE_ROOM`
  - `submitLiveRoomResult(payload)`, `finishLiveRoom(roomCode)`
  - Translation keys: `BTN_LAUNCH_BOT_POLL`, `BTN_GROUP_TOURNAMENT`, `BTN_LIVE_ROOM`, `LIVE_ROOM_PODIUM_TITLE`, `LIVE_ROOM_EXIT`, `LIVE_ROOM_FINISH_BTN`, `GROUP_CHOOSE_CATALOG`, `GROUP_CREATE_NEW_QUIZ`

- [ ] **Step 1: Add endpoint constants & services**

In `src/constants/endpoints.js`:
Add `EP_SUBMIT_LIVE_ROOM_RESULT` and `EP_FINISH_LIVE_ROOM`.
In `src/services/quizService.js`:
Export `submitLiveRoomResult(payload)` and `finishLiveRoom(roomCode)`.

- [ ] **Step 2: Add all group host and live room translations**

Add missing keys in `src/i18n/locales/uz.js` and `src/i18n/locales/ru.js`:
- Action buttons for Bot Poll, Tournament, Live Room
- Podium and Leaderboard texts
- Empty state CTA buttons

- [ ] **Step 3: Verify build syntax**

Run: `npm test`  
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/constants/endpoints.js src/services/quizService.js src/i18n/locales/uz.js src/i18n/locales/ru.js
git commit -m "feat(frontend): add live room services, constants, and i18n translation keys"
```

---

### Task 4: ArenaView & App.jsx Live Room Flow & Loop Trap Elimination

**Files:**
- Modify: `src/views/ArenaView.jsx`
- Modify: `src/components/quiz/ResultCard.jsx`
- Modify: `src/App.jsx`

**Interfaces:**
- Consumes: `submitLiveRoomResult` from `quizService.js`
- Produces: 
  - `ArenaView` accepts `liveRoomCode` prop, submits to `submitLiveRoomResult` on finish.
  - `ResultCard` shows live room rank and feedback when `liveRoomResult` is present.
  - `App.jsx` maintains `activeLiveRoomCode` and transitions cleanly between Arena and LiveRoomView without infinite re-triggers.

- [ ] **Step 1: Update `src/views/ArenaView.jsx`**

Add prop `liveRoomCode = null`.
In `handleAdvance()` final question branch:
```javascript
if (tournamentShareCode) {
  submitTournamentResult(...);
} else if (liveRoomCode) {
  submitLiveRoomResult({
    roomCode: liveRoomCode,
    score: finalCorrect,
    totalQuestions: questions.length,
    totalTimeSeconds: elapsed,
  }).then((res) => {
    if (res && res.success) setLiveRoomResult(res);
  });
} else {
  submitSoloResult(...);
}
```
Pass `liveRoomResult` to `ResultCard`.

- [ ] **Step 2: Update `src/components/quiz/ResultCard.jsx`**

Render Live Room score badge when `liveRoomResult` is provided, with button to view Live Room Podium.

- [ ] **Step 3: Update `src/App.jsx`**

Add state `activeLiveRoomCode`.
When `LiveRoomView` calls `onStartGame(quizId, roomCode)`:
- `setActiveQuizId(quizId)`
- `setActiveLiveRoomCode(roomCode)`
Pass `liveRoomCode={activeLiveRoomCode}` into `<ArenaView />`.
In `handleExitArena()`:
- Reset `setActiveQuizId(null)`
- Keep `activeRoomCode` so user lands on `LiveRoomView` results screen.
In `LiveRoomView`'s `onBack()`:
- Reset both `setActiveRoomCode(null)` and `setActiveLiveRoomCode(null)`.

- [ ] **Step 4: Verify build**

Run: `npm run build`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/views/ArenaView.jsx src/components/quiz/ResultCard.jsx src/App.jsx
git commit -m "fix(arena): integrate live room score submission and eliminate infinite relaunch loop"
```

---

### Task 5: LiveRoomView Complete Lifecycle (Lobby, Active, and Podium / Leaderboard)

**Files:**
- Modify: `src/views/LiveRoomView.jsx`

**Interfaces:**
- Consumes: `fetchLiveRoomState`, `startLiveRoom`, `finishLiveRoom`
- Produces:
  - Lobby UI (`waiting`)
  - Game Auto-launcher (`active` && `!hasFinished`)
  - Podium / Leaderboard UI (`active && hasFinished` OR `finished`)
  - Replaces all hardcoded Uzbek strings with `t(...)`

- [ ] **Step 1: Implement Podium and Leaderboard UI in `LiveRoomView.jsx`**

When `roomData.hasFinished` is true OR `roomData.room.status === 'finished'`:
- Render Top 3 Podium (🥇, 🥈, 🥉) with user names, avatars/initials, and scores.
- Render full participants table.
- If host: render button "Xonani yakunlash" (`finishLiveRoom`).
- Render button "Xonadan chiqish" (`onBack`) calling `onBack()`.
- Prevent `loadState()` from triggering `onStartGame` if `roomData.hasFinished` is true.

- [ ] **Step 2: Replace all hardcoded Uzbek strings in `LiveRoomView.jsx` with `t(...)`**

Replace strings at lines 90, 99, 100, 122, 127, 142, 179, 188, 198, 201, 209, 277, 291, 295.

- [ ] **Step 3: Verify build**

Run: `npm run build`  
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/views/LiveRoomView.jsx
git commit -m "feat(live-room): add podium results view and localize LiveRoomView"
```

---

### Task 6: GroupHostView & TournamentView Enhancements

**Files:**
- Modify: `src/views/GroupHostView.jsx`
- Modify: `src/views/TournamentView.jsx`
- Modify: `src/App.jsx`

**Interfaces:**
- `GroupHostView`:
  - 3 launch buttons per quiz: 🤖 Bot Poll, 🏆 WebApp Tournament, ⚡ Live Room
  - Quiz description on card expand
  - Empty state CTA buttons for Creator and KIUT
  - All hardcoded strings replaced with `t(...)`
- `TournamentView`:
  - All hardcoded strings replaced with `t(...)`

- [ ] **Step 1: Wire 3 launch buttons and description in `GroupHostView.jsx`**

- Wire `handleLaunchInGroup(q.shareLink)` to button `BTN_LAUNCH_BOT_POLL`.
- Wire `handleShareTournament(q.id)` to button `BTN_GROUP_TOURNAMENT`.
- Wire `handleCreateLiveRoom(q.id)` to button `BTN_LIVE_ROOM`.
- Render `q.description` when `isExpanded` is true.
- Add "Public" badge if `q.isPublic` is true.

- [ ] **Step 2: Add empty-state CTA buttons in `GroupHostView.jsx`**

If `launchableQuizzes.length === 0`:
- Button 1: `t('GROUP_CREATE_NEW_QUIZ')` -> calls `onOpenCreator()`.
- Button 2: `t('GROUP_CHOOSE_CATALOG')` -> calls `onOpenKiut()`.
Pass `onOpenCreator` and `onOpenKiut` from `App.jsx`.

- [ ] **Step 3: Localize hardcoded strings in `GroupHostView.jsx` and `TournamentView.jsx`**

Replace all static Uzbek strings with `t(...)` keys in modal, headers, badges, and alerts.

- [ ] **Step 4: Verify build**

Run: `npm run build`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/views/GroupHostView.jsx src/views/TournamentView.jsx src/App.jsx
git commit -m "feat(group-host): wire all 3 launch options, add empty-state CTAs, and localize group views"
```

---

### Task 7: Verification, Knowledge Graph Sync & Final Validation

**Files:**
- `tests/`
- `graphify-out/`

- [ ] **Step 1: Run all backend tests**

Run: `node tests/test_live_room_endpoints.mjs`  
Run: `node tests/test_group_catalog_sessions.mjs`  
Run: `node tests/test_auth_endpoints.mjs`  
Run: `node tests/test_leaderboard.mjs`  
Run: `npm test`  
Expected: All tests PASS

- [ ] **Step 2: Run production build**

Run: `npm run build`  
Expected: Clean build, 0 warnings.

- [ ] **Step 3: Update knowledge graph**

Run: `graphify update .`  
Expected: Graph updated with new endpoints and components.

- [ ] **Step 4: Commit**

```bash
git add graphify-out tests/
git commit -m "chore(graphify): update knowledge graph for group host and live room fixes"
```
