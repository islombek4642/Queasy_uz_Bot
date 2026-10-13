# Design Specification: Queasy_uz_Bot Bug Fixes, Security & Performance Optimization

> **Status:** Approved  
> **Date:** 2026-10-13  
> **Author:** Antigravity AI Assistant & Islombek  
> **Related Document:** [AUDIT_REPORT.md](../../../AUDIT_REPORT.md)

---

## 1. Overview & Goal

The purpose of this specification is to resolve all 10 architectural, security, logic, and performance issues identified during the systematic audit of the `Queasy_uz_Bot` project. The solution covers both the Telegram Serverless Backend (V8 isolate, SQLite) and the Telegram Mini App Frontend (React 19, Vite).

Key goals:
1. **Accuracy:** Eliminate the stale closure bug in `ArenaView.jsx` where the user's score on the final question is undercounted by 1 point.
2. **Security & Authorization:** Enforce host authorization on `start_live_room.js` and replace hardcoded ingestion/reset secrets in `reset_kiut_quizzes.js` and `ingest_kiut_batch.js` with verified Telegram administrator checks (`isUserAdmin`).
3. **Data Integrity & Consistency:** Fix group session query filtering in `get_group_sessions.js` so active group sessions are not hidden by solo quiz sessions. Rebuild the leaderboard aggregation query in `get_leaderboard.js` to accurately rank players by XP and support timeframe filtering.
4. **Performance:** Resolve N+1 sequential database queries across all endpoints (`get_group_sessions.js`, `get_kiut_catalog.js`, `get_initial_data.js`) using parallelization. Implement `React.lazy()` and `Suspense` code-splitting in `App.jsx` to reduce initial bundle transfer from 666 kB to under 100 kB.

---

## 2. Architecture & Detailed Component Design

### 2.1 Backend: Security & Authorization

#### 2.1.1 `tgcloud/endpoints/start_live_room.js`
* **Problem:** Anyone knowing the 6-digit `roomCode` could start a live room prematurely.
* **Specification:**
  * Extract `currentUserId` from verified init data: `const currentUserId = ctx?.initData?.user?.id;`.
  * If `!currentUserId`, return `{ success: false, error: 'AUTH_REQUIRED' }`.
  * Query the room: if `room.hostId !== currentUserId`, return `{ success: false, error: 'NOT_HOST' }`.
  * Only when verified, update `liveRooms.status = 'active'`.

#### 2.1.2 `tgcloud/endpoints/reset_kiut_quizzes.js` & `ingest_kiut_batch.js`
* **Problem:** Hardcoded string `'KIUT_QUEASY_SECRET_2026'` allowed unauthorized quiz resets or bulk imports.
* **Specification:**
  * Import `isUserAdmin` from `../lib/services/admin_service.js`.
  * Extract `currentUserId = ctx?.initData?.user?.id;`.
  * Verify `if (!isUserAdmin(currentUserId)) return { success: false, error: 'UNAUTHORIZED_ADMIN_ONLY' };`.
  * Support optional fallback secret only if executed via local CLI testing with `ctx` flags, but require admin verification for web requests.

---

### 2.2 Backend: Logic & Query Optimization

#### 2.2.1 `tgcloud/endpoints/get_group_sessions.js`
* **Problem:** Queried active sessions with `.where(eq(quizSessions.isActive, true)).limit(10)` without filtering `isGroup = true`, causing solo sessions to drown out group sessions. In addition, 4 sequential DB queries were run in a loop for each session (N+1).
* **Specification:**
  * Update SQL query filter to: `.where(and(eq(quizSessions.isActive, true), eq(quizSessions.isGroup, true))).orderBy(desc(quizSessions.id)).limit(10)`.
  * Optimize participant counting: query `groupAnswers` with group/distinct logic or run session details in parallel using `Promise.all`.
  * In the `userQuizzes` launcher loop, fetch `questions` count in parallel via `Promise.all` rather than sequential `await` inside `for...of`.

#### 2.2.2 `tgcloud/endpoints/get_leaderboard.js`
* **Problem:** Loaded top 30 arbitrary users by `telegramId` descending and last 100 sessions across the platform, missing true top players and ignoring `timeframe`.
* **Specification:**
  * Implement timeframe timestamp threshold calculation:
    - `today`: `now - 86400`
    - `week`: `now - 7 * 86400`
    - `month`: `now - 30 * 86400`
    - `all`: `0`
  * Query finished sessions (`quizSessions.isActive = false`) within the timeframe, grouping by `userId` to compute total correct answers (`correctCount`), total questions answered, and quiz counts.
  * Fetch user display profiles for the top 10 unique user IDs from the `users` table.
  * Accurately calculate XP (`totalCorrect * 10`), accuracy percentage, and level (`Math.floor(xp / 100) + 1`).
  * Determine current user's genuine rank and return clean, real statistics without mock fallbacks.

#### 2.2.3 `tgcloud/endpoints/get_kiut_catalog.js` & `get_initial_data.js`
* **Problem:** Sequential `$count` queries inside loops (up to 100 calls in `get_kiut_catalog.js` and 20 in `get_initial_data.js`).
* **Specification:**
  * Convert question count lookups to parallel execution using `Promise.all(quizzes.map(async (q) => ...))`.
  * In `get_initial_data.js`, replace hardcoded `globalRank: 1` with genuine calculated rank or dynamic `-` if unranked.

#### 2.2.4 `tgcloud/endpoints/submit_tournament_result.js`
* **Problem:** Inconsistent timestamp format: `finishedAt: new Date()` mixed with integer `(unixepoch())`.
* **Specification:**
  * Store `finishedAt: Math.floor(Date.now() / 1000)` to match SQLite integer UNIX timestamp conventions.

---

### 2.3 Frontend: State Management & Performance

#### 2.3.1 `src/views/ArenaView.jsx` (Score Under-counting Fix)
* **Problem:** On answering the final question, `setCorrectCount(prev => prev + 1)` scheduled a state update, but the `setTimeout(() => handleAdvance(), 1200)` called `handleAdvance` with the stale `correctCount` closure from the previous render.
* **Specification:**
  * Maintain synchronous mutable refs: `correctCountRef = useRef(0)` and `wrongCountRef = useRef(0)`.
  * In `handleSelectOption` and `handleTimeout`:
    - Increment the ref synchronously: `correctCountRef.current += 1`.
    - Update React state for UI rendering: `setCorrectCount(prev => prev + 1)`.
    - Pass the updated values directly to `handleAdvance(finalCorrect, finalWrong)` or read from `correctCountRef.current` inside `handleAdvance`.
  * Ensure tournament submissions (`submitTournamentResult`) and solo submissions (`submitSoloResult`) receive 100% accurate scores including the final question.

#### 2.3.2 `src/App.jsx` (Code Splitting & Bundle Size Optimization)
* **Problem:** All 11 views and heavy math parsers (KaTeX) were statically bundled into a single `666.6 kB` chunk.
* **Specification:**
  * Keep `HomeView` statically imported for instant First Contentful Paint.
  * Convert secondary and heavy views to dynamic lazy imports with `React.lazy()`:
    - `KiutView`
    - `QuizCreatorView`
    - `GroupHostView`
    - `TournamentView`
    - `LiveRoomView`
    - `LeaderboardView`
    - `MistakesView`
    - `MyQuizzesView`
    - `ArenaView`
  * Wrap lazy-loaded routes with `<React.Suspense fallback={<LoadingSpinner />}>`.
  * Verify `npm run build` output: primary chunk drops from 666 kB to < 100 kB.

#### 2.3.3 `src/constants/endpoints.js` (Dead Code Elimination)
* **Specification:** Remove unused `EP_GROUP_HOST_SYNC` declaration.

---

## 3. Data Flow & Testing Strategy

### 3.1 Data Flow Verification
1. **Live Room Lifecycle:**
   * Host creates room -> `create_live_room` returns `roomCode`.
   * Players join -> `get_live_room_state` registers player in `roomPlayers`.
   * Non-host attempts start -> `start_live_room` rejects with `NOT_HOST`.
   * Host clicks start -> `start_live_room` succeeds -> polls trigger game for all players.
2. **Arena Completion Lifecycle:**
   * User answers question N of N correctly -> `correctCountRef` immediately updates to N -> `handleAdvance` reads N -> `submitSoloResult` / `submitTournamentResult` receives N.

### 3.2 Testing & Validation
1. **Unit Tests:** Run `npm test` to ensure all parser tests remain intact.
2. **Build Validation:** Run `npm run build` to confirm code-splitting chunks and verify no bundle errors.
3. **Endpoint Tests:** Use `npx @tgcloud/cli run` with test contexts to verify:
   * `start_live_room` authorization rejection vs host acceptance.
   * `get_group_sessions` returning only group sessions.
   * `get_leaderboard` returning properly sorted users with valid XP.
4. **Deploy Validation:** Check status with `npx @tgcloud/cli diff` and deploy with `npx @tgcloud/cli push`.
