# Telegram Serverless QuizBot (Queasy_uz_Bot) - Yakuniy Implementatsiya Rejasi (PLAN v4)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a production-grade Telegram Serverless QuizBot featuring 3 Solo Quiz Modes, "Mening xatolarim" (Mistakes) engine, Group Multiplayer Mode, Admin Panel (Stats, Broadcast, Channel subscription gate, User/Group management), and Hybrid Parser with intelligent validation.

**Architecture:** Pure JavaScript ES Modules running on Telegram Serverless V8 sandbox, backed by embedded SQLite (`sdk/db`) and Bot API (`sdk/api`). Cleanly layered into `constants/`, `parsers/`, `services/`, `keyboards/`, and `handlers/`.

**Tech Stack:** JavaScript (ES Modules), Telegram Serverless CLI (`@tgcloud/cli`), `sdk` / `sdk/db`, Node.js (test runner).

**Spec:** [docs/SPECIFICATION.md](file:///d:/Serverless/Queasy_uz_Bot/docs/SPECIFICATION.md)

---

### Task 1: Scaffolding and CLI Environment Setup
- [ ] Initialize `tgcloud` project structure in `d:/Serverless/Queasy_uz_Bot`.
- [ ] Create `package.json` with scripts (`status`, `diff`, `push`, `migrate`, `run`).
- [ ] Configure `tgcloud.jsonc`.
- [ ] Save CLI access token (`app8869835041:niwNCJhFXyIqKk2dRhTh07SPAm4K2Oa92s5nYOBTbqg`) into `.tgcloud/credentials.json`.
- [ ] Verify connection with `npx tgcloud status`.

### Task 2: Zero-Hardcode Constants & Configurations
- [ ] Create `tgcloud/lib/constants/config.js` (admins, time limits, poll limitations, pagination limits, leaderboard limits).
- [ ] Create `tgcloud/lib/constants/actions.js`:
  - Solo Modes: `MODE_FULL`, `MODE_RANGE`, `MODE_RANDOM`, `MODE_MISTAKES`.
  - Admin Actions: `ADMIN_STATS`, `ADMIN_BROADCAST`, `ADMIN_USERS`, `ADMIN_GROUPS`, `ADMIN_CHANNELS`, `ADMIN_PUBLISH`.
  - FSM States: `STATE_SELECTING_MODE`, `STATE_WAITING_FOR_RANGE`, `STATE_WAITING_FOR_RANDOM_COUNT`, `STATE_AWAITING_QUIZ_FILE`, `STATE_ADMIN_BROADCAST_TEXT`, `STATE_ADMIN_ADD_CHANNEL`.
- [ ] Create `tgcloud/lib/constants/messages.js`:
  - Full localization strings (UZ Lotin, OZ Kirill, RU, EN): greetings, mode selection, mistakes prompts, admin dashboard, force subscribe gate, error hints.

### Task 3: SQLite Database Schema Definition
- [ ] Create `tgcloud/schema.js` using `sdk/db` DSL (`table`, `integer`, `text`, `sql`).
- [ ] Define tables:
  - `users` (with `isBlocked`, language)
  - `groups` (tracking connected groups)
  - `quizzes` (quiz meta & settings)
  - `questions` (quiz items)
  - `user_mistakes` (personalized mistakes repository)
  - `quiz_sessions` (solo & group active sessions)
  - `group_answers` (multiplayer poll answer tracker)
  - `required_channels` (channels for mandatory subscription)
  - `user_states` (FSM tracker)
  - `bot_settings` (dynamic key-value configurations)

### Task 4: Hybrid Parser Engine with Smart Validation
- [ ] Create `tgcloud/lib/parsers/cleaner.js`:
  - `fixBrokenLineJoins` (joining split lines).
  - `normalizeUzbekApostrophes` (`o'`, `g'`).
  - `repairFractionsAndMath` (`π 6` -> `π/6`, dashes).
  - `stripExamHeadersAndPageNumbers`.
- [ ] Create `tgcloud/lib/parsers/validator.js`:
  - Validate question structure, min 2 options, correct option presence, report exact line number on error.
- [ ] Create `tgcloud/lib/parsers/abc_parser.js` (standard ABC, prefix markers `*A)`, `#A)`, and end-of-text answer keys).
- [ ] Create `tgcloud/lib/parsers/gift_parser.js` (Moodle GIFT format).
- [ ] Create `tgcloud/lib/parsers/block_parser.js` (`==== / ++++` format).
- [ ] Create `tgcloud/lib/parsers/legacy_parser.js` (`? / + / =` format).
- [ ] Create `tgcloud/lib/utils/unzip.js` (pure JS deflate/inflate unzipper for `.docx` and `.xlsx`).
- [ ] Create `tgcloud/lib/parsers/docx_reader.js` (Word docx XML extractor).
- [ ] Create `tgcloud/lib/parsers/xlsx_reader.js` (Excel sheets XML extractor).
- [ ] Create `tgcloud/lib/parsers/parser_engine.js` (universal auto-detecting aggregator).
- [ ] Write automated tests `tests/test_hybrid_parsers.mjs` and verify against sample test formats.

### Task 5: Business Services Layer
- [ ] Create `tgcloud/lib/services/user_service.js` (profile, language, blocking, FSM state).
- [ ] Create `tgcloud/lib/services/channel_service.js` (check force subscription, list required channels).
- [ ] Create `tgcloud/lib/services/quiz_service.js` (save parsed quiz, pagination list, clone, delete, share link).
- [ ] Create `tgcloud/lib/services/session_service.js`:
  - Solo Sessions with 4 modes (`full`, `range`, `random`, `mistakes`).
  - Mistakes tracking: save wrong answers to `user_mistakes`, generate mistakes quiz.
  - Group Sessions: multiplayer response recording, leaderboard calculation.
- [ ] Create `tgcloud/lib/services/group_service.js` (add/update groups, list active groups).
- [ ] Create `tgcloud/lib/services/admin_service.js` (analytics aggregation, broadcast dispatcher, user search).

### Task 6: Keyboards & Interactive Menus
- [ ] Create `tgcloud/lib/keyboards/main_keyboard.js` (Main menu, Upload, My Quizzes, Mistakes, Help, Language).
- [ ] Create `tgcloud/lib/keyboards/mode_keyboard.js` (To'liq, Oraliq, Aralash, Bekor qilish).
- [ ] Create `tgcloud/lib/keyboards/quiz_keyboard.js` (Quiz view, Settings, Clone/Share, Pagination).
- [ ] Create `tgcloud/lib/keyboards/group_keyboard.js` (Group quiz controls, Leaderboard).
- [ ] Create `tgcloud/lib/keyboards/admin_keyboard.js` (Admin dashboard, Stats, Broadcast, Channels, User management).
- [ ] Create `tgcloud/lib/keyboards/subscribe_keyboard.js` (Channel links + "✅ Tekshirish" button).

### Task 7: Telegram Update Handlers
- [ ] Implement `tgcloud/handlers/message.js`:
  - Force subscription check middleware hook.
  - Private commands: `/start`, `/help`, `/myquizzes`, `/mistakes`, `/set_language`, `/admin`.
  - Group commands: `/quiz`, `/help`.
  - FSM states:
    - Mode selection (`SELECTING_MODE`)
    - Range input (`WAITING_FOR_RANGE`)
    - Random count input (`WAITING_FOR_RANDOM_COUNT`)
    - File/Text upload (`AWAITING_QUIZ_FILE`)
    - Admin Broadcast (`ADMIN_BROADCAST_TEXT`)
    - Admin Channel Add (`ADMIN_ADD_CHANNEL`)
  - File upload handling (`.txt`, `.docx`, `.xlsx`, pasted text) with Smart Validation.
- [ ] Implement `tgcloud/handlers/callback_query.js`:
  - Handle channel subscription verification ("✅ Tekshirish").
  - Handle language switching.
  - Handle mode selection, pagination, quiz settings, start/stop.
  - Handle admin actions: stats, broadcast confirmation, user search, channel removal.
- [ ] Implement `tgcloud/handlers/poll_answer.js`:
  - Handle Solo answers: record answer, track mistake if wrong, advance question, send final scorecard.
  - Handle Group answers: multi-user response logging, leaderboard calculation.

### Task 8: Verification & Local Testing
- [ ] Run test scripts with sample quizzes.
- [ ] Test handlers with `npx tgcloud run`.

### Task 9: Cloud Deployment & Database Migration
- [ ] Run `npx tgcloud push` to upload modules.
- [ ] Run `npx tgcloud migrate` to create database tables.
- [ ] Run `npx tgcloud webhook` to verify webhook sync.
