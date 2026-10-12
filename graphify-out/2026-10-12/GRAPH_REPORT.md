# Graph Report - Queasy_uz_Bot  (2026-10-12)

## Corpus Check
- 120 files · ~57,853 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 6 file(s) not represented in the graph (top: .css 4, (none) 1, .jsonc 1)

## Summary
- 568 nodes · 1400 edges · 20 communities (19 shown, 1 thin omitted)
- Extraction: 92% EXTRACTED · 8% INFERRED · 0% AMBIGUOUS · INFERRED: 111 edges (avg confidence: 0.87)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- schema.js
- Proposed Changes
- Database (`db`)
- ErrorBoundary
- test_keyboards_i18n.mjs
- Telegram Serverless QuizBot (Queasy_uz_Bot) - Yakuniy To'liq Spetsifikatsiya (Spec v4)
- Centralized Constants & Zero-Hardcode i18n Design Specification
- react
- package.json
- test_group_commands.mjs
- callback_query.js
- Queasy Telegram Mini App (Web App) Arxitektura va Dizayn Spetsifikatsiyasi
- Review Focus
- ingest_kiut_tests.mjs
- Tasks
- quizService.js
- Proposed Changes
- parser_engine.js
- index.jsx
- Proposed Changes

## God Nodes (most connected - your core abstractions)
1. `getMessage()` - 41 edges
2. `react` - 33 edges
3. `useTelegram()` - 32 edges
4. `useTranslation()` - 28 edges
5. `Card()` - 22 edges
6. `@iconify/react` - 19 edges
7. `Button()` - 18 edges
8. `Badge()` - 15 edges
9. `Modal()` - 15 edges
10. `ArenaView()` - 15 edges

## Surprising Connections (you probably didn't know these)
- `3. Frontend Views & Components` --references--> `QuizCreatorModal()`  [INFERRED]
  docs/superpowers/plans/2026-10-11-queasy-mini-app-phase2.md → src/components/quiz/QuizCreatorModal.jsx
- `Task 4: Telegram WebApp SDK Integration & Haptic Hook` --references--> `useTelegram()`  [INFERRED]
  docs/superpowers/plans/2026-10-11-queasy-mini-app-phase1.md → src/hooks/useTelegram.js
- `Task 2: CSS Design Tokens & Theme Engine (Dark, Light, Auto)` --references--> `useTheme()`  [INFERRED]
  docs/superpowers/plans/2026-10-11-queasy-mini-app-phase1.md → src/hooks/useTheme.js
- `Task 3: Zero-Hardcode Constants & Tri-Lingual i18n System` --references--> `useTranslation()`  [INFERRED]
  docs/superpowers/plans/2026-10-11-queasy-mini-app-phase1.md → src/hooks/useTranslation.js
- `7. Bosqichma-bosqich Amalga Oshirish Rejasi (Phases)` --references--> `GroupHostView()`  [INFERRED]
  docs/superpowers/specs/2026-10-11-queasy-mini-app-design.md → src/views/GroupHostView.jsx

## Import Cycles
- None detected.

## Communities (20 total, 1 thin omitted)

### Community 0 - "schema.js"
Cohesion: 0.12
Nodes (22): broadcastMessage(), getMediaChannel(), getUsersCount(), listUsers(), removeMediaChannel(), setMediaChannel(), setUserBlocked(), deactivateGroup() (+14 more)

### Community 1 - "Proposed Changes"
Cohesion: 0.29
Nodes (6): 1. Backend Serverless Endpoints (`tgcloud/endpoints/`), 3. Frontend Views & Components, 4. i18n & Zero Hardcoding, 5. Verification & Deployment, Phase 3: Quiz Studio & Advanced Management, Proposed Changes

### Community 2 - "Database (`db`)"
Cohesion: 0.04
Nodes (40): Database — the rules that bite, Deploy & migrate workflow, Endpoints — the Mini App's server side, Layout, Mini App front-end, Module system — the rules that bite, Platform SDK (`import … from 'sdk'`), What this project is (+32 more)

### Community 4 - "test_keyboards_i18n.mjs"
Cohesion: 0.06
Nodes (26): current, setRes, settingsStore, bcastKbdEn, bcastKbdRu, bcastKbdUz, chKbdEn, chKbdRu (+18 more)

### Community 5 - "Telegram Serverless QuizBot (Queasy_uz_Bot) - Yakuniy To'liq Spetsifikatsiya (Spec v4)"
Cohesion: 0.11
Nodes (18): 1. Loyiha haqida umumiy ma'lumot, 2.1. Test Rejimlari:, 2.2. Testlarni Boshqarish va Ulashish (My Quizzes & Share):, 2.3. Guruhda Test Yechish (Group Multiplayer):, 2.4. Ko'p Tilli Tizim (`/set_language`):, 2. Foydalanuvchi Imkoniyatlari (User Experience), 3.1. Formatlar:, 3.2. Aqlli Validatsiya (`Validator`): (+10 more)

### Community 6 - "Centralized Constants & Zero-Hardcode i18n Design Specification"
Cohesion: 0.12
Nodes (16): 1.1 Mavjud Muammolar, 1.2 Qat'iy Cheklovlar & Talablar, 1. Muammo va Talablar, 2.1 Yangi Kalitlar Ro'yxati (`tgcloud/lib/constants/messages.js`), 2. Konstantalar Arxitekturasi va Yangi Kalitlar Katalogi, 3.1 Klaviaturalar (`tgcloud/lib/keyboards/`), 3.2 Handlers (`tgcloud/handlers/`), 3.3 Services (`tgcloud/lib/services/`) (+8 more)

### Community 7 - "react"
Cohesion: 0.10
Nodes (58): 2. Frontend Services & Constants, @iconify/react, react, App(), Avatar(), Badge(), Button(), Card() (+50 more)

### Community 8 - "package.json"
Cohesion: 0.07
Nodes (26): dependencies, canvas-confetti, @iconify/react, katex, react, react-dom, devDependencies, vite (+18 more)

### Community 9 - "test_group_commands.mjs"
Cohesion: 0.18
Nodes (8): cmdBotDirected, cmdCreate, cmdOther, cmdQuiz, cmdQuizHelp, cmdQuizId, cmdQuizStats, cmdStop

### Community 10 - "callback_query.js"
Cohesion: 0.07
Nodes (67): Task 2: Refactor Keyboards to Zero-Hardcode and Multi-Language, ACTIONS, STATES, CONFIG, getMessage(), isButtonMatch(), getAdminChannelsKeyboard(), getAdminConfirmBroadcastKeyboard() (+59 more)

### Community 11 - "Queasy Telegram Mini App (Web App) Arxitektura va Dizayn Spetsifikatsiyasi"
Cohesion: 0.12
Nodes (15): 1. Umumiy Maqsad va Vizyon (Overview & Vision), 2. Modulli Frontend Arxitekturasi (SoC — Separation of Concerns), 3. Mavzular (Themes) va Dizayn Tizimi, 4. Ko'p Tillilik Tizimi (i18n — UZ, RU, EN), 5.1. Bosh Sahifa (HomeView), 5.2. Solo Quiz Arena (ArenaView), 5.3. Guruh O'yinlari Xost Markazi (GroupHostView), 5.4. Test Muharriri (StudioView) (+7 more)

### Community 12 - "Review Focus"
Cohesion: 0.22
Nodes (8): Centralized Constants & Zero-Hardcode i18n Implementation Plan, Global Constraints, Review Focus, Task 1: Expand `MESSAGES` Catalog with 100% Coverage for UZ, RU, and EN, Task 3: Refactor Services and Inline Query, Task 4: Refactor Callback Query Handler (`callback_query.js`), Task 5: Refactor Message Handler (`message.js`), Task 6: Audit, AST Graph Update, and Verification

### Community 13 - "ingest_kiut_tests.mjs"
Cohesion: 0.20
Nodes (7): CHECKPOINT_FILE, main(), scan(), sendBatch(), sleep(), files, walk()

### Community 14 - "Tasks"
Cohesion: 0.13
Nodes (14): Global Constraints, Queasy Mini App (Phase 1: MVP Foundation & Solo Arena) Implementation Plan, Review Focus, Task 10: Build, Integration Verification & Cloud Deployment, Task 1: Scaffolding Vite + React Frontend and Dependencies, Task 2: CSS Design Tokens & Theme Engine (Dark, Light, Auto), Task 3: Zero-Hardcode Constants & Tri-Lingual i18n System, Task 4: Telegram WebApp SDK Integration & Haptic Hook (+6 more)

### Community 15 - "quizService.js"
Cohesion: 0.33
Nodes (12): EP_DELETE_QUIZ, EP_GET_GROUP_SESSIONS, EP_GET_INITIAL_DATA, EP_GET_KIUT_CATALOG, EP_GET_LEADERBOARD, EP_GET_QUIZ_DETAIL, EP_GET_USER_MISTAKES, EP_GROUP_HOST_SYNC (+4 more)

### Community 16 - "Proposed Changes"
Cohesion: 0.29
Nodes (6): 1. Achievements & Gamification Engine (`src/constants/achievements.js`), 2. Localization (UZ, RU, EN with 100% Parity), 3. Frontend Components & Views, 4. Verification & Deployment, Phase 4: Gamification, Achievements & Social Share Plan, Proposed Changes

### Community 17 - "parser_engine.js"
Cohesion: 0.05
Nodes (56): RFC-1950, RFC-1951, Task 4: Hybrid Parser Engine with Smart Validation, abcLines, abcResult, blockLines, blockResult, preprocessed (+48 more)

### Community 18 - "index.jsx"
Cohesion: 0.16
Nodes (7): APP_CONFIG, TelegramContext, TelegramProvider(), ThemeProvider(), LanguageContext, LanguageProvider(), translations

### Community 21 - "Proposed Changes"
Cohesion: 0.29
Nodes (6): 1. Constants & Endpoints, 2. Backend Serverless Endpoints (`tgcloud/endpoints/`), 3. Frontend Views & Components, 4. Verification & Deployment, Phase 2: Group Host Hub, Live Leaderboard & Mini App Quiz Creator, Proposed Changes

## Knowledge Gaps
- **2 isolated node(s):** `RFC-1951`, `RFC-1950`
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 208 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `getMessage()` connect `callback_query.js` to `Review Focus`, `test_keyboards_i18n.mjs`, `Centralized Constants & Zero-Hardcode i18n Design Specification`?**
  _High betweenness centrality (0.059) - this node is a cross-community bridge._
- **Are the 3 inferred relationships involving `getMessage()` (e.g. with `Global Constraints` and `3.2 Handlers (`tgcloud/handlers/`)`) actually correct?**
  _`getMessage()` has 3 INFERRED edges - model-reasoned connections that need verification._
- **What connects `RFC-1951`, `RFC-1950` to the rest of the system?**
  _2 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `schema.js` be split into smaller, more focused modules?**
  _Cohesion score 0.12179487179487179 - nodes in this community are weakly interconnected._
- **Why does `parseQuizInput()` connect `parser_engine.js` to `callback_query.js`, `ingest_kiut_tests.mjs`?**
  _High betweenness centrality (0.056) - this node is a cross-community bridge._
- **Should `Database (`db`)` be split into smaller, more focused modules?**
  _Cohesion score 0.0425531914893617 - nodes in this community are weakly interconnected._
- **Should `test_keyboards_i18n.mjs` be split into smaller, more focused modules?**
  _Cohesion score 0.0625 - nodes in this community are weakly interconnected._