# Queasy_uz_Bot — To'liq Tizimli Audit va Xatolar Tahlili Hisoboti (Systematic Debugging Report)

> **Sana:** 2026-10-13  
> **Loyiha:** Queasy_uz_Bot (Telegram Serverless Mini App + Bot)  
> **Muhit:** Telegram Serverless Cloud (`@tgcloud/cli`), SQLite, React 19 + Vite  
> **Tekshirilgan komponentlar:** Bot Handlers, Endpoints, Shared Services, Database Schema, Frontend WebApp Views & Hooks, i18n, Bundle & Performance.

---

## 1. Umumiy Xulosa (Executive Summary)

Loyiha arxitekturasi puxta rejalashtirilgan, modular va Telegram serverless cheklovlariga (V8 isolate, node_modules va fayl tizimi yo'qligi) to'liq moslashtirilgan. Parsing tizimi (`.docx`, `.xlsx`, `.pdf`, `.txt`) sof JavaScript'da tashqi kutubxonalarsiz ishlashi juda katta ustunlik. Unit testlar (`npm test`) to'liq o'tmoqda, tillar kesimida barcha 172 ta (frontend) va 165 ta (backend) i18n kalitlari 100% to'liq.

Shu bilan birga, chuqur tahlil davomida **5 ta jiddiy (Critical/High)** mantiqiy va xavfsizlik xatosi, **5 ta o'rtacha (Medium/Performance)** samaradorlik muammosi aniqlandi.

---

## 2. Aniqlangan Muammolar va Buglar (Detailed Findings)

### 🔴 Jiddiy Xatolar (Critical & High Severity)

#### 1. React ArenaView: Oxirgi Savolda Natija 1 Ball Kam Hisoblanishi (Stale State Closure Bug)
* **Fayl:** `src/views/ArenaView.jsx` (qatorlar: 137–165, 201–235)
* **Muammo tavsifi:** Foydalanuvchi oxirgi savolga to'g'ri javob berganida, `setCorrectCount((prev) => prev + 1)` chaqiriladi va darhol `setTimeout(() => handleAdvance(), 1200)` o'rnatiladi. `handleAdvance` funksiyasi esa `useCallback` orqali `[correctCount, wrongCount]` ga bog'langan. Natijada, timeout ishlagan paytda `handleAdvance` funksiyasi yopilma (closure) ichidagi **eski `correctCount` qiymatini** oladi. Oxirgi savol to'g'ri topilgan bo'lsa ham, `submitSoloResult` yoki `submitTournamentResult` ga 1 ball kam yuboriladi.
* **Oqibati:** Turnir jadvalida va foydalanuvchi umumiy statistikasida oxirgi to'g'ri javob hisobga kirmay qoladi.
* **Yechim:** Ballarni hisoblash uchun `useRef` (`correctCountRef` va `wrongCountRef`) joriy etish yoki `handleAdvance` ga yakuniy hisobni to'g'ridan-to'g'ri argument qilib uzatish.

---

#### 2. Guruh Viktorinalari So'rovi Xatosi (Solo Sessiyalar Guruh Sessiyalarini To'sib Qo'yishi)
* **Fayl:** `tgcloud/endpoints/get_group_sessions.js` (qator: 21 va 29)
* **Muammo tavsifi:** `quizSessions` jadvalidan faol sessiyalarni olishda so'rov quyidagicha yozilgan:
  ```javascript
  .where(eq(quizSessions.isActive, true))
  .orderBy(desc(quizSessions.id))
  .limit(10)
  ```
  Agar tizimda 10 ta foydalanuvchi shaxsiy (solo) test yechayotgan bo'lsa, so'rov faqat solo sessiyalarni qaytaradi. Pastda esa `if (!s.isGroup) continue;` tekshiruvi bor. Natijada barcha 10 ta sessiya tashlab yuboriladi va guruhda faol viktorina bor bo'lsa ham, WebApp'da **`activeSessions: []` (bo'sh)** ko'rinadi.
* **Yechim:** Ma'lumotlar bazasi so'rovining o'zidayoq guruh ekanligini filtrlash:
  ```javascript
  .where(and(eq(quizSessions.isActive, true), eq(quizSessions.isGroup, true)))
  ```

---

#### 3. Jonli Xonani (Live Room) Begona O'yinchilar Boshqarib Yuborishi (IDOR / Ruxsatsiz Boshlash)
* **Fayl:** `tgcloud/endpoints/start_live_room.js` (qatorlar: 14–33)
* **Muammo tavsifi:** Endpoindda `// Verify host` izohi qo'yilgan, biroq hostni tekshirish kodi **yozilmay qolib ketgan**:
  ```javascript
  // Verify host
  const room = await db
    .select({ id: liveRooms.id, hostId: liveRooms.hostId })
    .from(liveRooms)
    .where(eq(liveRooms.roomCode, roomCode))
    .get();

  if (!room) {
    return { success: false, error: 'ROOM_NOT_FOUND' };
  }

  // Update room status to active (HOST TEKSHIRILMAYDI!)
  await db.update(liveRooms).set({ status: 'active' })...
  ```
* **Oqibati:** 6 xonali PIN kodni bilgan har qanday o'yinchi yoki begona foydalanuvchi `POST /api/start_live_room` ga so'rov yuborib, boshlovchi tayyor bo'lmasdan turib xonani boshlab yuborishi mumkin.
* **Yechim:** Qat'iy avtorizatsiya tekshiruvi qo'shish:
  ```javascript
  if (!currentUserId || room.hostId !== currentUserId) {
    return { success: false, error: 'NOT_HOST' };
  }
  ```

---

#### 4. Leaderboard (Peshqadamlar) Mantiqiy Qatag'oni va Noto'g'ri Reyting
* **Fayl:** `tgcloud/endpoints/get_leaderboard.js` (qatorlar: 14–43)
* **Muammo tavsifi:**
  1. Top foydalanuvchilarni topishda reyting bo'yicha emas, tasodifiy Telegram ID bo'yicha saralangan: `orderBy(desc(users.telegramId)).limit(30)`.
  2. Faqat oxirgi 100 ta sessiya olinadi: `orderBy(desc(quizSessions.id)).limit(100)`. Agar eng kuchli o'yinchi oxirgi 100 ta sessiyada qatnashmagan bo'lsa, uning bali 0 deb hisoblanadi.
  3. `timeframe` parametri (`today`, `week`, `month`, `all`) qabul qilinadi, lekin SQL so'rovida umuman ishlatilmaydi.
* **Yechim:** Foydalanuvchilarning umumiy to'plagan XP bo'yicha guruhlangan SQL aggregate so'rovini (`GROUP BY userId SUM(correctCount)`) joriy etish.

---

#### 5. Ochiq Hardcoded Parol orqali KIUT Testlarini O'chirib Yuborish Xavfi
* **Fayl:** `tgcloud/endpoints/reset_kiut_quizzes.js:L7` va `tgcloud/endpoints/ingest_kiut_batch.js:L7`
* **Muammo tavsifi:** Har ikki endpoint ochiq manba kodidagi `'KIUT_QUEASY_SECRET_2026'` satriga tayanadi.
* **Yechim:** Parol o'rniga haqiqiy Telegram avtorizatsiyasi orqali bot adminligini tekshirish: `isUserAdmin(ctx?.initData?.user?.id)`.

---

### 🟡 O'rtacha Muammolar va Unumdorlik (Medium & Performance)

#### 6. Endpoints ichidagi N+1 Ma'lumotlar Bazasi So'rovlari
* **Fayllar:**
  * `get_group_sessions.js`: Har bir sessiya va test uchun tsikl ichida 4 marta alohida `await db` bajariladi (bitta so'rovda 40+ marta DB ga ulanish).
  * `get_kiut_catalog.js`: Har bir test uchun savollar sonini tsikl ichida sanash (100 martagacha alohida so'rov).
  * `get_initial_data.js`: Har bir shaxsiy test uchun alohida savollar sonini sanash.
  * `get_user_mistakes.js`: Test nomlarini tsikl ichida birma-bir olish.
* **Yechim:** `Promise.all` orqali parallel so'rash yoki `IN (...)` filtri bilan bitta umumiy so'rovda yuklab olish.

#### 7. `get_initial_data.js` da Global Rank (Reyting) Qotirib Qo'yilganligi
* **Fayl:** `tgcloud/endpoints/get_initial_data.js` (qator: 99)
* **Muammo:** `globalRank: 1` qiymati qattiq `1` qilib yozilgan. Mini App'ga kirgan barcha foydalanuvchilar o'zlarini `#1` o'rinda ko'radi.

#### 8. Mini App Frontendining Katta Hajmi (666.6 kB bitta faylda)
* **Fayl:** `src/App.jsx`
* **Muammo:** Barcha 11 ta ko'rinish (`KiutView`, `ArenaView`, `QuizCreatorView`, `GroupHostView`, va h.k.) va `KaTeX` kutubxonasi dinamik emas, statik import qilingan.
* **Yechim:** `React.lazy()` va `Suspense` yordamida Code-Splitting joriy etish. Bu boshlang'ich yuklanish hajmini 666 kB dan ~85 kB ga tushiradi (8 baravar tezroq ochiladi).

#### 9. Ortiqcha / Ishlatilmaydigan Endpoint Doimiysi
* **Fayl:** `src/constants/endpoints.js:L8`
* **Muammo:** `EP_GROUP_HOST_SYNC = 'group_host_sync'` e'lon qilingan, biroq backendda `group_host_sync.js` mavjud emas va frontendda hech qayerda chaqirilmaydi.

#### 10. `submit_tournament_result.js` Timestamp Formatidagi Noaniqlik
* **Fayl:** `tgcloud/endpoints/submit_tournament_result.js:L53`
* **Muammo:** Bazada `finishedAt` ustuni `unixepoch()` (sekundlarda butun son) sifatida saqlanadi, biroq yangilashda `finishedAt: new Date()` uzatilgan.

---

## 3. Bot va WebApp Taqqoslanishi (Parity Matrix)

| Imkoniyat | Telegram Bot (Chat/Guruh) | Telegram WebApp (Mini App) | Holat / Farqlar |
| :--- | :--- | :--- | :--- |
| **Yakka tartibdagi test (Solo)** | Telegram Polls orqali | ArenaView (Vaqt halqasi, KaTeX, Haptic) | Ikkisi ham to'liq ishlaydi. WebApp'da UI ancha qulay. |
| **Guruh o'yini (Multiplayer)** | `/quiz` yoki Lobbilar orqali guruh chatida Polls | 1) Guruh Turniri (`gt_...` havola)<br>2) Jonli Xona (`room_...` PIN) | WebApp'da 2 xil zamonaviy usul mavjud (Kahoot & Asinxron Turnir). |
| **Xatolar ustida ishlash** | Chat orqali variantlarni qayta yechish | MistakesView (Fanlar bo'yicha guruhlangan) | WebApp'da savollar deduplikatsiya qilinadi. |
| **KIUT Test Markazi** | Hujjat yuklash (`.docx`, `.xlsx`, `.pdf`) | Katalog bo'ylab qidirish, semestrlar daraxti | Bot ko'proq import qilish uchun, WebApp o'qish/yechish uchun mos. |
| **Peshqadamlar (Leaderboard)** | Guruh yakuniy hisoboti | Global va Turnir reytingi | WebApp'dagi algoritm to'g'rilanishi lozim. |
| **Admin paneli** | Inline keyboard orqali to'liq admin boshqaruv | Mavjud emas (Oddiy foydalanuvchi interfeysi) | To'g'ri ajratilgan. |

---

## 4. Tuzatish Bo'yicha Tavsiyalar Rejasi (Action Plan)

1. **1-bosqich (Kritik tuzatishlar):**
   * `ArenaView.jsx` da ball hisoblashni `useRef` ga o'tkazish (oxirgi savol xatosini bartaraf etish).
   * `get_group_sessions.js` da `.where(and(isActive, isGroup))` filtrini to'g'rilash.
   * `start_live_room.js` ga host tekshiruvini kiritish (`room.hostId === currentUserId`).
   * `reset_kiut_quizzes.js` va `ingest_kiut_batch.js` da hardcoded parolni admin tekshiruviga almashtirish.

2. **2-bosqich (Unumdorlik va optimallashtirish):**
   * `get_leaderboard.js` reyting hisoblashini xolis SQL aggregate ga o'tkazish.
   * `App.jsx` dagi og'ir ko'rinishlarni `React.lazy()` ga o'tkazish (bundle hajmini kichraytirish).
   * N+1 so'rovlarni `Promise.all` ga o'tkazish.
