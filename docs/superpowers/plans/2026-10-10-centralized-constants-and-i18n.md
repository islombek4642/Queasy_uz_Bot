# Centralized Constants & Zero-Hardcode i18n Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate all hardcoded Uzbek/Russian strings, button labels, time indicators, and status messages across the Queasy bot codebase by migrating them to a fully localized multi-language catalog (`messages.js`) supporting UZ, RU, and EN equally.

**Architecture:** Centralized messages repository in `tgcloud/lib/constants/messages.js` with dynamic template interpolation (`getMessage(key, lang, params)`). All keyboards, handlers, and services accept `lang` and consume messages only via constants.

**Tech Stack:** JavaScript (ES Modules), Telegram Serverless runtime (`@tgcloud/cli`), SQLite (`sdk/db`).

**Spec:** [`docs/superpowers/specs/2026-10-10-centralized-constants-and-i18n-design.md`](file:///d:/Serverless/Queasy_uz_Bot/docs/superpowers/specs/2026-10-10-centralized-constants-and-i18n-design.md)

## Global Constraints
- Zero hardcoded UI strings in any handler, service, or keyboard file.
- All keys must exist in UZ, RU, and EN in `MESSAGES`.
- `getMessage` must safely fallback to `UZ` and not crash if a param is missing.
- Time limit buttons must dynamically use `TIME_SECONDS` and `TIME_MINUTES` templates based on `CONFIG.POLL.ALLOWED_TIME_LIMITS`.

## Review Focus
- Missing key fallback returns `[key]` instead of crashing.
- String interpolation with null/undefined parameters does not output `"undefined"`.
- Russian or English user does not see any Uzbek text during any solo or group flow.
- Admin broadcast warning triggers properly when sending slash commands or reply menu buttons in all supported languages.
- Changing language updates the user's interface immediately and persists in SQLite.

---

### Task 1: Expand `MESSAGES` Catalog with 100% Coverage for UZ, RU, and EN

**Files:**
- Modify: `d:/Serverless/Queasy_uz_Bot/tgcloud/lib/constants/messages.js`
- Test: `tests/constants.test.js` (or inline verification script in scratch)

**Interfaces:**
- Produces: `getMessage(key: string, lang: string, params: object) -> string`
- Exported constant: `MESSAGES: { UZ: object, RU: object, EN: object }`

- [ ] **Step 1: Write verification script to assert key parity across UZ, RU, and EN**
Verify that all keys in `MESSAGES.UZ` exist in `MESSAGES.RU` and `MESSAGES.EN`.

- [ ] **Step 2: Add all new keys to `MESSAGES.UZ`, `MESSAGES.RU`, and `MESSAGES.EN`**
Add:
- Time & Buttons: `TIME_SECONDS`, `TIME_MINUTES`, `BTN_CONFIRM_DELETE`, `BTN_CANCEL_DELETE`, `BTN_MAIN_MENU`, `BTN_ADMIN_MENU`, `BTN_ADD_CHANNEL`, `BTN_CONFIRM_BROADCAST`, `BTN_SELECT_GROUP`, `BTN_SELECT_AND_ADD_GROUP`, `BTN_SHARE_TO_FRIENDS`, `BTN_SOLVE_QUIZ`, `BTN_CONTACT_ADMIN`, `BTN_DELETE_ACTION`.
- Group & Lobby: `GROUP_NO_ACTIVE_QUIZ`, `GROUP_CURRENT_RESULTS`, `GROUP_LOBBY_PREPARED`, `GROUP_LOBBY_ANNOUNCED`, `GROUP_CHOOSE_PROMPT`, `GROUP_NONE_ADMIN_FOUND`, `GROUP_ADD_PROMPT`.
- Admin & Broadcast: `ERR_BROADCAST_COMMAND`, `ERR_BROADCAST_BUTTON`, `PROMPT_CONFIRM_BROADCAST`, `PROMPT_BROADCAST_INPUT`, `ERR_ADD_CHANNEL`, `ERR_MESSAGE_EXPIRED`, `ADMIN_CHANNELS_LIST_TITLE`, `ADMIN_USERS_LIST_TITLE`, `ADMIN_GROUPS_LIST_TITLE`, `ADMIN_NO_USERNAME`.
- File Upload & Common: `FILE_PROCESSING`, `FILE_PROCESS_ERROR`, `MAIN_MENU_CAPTION`, `MY_QUIZZES_TITLE`, `LANG_CHOOSE_PROMPT`, `LANG_CHANGED_SUCCESS`, `PROMPT_CHANGE_TIME`, `ALERT_TIME_CHANGED`, `PROMPT_CONFIRM_DELETE`, `ALERT_QUIZ_CLONED`, `ERR_CLONE_FAILED`, `ERR_DELETE_FAILED`, `SHARE_BOT_TEXT`, `SHARE_BOT_CAPTION`, `LABEL_YES`, `LABEL_NO`, `DEFAULT_USER_NAME`, `ERR_MISTAKES_EMPTY_SUBJECT`, `ERR_QUIZ_EMPTY`, `INLINE_QUIZ_DESC`, `INLINE_QUIZ_BODY`.
Fill missing existing keys in `RU` and `EN`.

- [ ] **Step 3: Run key parity test**
Expected: PASS (UZ, RU, EN have identical key sets).

- [ ] **Step 4: Commit**
```bash
git add tgcloud/lib/constants/messages.js
git commit -m "feat(i18n): expand centralized messages catalog with full UZ/RU/EN parity"
```

---

### Task 2: Refactor Keyboards to Zero-Hardcode and Multi-Language

**Files:**
- Modify: `d:/Serverless/Queasy_uz_Bot/tgcloud/lib/keyboards/quiz_keyboard.js`
- Modify: `d:/Serverless/Queasy_uz_Bot/tgcloud/lib/keyboards/admin_keyboard.js`
- Modify: `d:/Serverless/Queasy_uz_Bot/tgcloud/lib/keyboards/subscribe_keyboard.js`

**Interfaces:**
- Consumes: `getMessage(key, lang, params)` from `../constants/messages.js`
- Produces:
  - `getTimeLimitKeyboard(quizId, lang = 'UZ')`
  - `getConfirmDeleteKeyboard(quizId, lang = 'UZ')`
  - `getAdminChannelsKeyboard(channelsList, lang = 'UZ')`
  - `getAdminConfirmBroadcastKeyboard(lang = 'UZ')`
  - `getLanguageKeyboard(lang = 'UZ')`

- [ ] **Step 1: Refactor `getTimeLimitKeyboard` and `getConfirmDeleteKeyboard` in `quiz_keyboard.js`**
Pass `lang`. Generate time texts via `TIME_SECONDS` and `TIME_MINUTES`. Replace delete strings with `BTN_CONFIRM_DELETE` and `BTN_CANCEL_DELETE`. Back button with `BTN_BACK`.

- [ ] **Step 2: Refactor `getAdminChannelsKeyboard` and `getAdminConfirmBroadcastKeyboard` in `admin_keyboard.js`**
Pass `lang`. Replace delete with `BTN_DELETE_ACTION`, add channel with `BTN_ADD_CHANNEL`, back with `BTN_ADMIN_MENU`, confirm with `BTN_CONFIRM_BROADCAST`, cancel with `BTN_CANCEL`.

- [ ] **Step 3: Refactor `getLanguageKeyboard` in `subscribe_keyboard.js`**
Pass `lang`. Replace back button text with `getMessage('BTN_MAIN_MENU', lang)`.

- [ ] **Step 4: Verify keyboard outputs across UZ, RU, EN**
Verify that all generated button texts match expected localized strings without hardcoded values.

- [ ] **Step 5: Commit**
```bash
git add tgcloud/lib/keyboards/
git commit -m "refactor(keyboards): eliminate hardcoded strings and support dynamic language"
```

---

### Task 3: Refactor Services and Inline Query

**Files:**
- Modify: `d:/Serverless/Queasy_uz_Bot/tgcloud/lib/services/session_service.js`
- Modify: `d:/Serverless/Queasy_uz_Bot/tgcloud/handlers/inline_query.js`

**Interfaces:**
- Consumes: `getMessage(key, lang, params)`
- Produces: Localized lobby descriptions, error messages, and inline query results.

- [ ] **Step 1: Update `session_service.js`**
Replace hardcoded:
- `'Ushbu fan bo\'yicha xatolar mavjud emas.'` -> `getMessage('ERR_MISTAKES_EMPTY_SUBJECT', lang)`
- `'Test topilmadi yoki savollari bo\'sh.'` -> `getMessage('ERR_QUIZ_EMPTY', lang)`
- `'👇 <b>Asosiy menyu:</b>'` -> `getMessage('MAIN_MENU_CAPTION', lang)`
- `'Ha' : 'Yo\'q'` -> `getMessage('LABEL_YES', lang) : getMessage('LABEL_NO', lang)`
- `'Foydalanuvchi'` -> `getMessage('DEFAULT_USER_NAME', lang)`

- [ ] **Step 2: Update `inline_query.js`**
Replace hardcoded:
- Description: `getMessage('INLINE_QUIZ_DESC', 'UZ', { count, time })`
- Message text: `getMessage('INLINE_QUIZ_BODY', 'UZ', { title, count, time })`
- Button text: `getMessage('BTN_SOLVE_QUIZ', 'UZ')`

- [ ] **Step 3: Verification**
Verify no runtime errors in `session_service.js` and `inline_query.js`.

- [ ] **Step 4: Commit**
```bash
git add tgcloud/lib/services/session_service.js tgcloud/handlers/inline_query.js
git commit -m "refactor(services): localize session messages and inline query responses"
```

---

### Task 4: Refactor Callback Query Handler (`callback_query.js`)

**Files:**
- Modify: `d:/Serverless/Queasy_uz_Bot/tgcloud/handlers/callback_query.js`

**Interfaces:**
- Consumes: `getMessage(key, lang, params)` and updated keyboard functions with `lang`.

- [ ] **Step 1: Replace all `answer(...)` alerts with localized constants**
- `answer('✅ Til muvaffaqiyatli saqlandi!')` -> `answer(getMessage('LANG_CHANGED_SUCCESS', newLang))`
- `answer('✅ Guruhda test tayyorgarligi boshlandi!')` -> `answer(getMessage('GROUP_LOBBY_PREPARED', lang))`
- `answer('⏱ Vaqt ... soniyaga o'zgartirildi!')` -> `answer(getMessage('ALERT_TIME_CHANGED', lang, { time: seconds }))`
- `answer('O\'chirishda xatolik yuz berdi.')` -> `answer(getMessage('ERR_DELETE_FAILED', lang), true)`
- `answer('📥 Test sizning profilingizga nusxalandi!')` -> `answer(getMessage('ALERT_QUIZ_CLONED', lang))`
- `answer('Nusxalashda xatolik.')` -> `answer(getMessage('ERR_CLONE_FAILED', lang), true)`
- `answer('Xabar topilmadi yoki muddati o'tgan.')` -> `answer(getMessage('ERR_MESSAGE_EXPIRED', lang), true)`

- [ ] **Step 2: Replace dialog texts and pass `lang` to keyboards**
- Pass `lang` to `getTimeLimitKeyboard(quizId, lang)` and `getConfirmDeleteKeyboard(quizId, lang)`.
- Pass `lang` to `getAdminChannelsKeyboard(channels, lang)`.
- Replace `GROUP_CHOOSE_PROMPT`, `GROUP_NONE_ADMIN_FOUND`, `PROMPT_CHANGE_TIME`, `PROMPT_CONFIRM_DELETE`, `PROMPT_BROADCAST_INPUT`, `ADMIN_CHANNELS_LIST_TITLE`, `ADMIN_USERS_LIST_TITLE`, `ADMIN_GROUPS_LIST_TITLE`.

- [ ] **Step 3: Verify callback query handling**
Ensure clean execution with no broken references.

- [ ] **Step 4: Commit**
```bash
git add tgcloud/handlers/callback_query.js
git commit -m "refactor(handlers): eliminate hardcoded strings in callback queries"
```

---

### Task 5: Refactor Message Handler (`message.js`)

**Files:**
- Modify: `d:/Serverless/Queasy_uz_Bot/tgcloud/handlers/message.js`

**Interfaces:**
- Consumes: `getMessage(key, lang, params)` for group commands, broadcast validations, file parser, and menu replies.

- [ ] **Step 1: Localize group commands**
- `/stop_quiz`: `getMessage('GROUP_NO_ACTIVE_QUIZ', lang)`
- `/quiz_stats`: `getMessage('GROUP_NO_ACTIVE_QUIZ', lang)`, `getMessage('GROUP_CURRENT_RESULTS', lang)`, `getMessage('GROUP_NO_ANSWERS', lang)`
- `/quiz_help`: `getMessage('BTN_CONTACT_ADMIN', lang)`
- `/create_quiz`: `getMessage('BTN_CREATE_QUIZ', lang)`

- [ ] **Step 2: Localize broadcast validations and admin actions**
- Command warning: `getMessage('ERR_BROADCAST_COMMAND', lang)`
- Menu button warning: `getMessage('ERR_BROADCAST_BUTTON', lang)`
- Confirm prompt: `getMessage('PROMPT_CONFIRM_BROADCAST', lang)`
- Channel add error: `getMessage('ERR_ADD_CHANNEL', lang, { error: err.message })`

- [ ] **Step 3: Localize file uploads and general replies**
- File progress: `getMessage('FILE_PROCESSING', lang)`
- File error: `getMessage('FILE_PROCESS_ERROR', lang, { error: err.message })`
- Sub-menu captions: `getMessage('MAIN_MENU_CAPTION', lang)`
- My quizzes title: `getMessage('MY_QUIZZES_TITLE', lang, { count })`
- Language prompt & response: `getMessage('LANG_CHOOSE_PROMPT', lang)` and `getMessage('LANG_CHANGED_SUCCESS', newLang)`
- Group add info & Share bot: `getMessage('GROUP_ADD_PROMPT', lang)`, `getMessage('BTN_SELECT_AND_ADD_GROUP', lang)`, `getMessage('SHARE_BOT_CAPTION', lang, { username })`, `getMessage('BTN_SHARE_TO_FRIENDS', lang)`

- [ ] **Step 4: Verify message handling**
Check that all command responses and text checks pass without runtime errors.

- [ ] **Step 5: Commit**
```bash
git add tgcloud/handlers/message.js
git commit -m "refactor(handlers): eliminate all hardcoded strings in message handler"
```

---

### Task 6: Audit, AST Graph Update, and Verification

**Files:**
- All touched files

- [ ] **Step 1: Perform full grep scan for remaining hardcoded Cyrillic and Uzbek strings**
Ensure zero unregistered text remains in `handlers/`, `services/`, and `keyboards/`.

- [ ] **Step 2: Update graphify knowledge graph**
Run: `graphify update .`

- [ ] **Step 3: Final sanity verification**
Verify syntax and bundle integrity.
