# Telegram Bot API 10.0+ Poll Modernization Design Spec

**Date:** 2026-10-14  
**Status:** Approved  
**Author:** Antigravity & User  

---

## 1. Overview & Goals
Modernize Telegram Poll generation in `Queasy_uz_Bot` to utilize Telegram Bot API 9.6 / 10.0+ native capabilities:
1. **Shuffle Options (`shuffle_options: true`):** Native random shuffling per user to prevent answer copying in group chats.
2. **Poll Header Media (`InputPollMedia` / `media`):** Directly attach formula/question photos inside the native poll widget rather than sending separate messages, with graceful fallback.
3. **Option Media (`InputPollOptionMedia`):** Support structured `InputPollOption` objects containing images (`photoFileId` or image URL) for image-based answer choices.
4. **Explanation Media (`explanation_media`):** Attach solution walkthrough images to poll quiz explanations when available.
5. **Group Member Restriction (`members_only: true`):** Restrict voting to verified chat members in group sessions.
6. **Limit Expansion:** Support 1–12 options (`MIN_OPTIONS: 1`, `MAX_OPTIONS: 12`) per latest Bot API specifications.

---

## 2. Architecture & Data Flow

### A. Poll Delivery (`tgcloud/lib/services/session_service.js`)
When `sendNextQuestionPoll` runs:
1. **Media preparation:** Check if question has a formula or photo.
2. **Options formatting:** Transform `options` array into clean `InputPollOption` structures:
   - Plain string options: `{ text: "..." }` or sanitized string.
   - Media options (if object with `photoFileId` / `media`): `{ text: "...", media: { type: "photo", media: ... } }`.
3. **Primary Call (`sendPoll` with Bot API 10.0 parameters):**
   ```javascript
   await api.sendPoll({
     chat_id: session.chatId,
     question: questionTitle,
     question_parse_mode: 'HTML',
     options: formattedOptions,
     is_anonymous: false,
     type: 'quiz',
     correct_option_id: correctOptionId,
     explanation,
     explanation_parse_mode: explanation ? 'HTML' : undefined,
     explanation_media: explanationMedia || undefined,
     media: pollMedia || undefined,
     shuffle_options: quiz.shuffleOptions !== false,
     members_only: session.isGroup ? true : undefined,
     open_period: timeLimit,
     reply_markup: nextBtnMarkup,
   });
   ```
4. **Resilient Fallback:**
   If `sendPoll` rejects because the Bot API gateway or isolate lacks full Bot API 10.0 media support, catch the error and fallback to standard `sendPhoto` + traditional `sendPoll` seamlessly with zero downtime or player interruption.

### B. Option & Schema Handling (`tgcloud/lib/parsers/validator.js` & `sanitizer.js`)
- `sanitizeOptionsList`: gracefully handle both string options and object options `{ text, media }`.
- Ensure option text is clamped to 100 characters and valid UTF-8.

---

## 3. Constraints & Error Handling
- Never throw unhandled exceptions during poll delivery.
- All errors logged with descriptive tags (`[sendNextQuestionPoll]`).
- All user-facing strings must use `getMessage()` or localization keys; no hardcoded Uzbek text in code.
