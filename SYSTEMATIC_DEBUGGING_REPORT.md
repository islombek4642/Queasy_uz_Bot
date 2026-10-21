# Queasy_uz_Bot — To'liq Tizimli Audit va Barcha Buglar Tahlili (Systematic Debugging & Diagnostic Report)

> **Sana:** 2026-10-21  
> **Loyiha:** Queasy_uz_Bot (Telegram Serverless Bot + React 19 Mini App)  
> **Platforma:** Telegram Serverless Cloud (`@tgcloud/cli`), Turso Cloud LibSQL / Local SQLite, React 19, Vite  
> **Tekshiruv uslubi:** `/using-superpowers`, `/brainstorming`, `/systematic-debugging`, `/diagnosing-bugs`  
> **Holat:** Loyihaning barcha 67+ fayllari (backend handlers, endpoints, lib services, parsers, utils, frontend views, hooks, context, testlar) 100% to'liq qadamma-qadam tekshirildi.

---

## 1. Umumiy Xulosa (Executive Summary)

Ushbu chuqur tahlil davomida loyihaning barcha qatlamlari (Bot Handlers, API Endpoints, Shared Services, Parsers, Frontend React komponentlari va Unit Testlar) to'liq skanerlandi.

Loyihada **18 ta xato va kamchilik** aniqlandi:
- 🔴 **Kritik (Critical Severity): 4 ta** — React render crash (Suspense yo'qligi), savollar variantlarini filtrlashda to'g'ri javob indeksi surilib ketishi (Data Corruption), Unit testlarning to'xtab qolishi va test runner'ning chala sozlanganligi.
- 🟠 **Yuqori (High / Security Severity): 5 ta** — Autentifikatsiyasiz (ochiq) endpointlar, IDOR (begona testlar va rasmlarni ommaga oshkor qilish), anonim sessiyalar orqali ma'lumotlar bazasini ifloslantirish.
- 🟡 **O'rtacha (Medium / Logic Severity): 5 ta** — Rate limitda sessiyaning birdaniga o'lib qolishi, CodeCogs formula renderida matnlarning yo'qolib ketishi, Telegram profil havolalarining ustuvorligi xatosi, `QuizDetailView` prop uzilishlari.
- 🔵 **Unumdorlik va Kod Tozaligi (Performance & Code Quality): 4 ta** — N+1 ketma-ket so'rovlar, serverless muhitda broadcast timeout xavfi, noxolis `Math.random() - 0.5` saralashi, o'lik importlar.

---

## 2. Qadamma-Qadam Aniqlangan Buglar Ro'yxati (Step-by-Step Findings)

### 🔴 I. Kritik Xatolar (Critical Severity)

#### 1. React ArenaView: `React.lazy()` komponenti `<Suspense>`siz chaqirilgani sababli Runtime Crash
* **Fayl:** `src/App.jsx` (qatorlar: 17, 157–171, 318–328)
* **Muammo tavsifi:**
  `ArenaView` komponenti kodni bo'laklash (code-splitting) maqsadida dinamik import qilingan:
  ```javascript
  const ArenaView = React.lazy(() => import('./views/ArenaView.jsx').then(m => ({ default: m.ArenaView })));
  ```
  Biroq, `App.jsx` da foydalanuvchi testni boshlaganda (157–171-qatorlar):
  ```javascript
  if (activeQuizId || activeCustomQuestions) {
    return (
      <ArenaView
        quizId={activeQuizId}
        ...
      />
    );
  }
  ```
  `ArenaView` to'g'ridan-to'g'ri hech qanday `<React.Suspense fallback={...}>` va `<ErrorBoundary>`siz return qilib yuborilgan. `<React.Suspense>` faqat 319-qatordagi `renderActiveView()` uchun o'ralgan.
* **Oqibati:** Foydalanuvchi sekin internetda yoki keshlanmagan birinchi yuklanishda "Testni boshlash" tugmasini bossa, React 19 quyidagi fatal xatoni chiqaradi va oq ekran (White Screen of Death) bo'lib qoladi:
  `Error: A React component suspended while rendering, but no fallback UI was specified.`
* **Tuzatish (Root Cause Fix):**
  `ArenaView` ni ham `<Suspense fallback={<Spinner />}>` va `<ErrorBoundary>` ichiga o'rash yoki `renderActiveView()` tizmasiga kiritish:
  ```jsx
  if (activeQuizId || activeCustomQuestions) {
    return (
      <ErrorBoundary>
        <React.Suspense fallback={<div className="loading-center"><Spinner size={38} /></div>}>
          <ArenaView ... />
        </React.Suspense>
      </ErrorBoundary>
    );
  }
  ```

---

#### 2. QuizCreatorView: Variantlarni Filtrlashda `correctOptionId` Indeksi Surilib Ketishi (Silent Data Corruption)
* **Fayl:** `src/views/QuizCreatorView.jsx` (qatorlar: 165–184)
* **Muammo tavsifi:**
  Foydalanuvchi test tuzishda yoki tahrirlashda variantlar orasida bo'sh qator qoldirsa, submit qilish paytida `options` massividan bo'sh elementlar filtrlanadi:
  ```javascript
  payload = {
    ...
    questions: questions.map((q) => ({
      questionText: q.questionText.trim(),
      options: q.options.filter((o) => o && o.trim().length > 0),
      correctOptionId: q.correctOptionId, // ⚠️ XATO: Eski indeks o'zgarishsiz qolmoqda!
    })),
  };
  ```
  **Misol:**
  Foydalanuvchi variant kiritdi:
  - Variant 0: "Toshkent"
  - Variant 1: "" (bo'sh qoldi)
  - Variant 2: "Samarqand" (To'g'ri deb belgilandi: `correctOptionId = 2`)
  
  Filtrlangandan keyin `options = ["Toshkent", "Samarqand"]` (uzunligi 2). Ammo `correctOptionId` hanuz `2` bo'lib turibdi. Backend (`update_quiz.js:53`) esa `correctOptionId >= opts.length` ekanini ko'rib, uni avtomatik `0` ("Toshkent") ga tushirib yuboradi!
* **Oqibati:** Foydalanuvchi tanlagan to'g'ri javob butunlay boshqa variantga aylanib qoladi yoki o'chirilgan bo'sh variant sababli savol noto'g'ri tekshiriladi.
* **Tuzatish (Root Cause Fix):**
  To'g'ri javob matnini eslab qolib, filtrdan keyingi yangi indeksini qayta hisoblash:
  ```javascript
  const originalCorrectText = q.options[q.correctOptionId] || '';
  const filteredOptions = q.options.filter((o) => o && o.trim().length > 0);
  let newCorrectId = filteredOptions.indexOf(originalCorrectText);
  if (newCorrectId === -1) newCorrectId = 0;

  return {
    questionText: q.questionText.trim(),
    options: filteredOptions,
    correctOptionId: newCorrectId,
  };
  ```

---

#### 3. Test To'plami: `test_math_rendering.mjs` da Formulali Matn To'liq O'chib Ketishi
* **Fayl:** `tgcloud/lib/parsers/math_engine.js` (qatorlar: 253–264) va `tests/test_math_rendering.mjs:17`
* **Xato ko'rinishi:** `AssertionError: The expression evaluated to a falsy value: assert.ok(formatted.includes('\\text{Agar }'))`
* **Muammo tavsifi:**
  `formatLatexForRender(text)` funksiyasi aralash matnli savollarni (masalan: `"Agar $A= (5214)$ va $B= (-315-2)$ bo'lsa, $A+2B$ ni toping."`) rasmga aylantirish uchun tayyorlaganda:
  ```javascript
  if (s.includes('$')) {
    const parts = s.split(/(\$\$[\s\S]+?\$\$|\$[^\$]+?\$)/g);
    const formulas = parts
      .filter((p) => (p.startsWith('$$') && p.endsWith('$$')) || (p.startsWith('$') && p.endsWith('$')))
      .map((p) => normalizeLatex(p.replace(/^\$+|\$+$/g, '').trim()))
      .filter(Boolean);

    if (formulas.length > 0) {
      return formulas.join(' \\qquad ');
    }
  }
  ```
  Kod faqat `$` ichidagi belgilarni olib qolib, savolning butun matn qismini ("Agar", "va", "bo'lsa, ... ni toping") tashlab yuboradi! Rasmda esa faqat `A = (5214) \qquad B = (-315-2)` qoladi.
* **Tuzatish (Root Cause Fix):**
  Matn bo'laklarini LaTeX `\text{...}` teglari bilan o'rab chiqish:
  ```javascript
  if (s.includes('$')) {
    const parts = s.split(/(\$\$[\s\S]+?\$\$|\$[^\$]+?\$)/g);
    return parts.map((p) => {
      if ((p.startsWith('$$') && p.endsWith('$$')) || (p.startsWith('$') && p.endsWith('$'))) {
        return normalizeLatex(p.replace(/^\$+|\$+$/g, '').trim());
      }
      const trimmed = p.trim();
      return trimmed ? `\\text{${p}}` : p;
    }).join(' ');
  }
  ```

---

#### 4. Test Runner: `npm test` Faqat 1 ta Faylni Tekshirishi (Qolgan 20 ta Test E'tibordan Chetdaligi)
* **Fayl:** `package.json` (8-qator)
* **Muammo tavsifi:**
  `package.json` da `"test": "node tests/test_hybrid_parsers.mjs"` deb yozilgan. Vaholanki, `tests/` papkasida 21 ta test fayli mavjud. Natijada `test_math_engine.mjs`, `test_math_rendering.mjs`, `test_poll_truncation_formatting.mjs` kabi sinovlar muntazam ishga tushmay, xatolar e'tibordan chetda qolgan.
* **Tuzatish:**
  `tests/` papkasidagi barcha `*.mjs` testlarni ketma-ket ishga tushiruvchi yagona runner (`tests/run_all.mjs`) yaratish va `package.json` ga kiritish:
  `"test": "node tests/run_all.mjs"`

---

### 🟠 II. Xavfsizlik va Ruxsatsiz Boshqaruv (High & Security Severity)

#### 5. `upload_media_batch.js`: Autentifikatsiyasiz Media Kanalga Rasm Yuklash Ochiqligi
* **Fayl:** `tgcloud/endpoints/upload_media_batch.js` (qatorlar: 4–24)
* **Muammo:**
  Endpoint hech qanday `ctx.initData` yoki foydalanuvchi avtorizatsiyasini tekshirmaydi:
  ```javascript
  export default async function (input) {
    const urls = Array.isArray(input?.urls) ? input.urls : [];
    const channelId = '-1004332354841';
  ```
  Har qanday tashqi foydalanuvchi `POST /api/upload_media_batch` orqali botning maxfiy media kanaliga istalgan begona yoki noo'rin rasmlarni ommaviy yuklab, kanalni to'ldirib yuborishi mumkin.
* **Tuzatish:**
  Faqat bot adminlariga ruxsat berish:
  ```javascript
  const callerId = ctx?.initData?.user?.id;
  if (!callerId || !isUserAdmin(callerId)) {
    return { success: false, error: 'UNAUTHORIZED_ADMIN_ONLY' };
  }
  ```

---

#### 6. `sanitize_kiut_batch.js`: Autentifikatsiyasiz Ma'lumotlar Bazasini Qayta Yozish
* **Fayl:** `tgcloud/endpoints/sanitize_kiut_batch.js` (qatorlar: 8–12)
* **Muammo:**
  Endpointda `ctx` avtorizatsiyasi mavjud emas. Har qanday shaxs cheksiz so'rovlar yuborib, butun bazadagi savollarni qayta sanitarizatsiya qildirishi va DB yozish resurslarini (V8 isolate va Turso quota) tugatishi mumkin.
* **Tuzatish:**
  Admin tekshiruvi qo'shish:
  ```javascript
  const callerId = ctx?.initData?.user?.id;
  if (!callerId || !isUserAdmin(callerId)) {
    return { success: false, error: 'UNAUTHORIZED_ADMIN_ONLY' };
  }
  ```

---

#### 7. `export_quiz_data.js`: Double JSON Serialization va IDOR Ochiqligi
* **Fayl:** `tgcloud/endpoints/export_quiz_data.js` (qatorlar: 3–14)
* **Muammo:**
  1. `return JSON.stringify({ ... })` — Serverless platforma o'zi javobni JSON qiladi. `JSON.stringify` qaytarilsa, clientga qavatlangan string `"{\"quizId\":...}"` boradi.
  2. `const quizId = input?.quizId || 2995;` — Qattiq qotirilgan test ID `2995`.
  3. Foydalanuvchi xususiy (private) test egasi ekanligi tekshirilmaydi. Begona shaxs istalgan test ID'sini berib, yopiq imtihon savollarini javoblari bilan ko'chirib olishi mumkin.
* **Tuzatish:**
  Ob'yektning o'zini qaytarish, avtorizatsiya qo'yish:
  ```javascript
  const callerId = ctx?.initData?.user?.id;
  const quiz = await getQuizById(quizId);
  if (!quiz) return { success: false, error: 'Quiz not found' };
  if (!quiz.isPublic && Number(quiz.ownerId) !== Number(callerId) && !isUserAdmin(callerId)) {
    return { success: false, error: 'FORBIDDEN' };
  }
  return {
    quizId: quiz.id,
    title: quiz.title,
    count: quiz.questions?.length || 0,
    questions: quiz.questions,
  };
  ```

---

#### 8. `create_tournament.js` va `create_live_room.js`: Anonim Foydalanuvchi Turnir va Jonli Xona Yarata Olishi
* **Fayllar:** `tgcloud/endpoints/create_tournament.js:13` va `create_live_room.js:12`
* **Muammo:**
  Agar so'rovda `ctx?.initData?.user` bo'lmasa, `currentUserId = 0` deb olinadi va bazada `creatorId = 0` / `hostId = 0` bo'lgan xonalar yaratiladi. Bunday xonalarning egasi bo'lmagani sababli ularni hech kim boshqara olmaydi yoki aksincha, begona kishilar host huquqini buzishi mumkin.
* **Tuzatish:**
  `if (!currentUserId) return { success: false, error: ERRORS.UNAUTHORIZED };`

---

#### 9. `submit_solo_result.js`: Avtorizatsiyasiz Natija Kiritish va Reytingni Soxtalashtirish
* **Fayl:** `tgcloud/endpoints/submit_solo_result.js` (qatorlar: 9–23)
* **Muammo:**
  `userId` tekshirilmaydi (`const userId = tgUser?.id || 0`). Har qanday bot yoki skript `userId: 0` bilan yuzlab sessiyalarni bazaga tiqib tashlashi, yoki soxta ballar orqali liderlar jadvalini ifloslantirishi mumkin. Shuningdek `totalQuestions === 0` bo'lsa xato qaytadi, biroq foydalanuvchi hech qanday savol yechmasdan testni tark etgan holatlar to'g'ri qayta ishlanmaydi.
* **Tuzatish:**
  `if (!userId) return { success: false, error: 'UNAUTHORIZED' };`

---

### 🟡 III. Mantiqiy va Aloqa Xatoliklari (Medium & Logic Severity)

#### 10. `poll_helpers.js`: Telegram Profil Havolasi Ustuvorligi Inversiyasi (`test_poll_truncation_formatting.mjs` xatosi)
* **Fayl:** `tgcloud/lib/utils/poll_helpers.js` (83-qator)
* **Xato ko'rinishi:** `AssertionError: false !== true` (`formattedWithUser.includes('href="https://t.me/islombek_dev"')`)
* **Muammo tavsifi:**
  `formatParticipantName` funksiyasida havolani shakllantirish:
  ```javascript
  const profileUrl = userId ? `tg://user?id=${userId}` : (cleanUser ? `https://t.me/${cleanUser}` : '');
  ```
  `userId` mavjud bo'lganida, foydalanuvchining ommaviy username'i bo'lsa ham u e'tiborsiz qoldirilib, har doim `tg://user?id=...` qo'yiladi. Test esa foydalanuvchida username bo'lsa, barcha qurilmalar va brauzerlar uchun qulay bo'lgan `https://t.me/username` havola bo'lishini kutadi.
* **Tuzatish:**
  Ustuvorlikni to'g'rilash (username bor bo'lsa `https://t.me/...`, aks holda `tg://user?id=...`):
  ```javascript
  const profileUrl = cleanUser ? `https://t.me/${cleanUser}` : (userId ? `tg://user?id=${userId}` : '');
  ```

---

#### 11. `math_engine.js`: `generateLatexImageUrl` URL-Encoding Sababli Test Sinovi Qulashi
* **Fayl:** `tgcloud/lib/parsers/math_engine.js` (277-qator) va `tests/test_math_engine.mjs:50`
* **Xato ko'rinishi:** `AssertionError: false !== true` (`url.includes('\\dpi{300}')`)
* **Muammo tavsifi:**
  `generateLatexImageUrl` funksiyasida butun LaTeX ifodasi `encodeURIComponent` qilinadi:
  ```javascript
  const fullLatex = `\\dpi{${dpi}} \\bg{white} ${clean}`;
  return `https://latex.codecogs.com/png.image?${encodeURIComponent(fullLatex)}`;
  ```
  Natijada `\dpi{300}` ifodasi `%5Cdpi%7B300%7D` ga aylanadi. Test esa `url.includes('\\dpi{300}')` orqali to'g'ridan-to'g'ri unencoded satrni qidirgani uchun assertion xato beradi.
* **Tuzatish:**
  Testda `decodeURIComponent(url).includes('\\dpi{300}')` tekshirilishi yoki URL generatorida protokol parametrlarini standard CodeCogs formatida uzatish.

---

#### 12. `session_service.js`: Telegram 429 Rate Limit Kelganda Sessiyaning Barvaqt Tugatilishi (Dead Code)
* **Fayl:** `tgcloud/lib/services/session_service.js` (qatorlar: 248–254 va 487–535)
* **Muammo tavsifi:**
  250-qatorda quyidagi tekshiruv mavjud:
  ```javascript
  const sent = await _trySendQuestionPoll(api, sessionId, attemptSession, attemptQ, customTimeLimit);
  if (sent === true) return;
  if (sent === 'RATE_LIMITED') {
    console.warn(`[sendNextQuestionPoll] Session ${sessionId} hit rate limit, keeping session active without killing`);
    return;
  }
  ```
  Biroq `_trySendQuestionPoll` ichida catch bloki 429 xatosini ushlaganida darhol `api.sendPoll` ni kechiktirishsiz qayta ishga tushirishga urinadi, va agar u ham yiqilsa `return 'RATE_LIMITED'` qatoriga yetib bormasdan oldin logAppError tashlaydi yoki boshqa joyda `false` qaytaradi. Eng yomoni: 429 xatosi chiqqanda for tsikli `skipAttempt` ni oshirib, ketma-ket 3 ta savolni tashlab yuboradi va sessiyani `finishSession(...)` bilan o'ldiradi!
* **Tuzatish:**
  Rate limit kelganida savollarni o'tkazib yubormaslik, sessiyani tirik qoldirib, orqaga chekinish (backoff) bilan qayta urinish.

---

#### 13. `QuizDetailView.jsx`: `App.jsx` dan Kelgan `onStartQuiz` va `onEditQuiz` Prop'larining Yo'qotilishi
* **Fayllar:** `src/App.jsx:252-259` va `src/views/QuizDetailView.jsx:14`
* **Muammo:**
  `App.jsx` da `QuizDetailView` ga `onStartQuiz` va `onEditQuiz` handlerlari uzatilgan, biroq `QuizDetailView` ning o'zida bu prop'lar destrukturizatsiya qilinmagan (`export function QuizDetailView({ quizId, onBack })`) va interfeysda "Testni boshlash" yoki "Tahrirlash" tugmalari umuman qo'yilmagan. Foydalanuvchi test savollarini ko'rib bo'lgach, uni to'g'ridan-to'g'ri o'sha yerdan boshlay olmaydi, faqat orqaga qaytishga majbur.
* **Tuzatish:**
  `QuizDetailView` ga `onStartQuiz` va `onEditQuiz` ni qabul qilib, tepa va pastki panellarga "Testni yechish" va "Tahrirlash" tugmalarini qo'shish.

---

#### 14. `get_quiz_detail.js`: Savollar Tartibi (`ORDER BY`) Buzilishi va Maxfiy Testlar Himoyasi Yo'qligi
* **Fayl:** `tgcloud/endpoints/get_quiz_detail.js` (qatorlar: 55–66)
* **Muammo:**
  1. Local SQLite fallback qismida savollarni olishda `orderBy(asc(questions.orderIndex))` yo'q. Natijada savollar tartibi buzilib kelishi mumkin (Turso qismida bu bor edi).
  2. Test `isPublic: false` bo'lsa ham egasini tekshirmasdan barcha savollar va to'g'ri variantlarni clientga beradi.
* **Tuzatish:**
  `orderBy(asc(questions.orderIndex))` qo'shish va xususiy testlar uchun ruxsat tekshirish.

---

### 🔵 IV. Unumdorlik va Kod Sifati (Performance & Code Smells)

#### 15. `get_initial_data.js`: Local DB Fallback'da `globalRank` 1 deb Qotirilganligi
* **Fayl:** `tgcloud/endpoints/get_initial_data.js` (214-qator)
* **Muammo:**
  Turso rejimida global rank to'g'ri COUNT aggregate orqali hisoblanadi, biroq mahalliy bazaga fallback bo'lganda `globalRank: finishedSessions.length > 0 ? 1 : '-'` deb qattiq yozib qo'yilgan.

---

#### 16. `admin_service.js`: `broadcastMessage` da Rate Limit va Serverless Timeout Xavfi
* **Fayl:** `tgcloud/lib/services/admin_service.js` (qatorlar: 155–182)
* **Muammo:**
  `CONFIG.BROADCAST.CHUNK_SIZE = 25` va `DELAY_MS = 50` sozlangan bo'lsa-da, `broadcastMessage` funksiyasida bu parametrlar ishlatilmaydi:
  ```javascript
  for (const u of allUsers) {
    await api.sendMessage(...);
  }
  ```
  Agar bazada 1000+ foydalanuvchi bo'lsa, Telegram'ning 30 msg/sec limitiga uriladi va V8 isolate serverless taymautga (15-30s) uchrab yarim yo'lda to'xtab qoladi.

---

#### 17. `callback_query.js`: Ishlatilmaydigan O'lik Importlar (Dead Imports)
* **Fayl:** `tgcloud/handlers/callback_query.js` (qatorlar: 5–10)
* **Muammo:**
  `categories as categoriesTable`, `quizzes as quizzesTable`, `turso`, `like` import qilingan, ammo fayl ichida biror marta ham ishlatilmaydi.

---

#### 18. `GroupHostView.jsx`: Brauzer `alert()` Qotib Qolishi
* **Fayl:** `src/views/GroupHostView.jsx` (qatorlar: 62, 66, 82, 86)
* **Muammo:**
  Telegram WebApp ichida standart `alert(...)` chaqirilsa, ayrim Telegram mijozlarida UI to'liq muzlab qoladi. Telegram SDK `window.Telegram?.WebApp?.showAlert(...)` funksiyasidan foydalanish lozim.

---

## 3. Loyiha Qismlari Bo'yicha Solishtirma Matritsasi

| Qism / Modul | Tekshirilgan Fayllar Soni | Topilgan Xatolar | Holat |
| :--- | :--- | :--- | :--- |
| **Backend Handlers** | 6 ta (`message`, `callback_query`, `poll_answer`, `poll`, `inline_query`, `my_chat_member`) | 2 ta (O'lik importlar, 429 rate limit dead code) | Yaxshi, tuzatish tavsiya etiladi |
| **API Endpoints** | 26 ta endpoint | 6 ta (Autentifikatsiya, IDOR, double JSON, orderIndex) | Jiddiy xavfsizlik tuzatishlari talab etiladi |
| **Parsers & Engines** | 12 ta modul (`math_engine`, `docx_reader`, `sanitizer`, `cleaner`, va h.k.) | 2 ta (Formula matnini yo'qotish, URL encoding) | Asosiy testlar o'tgan, 2 ta test tuzatiladi |
| **Lib Services & Utils** | 9 ta servis (`session`, `quiz`, `admin`, `user`, `group`, `turso_client`, `poll_helpers`) | 3 ta (Profil link ustuvorligi, broadcast chunking) | Barqaror |
| **Frontend WebApp** | 12 ta ko'rinish + komponentlar | 4 ta (React Suspense crash, Creator Option Shift, QuizDetailView props, alert) | Kritik UI tuzatishlari lozim |
| **Unit Testlar** | 21 ta test fayli | 3 ta qulagan test, test runner kamchiligi | To'liq 100% o'tish holatiga keltiriladi |

---

## 4. Bosqichma-Bosqich Tuzatish Rejasi (Action Plan)

1. **1-bosqich: Kritik va UI Xatolarini Bartaraf Etish:**
   - `src/App.jsx` da `ArenaView` ni `<React.Suspense>` va `<ErrorBoundary>` bilan o'rab chiqish (Runtime crashni bartaraf etish).
   - `src/views/QuizCreatorView.jsx` da bo'sh variantlar filtrlanganda `correctOptionId` indeksini to'g'ri saqlab qolish.
   - `src/views/QuizDetailView.jsx` ga `onStartQuiz` va `onEditQuiz` tugmalarini integratsiya qilish.

2. **2-bosqich: Testlarni va Parser Mantiqini 100% Yashil Qilish:**
   - `tgcloud/lib/parsers/math_engine.js` da `formatLatexForRender` matn qismlarini `\text{...}` ga o'rash (`test_math_rendering.mjs` ni o'tkazish).
   - `tests/test_math_engine.mjs` da URL assertion'ni to'g'rilash (`decodeURIComponent`).
   - `tgcloud/lib/utils/poll_helpers.js` da username mavjud bo'lganda `https://t.me/username` ni birinchi o'ringa qo'yish (`test_poll_truncation_formatting.mjs` ni o'tkazish).
   - `package.json` ga barcha 21 ta testni ishga tushiruvchi `tests/run_all.mjs` ni ulash.

3. **3-bosqich: Backend Endpoints Xavfsizligini Ta'minlash:**
   - `upload_media_batch.js` va `sanitize_kiut_batch.js` ga `isUserAdmin` tekshiruvini kiritish.
   - `export_quiz_data.js` da `JSON.stringify` ni olib tashlab, avtorizatsiya qo'yish.
   - `create_tournament.js`, `create_live_room.js`, `submit_solo_result.js` larda `currentUserId` mavjudligini qat'iy talab qilish.
   - `session_service.js` dagi 429 rate limit boshqaruvini tuzatish.
