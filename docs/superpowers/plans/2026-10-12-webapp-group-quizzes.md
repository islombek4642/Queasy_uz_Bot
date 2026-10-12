# WebApp Guruh Viktorinalari (Group Quizzes) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** WebApp ichida Telegram guruh a'zolari uchun maxsus Guruh Turniri (Group Tournament) va ulashish tizimini to'liq integratsiya qilish, guruh peshqadamlari reytingi hamda jonli xona poydevorini yaratish.

**Architecture:** Telegram WebApp'ning `startapp` deep-link mexanizmi orqali guruhga taklif havolasi yuboriladi. Ishtirokchilar havolani bosganda WebApp ichidagi guruh turniri rejimiga tushishadi, testni yechib o'zaro guruh reytingini shakllantirishadi.

**Tech Stack:** React 19, Vite, SQLite (`sdk/db`), Vanilla CSS Glassmorphism, Telegram WebApp API.

**Spec:** [docs/superpowers/specs/2026-10-12-webapp-group-quizzes-design.md](file:///d:/Serverless/Queasy_uz_Bot/docs/superpowers/specs/2026-10-12-webapp-group-quizzes-design.md)

## Global Constraints
- Barcha yangi matnlar `uz.js` va `ru.js` lokalizatsiya fayllariga kiritilishi shart (hardcode qilinmaydi).
- Mavjud ranglar va dizayn tokenlariga (`src/styles/variables.css`) tegilmaydi.
- Serverless backend (`tgcloud/`) SQLite bazasi bilan to'liq mos kelishi, mavjud bot polling tizimini buzmasligi shart.

## Review Focus
- Noto'g'ri yoki mavjud bo'lmagan `shareCode` bilan WebApp ochilganda foydalanuvchiga to'g'ri xatolik xabari chiqishi va bosh sahifaga qaytishi.
- Bir ishtirokchi turnirni qayta topshirganda faqat uning eng yaxshi yoki so'nggi balli to'g'ri yangilanishi.
- Guruhga ulashish oynasi ochilmay qolganda zaxira (fallback) nusxalash (clipboard) tugmasi ishlashi.
- Anonim yoki Telegram ID siz (brauzerda) ochilganda ham xatoliksiz test topshirila olishi.
- Har bir test kartasining kengayishi va qator taqsimoti buzilmasligi.

---

### Task 1: Ma'lumotlar bazasi sxemasini kengaytirish (`tgcloud/schema.js`)

**Files:**
- Modify: `d:/Serverless/Queasy_uz_Bot/tgcloud/schema.js:120-143`

**Interfaces:**
- Produces: `groupTournaments`, `tournamentParticipants`, `liveRooms` table definitions.

- [ ] **Step 1: `tgcloud/schema.js` fayliga `groupTournaments`, `tournamentParticipants` va `liveRooms` jadvallarini qo'shish**
- [ ] **Step 2: Sintaksis va exportlarni tekshirish**
- [ ] **Step 3: Commit qilish**
```bash
git add tgcloud/schema.js
git commit -m "feat(db): add tables for group tournaments and live rooms"
```

---

### Task 2: Backend API endpointlarini yaratish (`tgcloud/endpoints/`)

**Files:**
- Create: `d:/Serverless/Queasy_uz_Bot/tgcloud/endpoints/create_tournament.js`
- Create: `d:/Serverless/Queasy_uz_Bot/tgcloud/endpoints/get_tournament_details.js`
- Create: `d:/Serverless/Queasy_uz_Bot/tgcloud/endpoints/submit_tournament_result.js`

**Interfaces:**
- Consumes: `groupTournaments`, `tournamentParticipants`, `quizzes`, `questions`, `users` from `../schema.js`.
- Produces:
  - `POST /create_tournament`: `{ quizId } -> { success: true, shareCode, shareLink }`
  - `POST /get_tournament_details`: `{ shareCode } -> { tournament, quiz, leaderboard }`
  - `POST /submit_tournament_result`: `{ shareCode, score, totalQuestions, totalTimeSeconds } -> { success: true, rank, totalParticipants }`

- [ ] **Step 1: `create_tournament.js` endpointini yaratish (noyob `gt_...` kod yaratadi va saqlaydi)**
- [ ] **Step 2: `get_tournament_details.js` endpointini yaratish (turnir holati, test tafsilotlari va Top 20 guruh ishtirokchilarini qaytaradi)**
- [ ] **Step 3: `submit_tournament_result.js` endpointini yaratish (ishtirokchi natijasini yozadi, o'rnini hisoblaydi)**
- [ ] **Step 4: Commit qilish**
```bash
git add tgcloud/endpoints/
git commit -m "feat(api): implement tournament creation, details and result submission endpoints"
```

---

### Task 3: Lokalizatsiya matnlarini qo'shish (`uz.js`, `ru.js`)

**Files:**
- Modify: `d:/Serverless/Queasy_uz_Bot/src/i18n/locales/uz.js`
- Modify: `d:/Serverless/Queasy_uz_Bot/src/i18n/locales/ru.js`

**Interfaces:**
- Produces: Yangi i18n kalitlar (`GROUP_SHARE_TOURNAMENT`, `GROUP_LIVE_ROOM`, `TOURNAMENT_TITLE`, `TOURNAMENT_LEADERBOARD`, `SHARE_RESULT_TO_GROUP`, `COPY_LINK`, va h.k.).

- [ ] **Step 1: `uz.js` fayliga guruh turniri va ulashish kalitlarini qo'shish**
- [ ] **Step 2: `ru.js` fayliga mos tarjimalarni kiritish**
- [ ] **Step 3: Commit qilish**
```bash
git add src/i18n/locales/
git commit -m "feat(i18n): add group tournament and sharing translations"
```

---

### Task 4: Frontend API xizmatlari va Deep-Link Routerni ulash (`quizService.js`, `App.jsx`)

**Files:**
- Modify: `d:/Serverless/Queasy_uz_Bot/src/services/quizService.js`
- Modify: `d:/Serverless/Queasy_uz_Bot/src/App.jsx`

**Interfaces:**
- Produces:
  - `createTournament(quizId)`
  - `fetchTournamentDetails(shareCode)`
  - `submitTournamentResult(payload)`
  - `App.jsx` da `startapp=gt_...` parametrini tutib olib `tournament` ko'rinishini ochish mantiqi.

- [ ] **Step 1: `quizService.js` ga 3 ta turnir funksiyasini qo'shish**
- [ ] **Step 2: `App.jsx` da Telegram `tg.initDataUnsafe.start_param` (yoki URL param) tekshiruvini kiritish**
- [ ] **Step 3: Commit qilish**
```bash
git add src/services/quizService.js src/App.jsx
git commit -m "feat(app): add tournament service methods and deep-link routing"
```

---

### Task 5: Guruh Turniri Ko'rinishi va Natijalar Ekranini yaratish (`TournamentView.jsx`)

**Files:**
- Create: `d:/Serverless/Queasy_uz_Bot/src/views/TournamentView.jsx`
- Modify: `d:/Serverless/Queasy_uz_Bot/src/views/QuizView.jsx` (turnir rejimida natijani `submitTournamentResult` ga yuborish)

**Interfaces:**
- Consumes: `fetchTournamentDetails`, `submitTournamentResult` from `quizService.js`.
- Produces: Guruh kutish ekrani, Jonli guruh reytingi, Testni boshlash va Natijani guruhga ulashish oynasi.

- [ ] **Step 1: `TournamentView.jsx` komponentini yaratish (Turnir kartasi, Top ishtirokchilar, Start tugmasi)**
- [ ] **Step 2: Viktorina yakunida turnir reytingi va "Guruhga ulashish" tugmasini ko'rsatish**
- [ ] **Step 3: Commit qilish**
```bash
git add src/views/TournamentView.jsx src/views/QuizView.jsx
git commit -m "feat(ui): implement TournamentView and group results share screen"
```

---

### Task 6: `GroupHostView.jsx` sahifasini yangilash

**Files:**
- Modify: `d:/Serverless/Queasy_uz_Bot/src/views/GroupHostView.jsx`

**Interfaces:**
- Consumes: `createTournament` from `quizService.js`.
- Produces: "Guruhga ulashish" tugmasi bosilganda avtomatik turnir yaratilib, Telegram `share/url` oynasi ochilishi; faol turnirlar ro'yxatini ko'rsatish.

- [ ] **Step 1: Kartalar ostidagi tugmalarni "Guruhga ulashish" (Turnir) va "Jonli xona (Tez kunda)" ga ajratish**
- [ ] **Step 2: "Guruhga ulashish" bosilganda `createTournament` chaqirilib, Telegram dialog oynasini ochish**
- [ ] **Step 3: Commit qilish**
```bash
git add src/views/GroupHostView.jsx
git commit -m "feat(ui): update GroupHostView with tournament creation and telegram share dialog"
```

---

### Task 7: Build, Sinov va Serverless Sinxronizatsiya

**Files:**
- Test & Verify: `npm run build`
- Deploy: `tgcloud` sync

- [ ] **Step 1: `npm run build` orqali frontend to'g'ri yig'ilganligini tekshirish**
- [ ] **Step 2: Barcha o'zgarishlarni tekshirish va serverlessga joylash**
- [ ] **Step 3: Yakuniy tasdiq**
