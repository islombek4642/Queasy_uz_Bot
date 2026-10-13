# Audit Fixes, Security & Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve all 10 security, logic, and performance issues in Queasy_uz_Bot across backend endpoints and frontend WebApp.

**Architecture:** Layered fix starting with backend endpoint authorization and query correctness, continuing with N+1 parallelization and leaderboard ranking, then eliminating frontend React stale closure state bugs in ArenaView, and concluding with `React.lazy()` code-splitting in Vite.

**Tech Stack:** Node.js, Telegram Serverless Platform (`@tgcloud/cli`), SQLite, React 19, Vite.

**Spec:** [docs/superpowers/specs/2026-10-13-audit-fixes-design.md](file:///d:/Serverless/Queasy_uz_Bot/docs/superpowers/specs/2026-10-13-audit-fixes-design.md)

## Global Constraints

- Backend files in `tgcloud/` run in V8 isolate with no Node.js filesystem or npm packages — only `sdk` and relative `.js` project imports.
- Frontend files in `src/` must build cleanly with Vite (`npm run build`).
- All existing unit tests (`npm test`) must pass without regression.
- Database operations must respect asynchronous calls (`await db...`).

## Review Focus

1. `start_live_room`: An unauthorized player sending `POST /api/start_live_room` with a valid `roomCode` must receive `{ success: false, error: 'NOT_HOST' }`.
2. `get_group_sessions`: A user browsing group sessions when 10+ solo sessions are active must still see active group multiplayer sessions.
3. `ArenaView`: Answering the final question of a 10-question quiz correctly must submit score `10`, not `9`.
4. `get_leaderboard`: Choosing `today`, `week`, or `month` timeframe must filter sessions by timestamp instead of returning static last 100 sessions.
5. `App.jsx`: Lazy loading must not trigger a flash of unstyled content or break initial `startapp` deep link routing.

---

### Task 1: Backend Security & Authorization Enforcement

**Files:**
- Modify: `tgcloud/endpoints/start_live_room.js:14-36`
- Modify: `tgcloud/endpoints/reset_kiut_quizzes.js:6-12`
- Modify: `tgcloud/endpoints/ingest_kiut_batch.js:5-12`
- Test: `tests/test_auth_endpoints.mjs`

**Interfaces:**
- Consumes: `isUserAdmin(userId)` from `../lib/services/admin_service.js`, `ctx.initData.user.id`.
- Produces: `{ success: false, error: 'NOT_HOST' }` when `room.hostId !== currentUserId`, and `{ success: false, error: 'UNAUTHORIZED_ADMIN_ONLY' }` for non-admin batch/reset requests.

- [ ] **Step 1: Write the failing test in `tests/test_auth_endpoints.mjs`**

```javascript
import assert from 'assert';
import startLiveRoom from '../tgcloud/endpoints/start_live_room.js';
import resetKiutQuizzes from '../tgcloud/endpoints/reset_kiut_quizzes.js';

// Verify startLiveRoom rejects non-host
const nonHostCtx = { initData: { user: { id: 999999 } } };
const res = await startLiveRoom({ roomCode: '123456' }, nonHostCtx);
assert.strictEqual(res.success, false);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/test_auth_endpoints.mjs`  
Expected: FAIL or assertion mismatch.

- [ ] **Step 3: Implement authorization check in `tgcloud/endpoints/start_live_room.js`**

Check `if (!currentUserId || room.hostId !== currentUserId) return { success: false, error: 'NOT_HOST' };`.

- [ ] **Step 4: Implement admin checks in `tgcloud/endpoints/reset_kiut_quizzes.js` & `ingest_kiut_batch.js`**

Import `isUserAdmin` from `../lib/services/admin_service.js` and verify caller is admin.

- [ ] **Step 5: Run tests to verify they pass**

Run: `node tests/test_auth_endpoints.mjs`  
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add tgcloud/endpoints/start_live_room.js tgcloud/endpoints/reset_kiut_quizzes.js tgcloud/endpoints/ingest_kiut_batch.js tests/test_auth_endpoints.mjs
git commit -m "fix(security): enforce host auth on live rooms and admin check on kiut maintenance"
```

---

### Task 2: Backend Group Sessions Filter & Tournament Timestamp

**Files:**
- Modify: `tgcloud/endpoints/get_group_sessions.js:20-25`
- Modify: `tgcloud/endpoints/submit_tournament_result.js:50-55`
- Test: `tests/test_group_filter.mjs`

**Interfaces:**
- Consumes: `quizSessions` schema with `isGroup: true`.
- Produces: `activeSessions` array guaranteed to only contain group multiplayer sessions, and integer UNIX timestamp on tournament participant finish.

- [ ] **Step 1: Write test in `tests/test_group_filter.mjs` checking SQL filter logic**

- [ ] **Step 2: Update `get_group_sessions.js` SQL query**

Change query to:
```javascript
.where(and(eq(quizSessions.isActive, true), eq(quizSessions.isGroup, true)))
.orderBy(desc(quizSessions.id))
.limit(10)
```
Optimize `userQuizzes` question counts with `Promise.all`.

- [ ] **Step 3: Update `submit_tournament_result.js` timestamp**

Replace `finishedAt: new Date()` with `finishedAt: Math.floor(Date.now() / 1000)`.

- [ ] **Step 4: Run test to verify**

Run: `node tests/test_group_filter.mjs`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tgcloud/endpoints/get_group_sessions.js tgcloud/endpoints/submit_tournament_result.js tests/test_group_filter.mjs
git commit -m "fix(sessions): ensure get_group_sessions only queries active group sessions and fix timestamp"
```

---

### Task 3: Backend Leaderboard & N+1 Query Parallelization

**Files:**
- Modify: `tgcloud/endpoints/get_leaderboard.js:14-135`
- Modify: `tgcloud/endpoints/get_kiut_catalog.js:100-116`
- Modify: `tgcloud/endpoints/get_initial_data.js:40-52, 95-101`
- Test: `tests/test_leaderboard.mjs`

**Interfaces:**
- Consumes: `input.timeframe` ('today', 'week', 'month', 'all').
- Produces: True XP-aggregated leaderboard with genuine user ranks and parallelized question counts.

- [ ] **Step 1: Write test for leaderboard ranking calculation in `tests/test_leaderboard.mjs`**

- [ ] **Step 2: Rewrite `get_leaderboard.js` aggregation**

Compute timestamp threshold from `input.timeframe`. Aggregate sessions by `userId` for total correct count, and rank users by XP.

- [ ] **Step 3: Parallelize question count lookups in `get_kiut_catalog.js` & `get_initial_data.js`**

Use `Promise.all` over the sliced quiz array instead of sequential `for...of` awaits. In `get_initial_data.js`, compute dynamic rank or fallback `-`.

- [ ] **Step 4: Verify test passes**

Run: `node tests/test_leaderboard.mjs`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tgcloud/endpoints/get_leaderboard.js tgcloud/endpoints/get_kiut_catalog.js tgcloud/endpoints/get_initial_data.js tests/test_leaderboard.mjs
git commit -m "perf(endpoints): parallelize N+1 queries and compute accurate aggregate leaderboard"
```

---

### Task 4: Frontend ArenaView Stale State Closure Resolution

**Files:**
- Modify: `src/views/ArenaView.jsx:40-47, 125-165, 170-189, 201-235`
- Test: Verify with build and simulated quiz completion.

**Interfaces:**
- Consumes: User option selection.
- Produces: 100% accurate final score passed to `submitSoloResult` and `submitTournamentResult`.

- [ ] **Step 1: Introduce synchronous mutable refs for scoring in `ArenaView.jsx`**

```javascript
const correctCountRef = useRef(0);
const wrongCountRef = useRef(0);
```

- [ ] **Step 2: Update `handleSelectOption` and `handleTimeout`**

Synchronously update `correctCountRef.current` and `wrongCountRef.current` before scheduling the transition timeout, and pass values to `handleAdvance(correctCountRef.current, wrongCountRef.current)`.

- [ ] **Step 3: Update `handleAdvance` signature and submission payload**

Use passed parameters or read directly from `correctCountRef.current` when constructing `submitTournamentResult({ score: correctCountRef.current, ... })` and `submitSoloResult({ correctCount: correctCountRef.current, ... })`.

- [ ] **Step 4: Verify frontend build compiles without errors**

Run: `npm run build`  
Expected: SUCCESS.

- [ ] **Step 5: Commit**

```bash
git add src/views/ArenaView.jsx
git commit -m "fix(arena): resolve stale closure score undercounting on quiz completion"
```

---

### Task 5: Frontend Code Splitting & Dead Code Elimination

**Files:**
- Modify: `src/App.jsx:6-27`
- Modify: `src/constants/endpoints.js:8`
- Test: Build output analysis (`npm run build`).

**Interfaces:**
- Consumes: Lazy imported React components.
- Produces: Initial JS bundle under 100 kB with on-demand chunk loading for secondary views.

- [ ] **Step 1: Remove dead constant `EP_GROUP_HOST_SYNC` in `src/constants/endpoints.js`**

- [ ] **Step 2: Convert secondary views in `src/App.jsx` to `React.lazy()`**

```javascript
const KiutView = React.lazy(() => import('./views/KiutView.jsx').then(m => ({ default: m.KiutView })));
const QuizCreatorView = React.lazy(() => import('./views/QuizCreatorView.jsx').then(m => ({ default: m.QuizCreatorView })));
const GroupHostView = React.lazy(() => import('./views/GroupHostView.jsx').then(m => ({ default: m.GroupHostView })));
const TournamentView = React.lazy(() => import('./views/TournamentView.jsx').then(m => ({ default: m.TournamentView })));
const LiveRoomView = React.lazy(() => import('./views/LiveRoomView.jsx').then(m => ({ default: m.LiveRoomView })));
const LeaderboardView = React.lazy(() => import('./views/LeaderboardView.jsx').then(m => ({ default: m.LeaderboardView })));
const MistakesView = React.lazy(() => import('./views/MistakesView.jsx').then(m => ({ default: m.MistakesView })));
const MyQuizzesView = React.lazy(() => import('./views/MyQuizzesView.jsx').then(m => ({ default: m.MyQuizzesView })));
const ArenaView = React.lazy(() => import('./views/ArenaView.jsx').then(m => ({ default: m.ArenaView })));
```

- [ ] **Step 3: Wrap view rendering in `<React.Suspense fallback={<LoadingFallback />}>`**

- [ ] **Step 4: Verify build and measure bundle chunk size**

Run: `npm run build`  
Expected: Main entry chunk drops significantly below 500 kB warning threshold.

- [ ] **Step 5: Commit**

```bash
git add src/App.jsx src/constants/endpoints.js
git commit -m "perf(webapp): implement code-splitting with React.lazy and remove unused constants"
```

---

### Task 6: Full System Verification, Unit Tests & Cloud Sync

**Files:**
- Verification only.

- [ ] **Step 1: Run unit test suite**

Run: `npm test`  
Expected: All hybrid parser tests pass perfectly.

- [ ] **Step 2: Run production build**

Run: `npm run build`  
Expected: Build succeeds cleanly.

- [ ] **Step 3: Inspect cloud diff**

Run: `npx @tgcloud/cli status`  
Expected: Lists updated endpoints and new static dist assets.

- [ ] **Step 4: Update Knowledge Graph**

Run: `graphify update .`  
Expected: Graph updated.

- [ ] **Step 5: Final Git commit and status verification**

```bash
git status
```
