# Graph Report - Queasy_uz_Bot  (2026-10-10)

## Corpus Check
- 56 files · ~34,613 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 2 file(s) not represented in the graph (top: (none) 1, .jsonc 1)

## Summary
- 348 nodes · 735 edges · 15 communities (14 shown, 1 thin omitted)
- Extraction: 86% EXTRACTED · 14% INFERRED · 0% AMBIGUOUS · INFERRED: 101 edges (avg confidence: 0.86)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- session_service.js
- parser_engine.js
- Database (`db`)
- test_pdf_reader.mjs
- callback_query.js
- Telegram Serverless QuizBot (Queasy_uz_Bot) - Yakuniy To'liq Spetsifikatsiya (Spec v4)
- Centralized Constants & Zero-Hardcode i18n Design Specification
- test_keyboards_i18n.mjs
- scripts
- test_group_commands.mjs
- quiz_service.js
- Telegram Serverless QuizBot (Queasy_uz_Bot) - Yakuniy Implementatsiya Rejasi (PLAN v4)
- Review Focus
- test_syntax.mjs
- test_messages_parity.mjs

## God Nodes (most connected - your core abstractions)
1. `getMessage()` - 42 edges
2. `cleanRawTextLines()` - 13 edges
3. `getQuizById()` - 13 edges
4. `CONFIG` - 11 edges
5. `sendNextQuestionPoll()` - 11 edges
6. `finishSession()` - 11 edges
7. `Database (`db`)` - 11 edges
8. `startQuizSession()` - 10 edges
9. `Telegram Serverless QuizBot (Queasy_uz_Bot) - Yakuniy Implementatsiya Rejasi (PLAN v4)` - 10 edges
10. `parseAbcFormat()` - 9 edges

## Surprising Connections (you probably didn't know these)
- `Global Constraints` --references--> `getMessage()`  [INFERRED]
  docs/superpowers/plans/2026-10-10-centralized-constants-and-i18n.md → tgcloud/lib/constants/messages.js
- `3.2 Handlers (`tgcloud/handlers/`)` --references--> `getMessage()`  [INFERRED]
  docs/superpowers/specs/2026-10-10-centralized-constants-and-i18n-design.md → tgcloud/lib/constants/messages.js
- `3.2. Aqlli Validatsiya (`Validator`):` --references--> `fixBrokenLineJoins()`  [INFERRED]
  docs/SPECIFICATION.md → tgcloud/lib/parsers/cleaner.js
- `Task 2: Refactor Keyboards to Zero-Hardcode and Multi-Language` --references--> `getAdminChannelsKeyboard()`  [INFERRED]
  docs/superpowers/plans/2026-10-10-centralized-constants-and-i18n.md → tgcloud/lib/keyboards/admin_keyboard.js
- `Task 2: Refactor Keyboards to Zero-Hardcode and Multi-Language` --references--> `getAdminConfirmBroadcastKeyboard()`  [INFERRED]
  docs/superpowers/plans/2026-10-10-centralized-constants-and-i18n.md → tgcloud/lib/keyboards/admin_keyboard.js

## Import Cycles
- None detected.

## Communities (15 total, 1 thin omitted)

### Community 0 - "session_service.js"
Cohesion: 0.20
Nodes (21): getStopKeyboard(), validateQuestion(), validateQuizQuestions(), getQuizById(), advanceGroupRound(), advanceGroupRoundByPollId(), announceGroupLobby(), finishSession() (+13 more)

### Community 1 - "parser_engine.js"
Cohesion: 0.08
Nodes (37): RFC-1950, RFC-1951, Task 4: Hybrid Parser Engine with Smart Validation, abcLines, abcResult, blockLines, blockResult, preprocessed (+29 more)

### Community 2 - "Database (`db`)"
Cohesion: 0.06
Nodes (30): Database — the rules that bite, Deploy & migrate workflow, Endpoints — the Mini App's server side, Layout, Mini App front-end, Module system — the rules that bite, Platform SDK (`import … from 'sdk'`), What this project is (+22 more)

### Community 3 - "test_pdf_reader.mjs"
Cohesion: 0.10
Nodes (15): current, setRes, settingsStore, docxBuf, lines, parsed, emptyPdf, lines (+7 more)

### Community 4 - "callback_query.js"
Cohesion: 0.10
Nodes (40): Task 2: Refactor Keyboards to Zero-Hardcode and Multi-Language, ACTIONS, STATES, getMessage(), getAdminChannelsKeyboard(), getAdminConfirmBroadcastKeyboard(), getAdminDashboardKeyboard(), getAdminMediaChannelKeyboard() (+32 more)

### Community 5 - "Telegram Serverless QuizBot (Queasy_uz_Bot) - Yakuniy To'liq Spetsifikatsiya (Spec v4)"
Cohesion: 0.11
Nodes (18): 1. Loyiha haqida umumiy ma'lumot, 2.1. Test Rejimlari:, 2.2. Testlarni Boshqarish va Ulashish (My Quizzes & Share):, 2.3. Guruhda Test Yechish (Group Multiplayer):, 2.4. Ko'p Tilli Tizim (`/set_language`):, 2. Foydalanuvchi Imkoniyatlari (User Experience), 3.1. Formatlar:, 3.2. Aqlli Validatsiya (`Validator`): (+10 more)

### Community 6 - "Centralized Constants & Zero-Hardcode i18n Design Specification"
Cohesion: 0.12
Nodes (16): 1.1 Mavjud Muammolar, 1.2 Qat'iy Cheklovlar & Talablar, 1. Muammo va Talablar, 2.1 Yangi Kalitlar Ro'yxati (`tgcloud/lib/constants/messages.js`), 2. Konstantalar Arxitekturasi va Yangi Kalitlar Katalogi, 3.1 Klaviaturalar (`tgcloud/lib/keyboards/`), 3.2 Handlers (`tgcloud/handlers/`), 3.3 Services (`tgcloud/lib/services/`) (+8 more)

### Community 7 - "test_keyboards_i18n.mjs"
Cohesion: 0.12
Nodes (15): bcastKbdEn, bcastKbdRu, bcastKbdUz, chKbdEn, chKbdRu, chKbdUz, delKbdEn, delKbdRu (+7 more)

### Community 8 - "scripts"
Cohesion: 0.18
Nodes (10): name, private, scripts, deploy, diff, migrate, run, status (+2 more)

### Community 9 - "test_group_commands.mjs"
Cohesion: 0.18
Nodes (8): cmdBotDirected, cmdCreate, cmdOther, cmdQuiz, cmdQuizHelp, cmdQuizId, cmdQuizStats, cmdStop

### Community 10 - "quiz_service.js"
Cohesion: 0.08
Nodes (34): CONFIG, cleanOmmlText(), generateLatexImageUrl(), hasMathFormula(), normalizeLatex(), ommlToLatex(), renderAndUploadFormula(), broadcastMessage() (+26 more)

### Community 11 - "Telegram Serverless QuizBot (Queasy_uz_Bot) - Yakuniy Implementatsiya Rejasi (PLAN v4)"
Cohesion: 0.20
Nodes (9): Task 1: Scaffolding and CLI Environment Setup, Task 2: Zero-Hardcode Constants & Configurations, Task 3: SQLite Database Schema Definition, Task 5: Business Services Layer, Task 6: Keyboards & Interactive Menus, Task 7: Telegram Update Handlers, Task 8: Verification & Local Testing, Task 9: Cloud Deployment & Database Migration (+1 more)

### Community 12 - "Review Focus"
Cohesion: 0.22
Nodes (8): Centralized Constants & Zero-Hardcode i18n Implementation Plan, Global Constraints, Review Focus, Task 1: Expand `MESSAGES` Catalog with 100% Coverage for UZ, RU, and EN, Task 3: Refactor Services and Inline Query, Task 4: Refactor Callback Query Handler (`callback_query.js`), Task 5: Refactor Message Handler (`message.js`), Task 6: Audit, AST Graph Update, and Verification

### Community 14 - "test_messages_parity.mjs"
Cohesion: 0.20
Nodes (9): enKeys, interpolated, missingInEn, missingInRu, requiredNewKeys, ruKeys, uzKeys, isButtonMatch() (+1 more)

## Knowledge Gaps
- **2 isolated node(s):** `RFC-1951`, `RFC-1950`
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 149 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `getMessage()` connect `callback_query.js` to `session_service.js`, `Centralized Constants & Zero-Hardcode i18n Design Specification`, `quiz_service.js`, `Review Focus`, `test_messages_parity.mjs`?**
  _High betweenness centrality (0.133) - this node is a cross-community bridge._
- **Are the 3 inferred relationships involving `getMessage()` (e.g. with `Global Constraints` and `3.2 Handlers (`tgcloud/handlers/`)`) actually correct?**
  _`getMessage()` has 3 INFERRED edges - model-reasoned connections that need verification._
- **What connects `RFC-1951`, `RFC-1950` to the rest of the system?**
  _2 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `parser_engine.js` be split into smaller, more focused modules?**
  _Cohesion score 0.07993966817496229 - nodes in this community are weakly interconnected._
- **Why does `fixBrokenLineJoins()` connect `parser_engine.js` to `Telegram Serverless QuizBot (Queasy_uz_Bot) - Yakuniy To'liq Spetsifikatsiya (Spec v4)`?**
  _High betweenness centrality (0.103) - this node is a cross-community bridge._
- **Should `Database (`db`)` be split into smaller, more focused modules?**
  _Cohesion score 0.06060606060606061 - nodes in this community are weakly interconnected._
- **Why does `3.2. Aqlli Validatsiya (`Validator`):` connect `Telegram Serverless QuizBot (Queasy_uz_Bot) - Yakuniy To'liq Spetsifikatsiya (Spec v4)` to `parser_engine.js`?**
  _High betweenness centrality (0.080) - this node is a cross-community bridge._