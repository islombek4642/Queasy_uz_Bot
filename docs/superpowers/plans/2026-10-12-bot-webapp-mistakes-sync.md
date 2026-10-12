# Bot va Web App Xatolar Sinxronizatsiyasi (Mistakes Sync) Implementatsiya Rejasi

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Telegram Bot va Telegram Mini App (Web App) o'rtasida "Xatolar ustida ishlash" (Mistakes Bank) tizimini to'liq ikki tomonlama (Two-Way Sync) sinxronlashtirish.

**Architecture:** Umumiy SQLite ma'lumotlar bazasi (`user_mistakes`, `quiz_sessions`) asosida backend serverless endpointlari (`submit_solo_result.js`, `get_user_mistakes.js`) hamda frontend (`ArenaView.jsx`, `HomeView.jsx`, `App.jsx`) komponentlarini xatolarni yig'ish, tozalash va deduplikatsiya qilish bo'yicha integratsiya qilish.

**Tech Stack:** JavaScript (ESM), Telegram Serverless (`sdk/db`, `sdk/api`), React 19, Vite, Node.js Test Runner.

**Spec:** [docs/superpowers/specs/2026-10-12-bot-webapp-mistakes-sync-design.md](file:///c:/Queasy_uz_Bot/docs/superpowers/specs/2026-10-12-bot-webapp-mistakes-sync-design.md)

## Global Constraints

- Backend fayllari faqat `tgcloud/` katalogida joylashadi va `sdk` hamda `sdk/db` dan foydalanadi.
- Nisbiy importlar majburiy `.js` kengaytmasiga ega bo'lishi shart (`import ... from '../schema.js'`).
- SQLite bazasida tashqi kalitlar (Foreign Keys) o'chirilgan, yaxlitlik dasturiy kod darajasida ta'minlanadi.
- Frontend tashqi API ga emas, `Telegram.WebApp.Serverless.call` orqali bevosita endpointlarga murojaat qiladi.
- Zero-Hardcode qoidasiga rioya qilinadi.

## Review Focus

- Xatolar rejimida test yakunlanganda `quizId: null` yoki `0` bo'lsa, so'rov rad etilmasdan `mode: 'mistakes'` sessiyasi sifatida qabul qilinishi va XP berilishi.
- Bir xil savol bir necha marta xato qilinganda, bazada duplikat bo'lib ko'payib ketmasligi.
- Web Appda to'g'ri topilgan savollar bazadagi `user_mistakes` jadvalidan haqiqatdan ham `DELETE` qilinishi.
- Oddiy test yechilayotganda adashilgan savollar `failedQuestions` orqali bazaga to'liq tushishi.
- Barcha xatolar to'g'rilangandan so'ng, `HomeView` dagi xatolar banneri avtomatik yashirilishi (`count === 0`).

---

### Task 1: Backend Endpointlari Mantiqini Tekshiruvchi Unit-Test Yaratish

**Files:**
- Create: `tests/test_mistakes_sync.mjs`

**Interfaces:**
- Consumes: `submit_solo_result.js` mantiqi, `get_user_mistakes.js` mantiqi
- Produces: Yangi endpoint mantiqining to'g'riligini tasdiqlovchi avtomatlashtirilgan test

- [ ] **Step 1: Write the failing unit test in `tests/test_mistakes_sync.mjs`**

```javascript
// Test logic for deduplication, mistakes submission, and resolved mistakes deletion
```

- [ ] **Step 2: Run test to verify it fails before backend implementation**

Run: `node tests/test_mistakes_sync.mjs`  
Expected: FAIL

- [ ] **Step 3: Commit initial test**

```bash
git add tests/test_mistakes_sync.mjs
git commit -m "test: add unit test for mistakes sync logic"
```

---

### Task 2: Backend Endpointlarini Refaktoring Qilish

**Files:**
- Modify: `tgcloud/endpoints/submit_solo_result.js`
- Modify: `tgcloud/endpoints/get_user_mistakes.js`
- Test: `tests/test_mistakes_sync.mjs`

**Interfaces:**
- Consumes: `input.isMistakesMode`, `input.failedQuestions`, `input.resolvedMistakeIds`
- Produces: Tozalangan xatolar soni, duplikatsiz yozuvlar va muvaffaqiyatli xatolar sessiyasi

- [ ] **Step 1: Update `tgcloud/endpoints/submit_solo_result.js`**
  - `isMistakesMode` yoki `quizId === 0` holatini qo'llab-quvvatlash.
  - `quiz_sessions` ga to'g'ri rejim (`mistakes` yoki `full`) bilan yozish.
  - `resolvedMistakeIds` dagi barcha ID larni `user_mistakes` dan xavfsiz o'chirish (`userId` tekshiruvi bilan).
  - `failedQuestions` ni duplikatlarni tekshirgan holda (`(userId, questionText)`) `user_mistakes` ga qo'shish.
- [ ] **Step 2: Update `tgcloud/endpoints/get_user_mistakes.js`**
  - Savollarni `questionText` bo'yicha deduplikatsiya qilish.
  - Har bir elementda `id` va `mistakeId` qaytarilishini ta'minlash.
- [ ] **Step 3: Run unit tests**

Run: `node tests/test_mistakes_sync.mjs`  
Expected: PASS

- [ ] **Step 4: Check tgcloud syntax**

Run: `node tests/test_syntax.mjs`  
Expected: PASS

- [ ] **Step 5: Commit backend changes**

```bash
git add tgcloud/endpoints/submit_solo_result.js tgcloud/endpoints/get_user_mistakes.js
git commit -m "fix(backend): support mistakes mode, resolved cleanup and deduplication in solo results"
```

---

### Task 3: Frontend Arena View Komponentini Yangilash

**Files:**
- Modify: `src/views/ArenaView.jsx`

**Interfaces:**
- Consumes: `customQuestions` (mistakes items with `id` or `mistakeId`)
- Produces: `submitSoloResult` ga `failedQuestions`, `resolvedMistakeIds`, `isMistakesMode` uzatish

- [ ] **Step 1: Update `src/views/ArenaView.jsx`**
  - `failedQuestionsRef` va `resolvedMistakeIdsRef` qo'shish.
  - `handleSelectOption` va `handleTimeout` da:
    - Xato bo'lsa: oddiy testda `failedQuestionsRef.current.push(...)`.
    - To'g'ri bo'lsa: xatolar rejimida `resolvedMistakeIdsRef.current.push(currentQ.mistakeId || currentQ.id)`.
  - `handleAdvance` da:
    - Test yakunlanganda `submitSoloResult` chaqiruviga barcha parametrlarni to'liq uzatish:
      `{ quizId: quizId || 0, isMistakesMode: Boolean(customQuestions), correctCount, wrongCount, timeSpent: elapsed, failedQuestions: failedQuestionsRef.current, resolvedMistakeIds: resolvedMistakeIdsRef.current }`.
- [ ] **Step 2: Verify component and syntax**
- [ ] **Step 3: Commit frontend Arena changes**

```bash
git add src/views/ArenaView.jsx
git commit -m "feat(frontend): track and submit failed questions and resolved mistakes in ArenaView"
```

---

### Task 4: Frontend State Refresh va HomeView Integratsiyasi

**Files:**
- Modify: `src/views/HomeView.jsx`
- Modify: `src/App.jsx`

**Interfaces:**
- Consumes: `refreshData()`, `fetchUserMistakes()`
- Produces: Arenadan chiqqanda xatolar bannerining real vaqtda to'g'ri yangilanishi

- [ ] **Step 1: Update `src/views/HomeView.jsx`**
  - `fetchUserMistakes()` natijasida `count === 0` bo'lsa ham `setMistakesData({ mistakes: [], count: 0 })` qilinishini ta'minlash.
  - Prop yoki `initialData` yangilanganda xatolar ma'lumotlarini qayta yuklash.
- [ ] **Step 2: Update `src/App.jsx`**
  - Arenadan chiqqanda `refreshData()` nafaqat boshlang'ich ma'lumotlarni, balki xatolar hisobini ham yangilashini kafolatlash.
- [ ] **Step 3: Commit state refresh changes**

```bash
git add src/views/HomeView.jsx src/App.jsx
git commit -m "fix(frontend): properly update mistakes counter and hide banner when resolved"
```

---

### Task 5: Butun Tizimni Sinovdan O'tkazish va Yakuniy Tekshiruv

**Files:**
- All tests in `tests/`
- AST Knowledge Graph

- [ ] **Step 1: Run all test suites**

Run: `node tests/test_hybrid_parsers.mjs; node tests/test_messages_parity.mjs; node tests/test_keyboards_i18n.mjs; node tests/test_mistakes_sync.mjs; node tests/test_syntax.mjs`  
Expected: ALL PASS

- [ ] **Step 2: Run graphify update**

Run: `npx graphify update .` (yoki `python -m graphify.cli update .`)

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "feat: complete bidirectional mistakes synchronization between Bot and Mini App"
```
