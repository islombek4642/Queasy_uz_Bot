# Telegram Poll Modernization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate Telegram Bot API 10.0+ poll capabilities (`shuffle_options`, `media` header, `InputPollOptionMedia`, `explanation_media`, `members_only`) with resilient zero-downtime fallback.

**Architecture:** Extend `session_service.js` poll dispatcher to construct modern `sendPoll` payloads, support structured options in `sanitizer.js`, and provide a robust fallback to traditional separate messages if Bot API 10.0 media isn't accepted by a specific chat/client.

**Tech Stack:** JavaScript (ES modules, Node 20+, Telegram Bot API 10.0, tgcloud SDK).

**Spec:** `docs/superpowers/specs/2026-10-14-telegram-poll-features-design.md`

## Global Constraints
- Maximum question length: 300 characters.
- Maximum option text length: 100 characters.
- Maximum explanation length: 200 characters.
- Support 1 to 12 options (`MIN_OPTIONS: 1`, `MAX_OPTIONS: 12`).
- No hardcoded strings in application code.

## Review Focus
1. Option parsing must handle both legacy string array `["A", "B"]` and structured `{ text, media }` without breaking existing quizzes.
2. If `sendPoll` fails with media parameters, fallback to separate `sendPhoto` + traditional poll must execute seamlessly.
3. `shuffle_options` must correctly reflect `quiz.shuffleOptions`.
4. `members_only` must only be set when `session.isGroup` is true.

---

### Task 1: Enhance Option Sanitization for Structured InputPollOption

**Files:**
- Modify: `tgcloud/lib/parsers/sanitizer.js:150-200`
- Test: `tests/test_poll_modernization.mjs`

- [ ] **Step 1: Write test for structured options sanitization**
- [ ] **Step 2: Run test to verify it fails**
- [ ] **Step 3: Update `sanitizeOptionsList` in `sanitizer.js` to process objects with `text` and `media`**
- [ ] **Step 4: Run test to verify it passes**
- [ ] **Step 5: Commit**

---

### Task 2: Implement Modernized `sendPoll` Dispatcher with Resilient Fallback

**Files:**
- Modify: `tgcloud/lib/services/session_service.js:220-350`
- Test: `tests/test_poll_modernization.mjs`

- [ ] **Step 1: Write mock tests for `sendNextQuestionPoll` with modern poll parameters**
- [ ] **Step 2: Run mock test to verify failure**
- [ ] **Step 3: Implement `formatPollOptions`, `shuffle_options`, `members_only`, `media`, and fallback in `session_service.js`**
- [ ] **Step 4: Run test to verify success**
- [ ] **Step 5: Commit**

---

### Task 3: Comprehensive Verification and Deployment

**Files:**
- Verify: All tests in `tests/test_hybrid_parsers.mjs` and `tests/test_poll_modernization.mjs`

- [ ] **Step 1: Run full test suite (`npm test`)**
- [ ] **Step 2: Push changes to tgcloud platform (`npx @tgcloud/cli push`)**
- [ ] **Step 3: Final git commit and status check**
