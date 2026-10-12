# WebApp Guruh Viktorinalari (Group Quizzes) Tizimi — Texnik Spetsifikatsiya (Spec)

**Sana:** 2026-10-12  
**Holat:** Ko'rib chiqishda (In Review)  
**Tizim:** Queasy Telegram Mini App & Serverless Backend  

---

## 1. Muammo va Maqsad (Context & Intent)

### 1.1. Muammo
Hozirgi vaqtda WebApp'ning `GroupHostView.jsx` sahifasida "Guruhda boshlash" tugmasi bosilganda:
* Foydalanuvchi to'g'ridan-to'g'ri Telegram chatiga chiqarib yuboriladi (`t.me/Queasy_uz_Bot?startgroup=quiz_${id}`).
* Test Telegram'ning oddiy `sendPoll` (so'rovnoma) xabarlari orqali guruh chatining o'zida o'tadi.
* Bu holatda WebApp'ning boy interfeysi, animatsiyalari, natijalar tahlili va interaktiv imkoniyatlari ishlatilmay qolmoqda. Guruh a'zolari WebApp ichida jamoaviy muhitni his qilishmaydi.

### 1.2. Maqsad
Telegram guruhidagi foydalanuvchilarni bot yoki maxsus havolalar orqali **WebApp ichiga olib kirish** va WebApp ichida guruh bo'lib test ishlash imkoniyatini taqdim etish:
1. **1-bosqich: Guruh Turniri (Asinxron Musobaqa):**
   * Host testni Telegram guruhiga chiroyli xabar va WebApp tugmasi bilan ulashadi.
   * Guruh a'zolari tugmani bosib WebApp'ga kiradi va testni yechadi.
   * WebApp ichida aynan shu guruhga tegishli Jonli Peshqadamlar Jadvali (Group Leaderboard) shakllanadi.
2. **2-bosqich: Jonli Xona (Kahoot uslubidagi Real-Time Multiplayer):**
   * Host WebApp'da xona ochadi (PIN / Room havola).
   * Guruhdagilar WebApp ichidagi "Kutish zali" (Lobby)ga yig'ilishadi.
   * Host boshlaganda hamma bir vaqtda savollarga javob beradi va jonli poyga bo'ladi.

---

## 2. Foydalanuvchi Tajribasi va Oqimi (User Experience & Flow)

### 2.1. 1-bosqich: Guruhga Ulashish va Turnir Oqimi (Group Tournament)
1. **Host tomoni:**
   * Host WebApp'da `Guruhlar` sahifasiga o'tadi.
   * O'zining testlari ro'yxatida har bir test ostida ikkita aniq tugma paydo bo'ladi:
     - 🚀 **"Guruhga ulashish"** (Turnir havolasi)
     - ⚡ **"Jonli xona ochish"** (Real-time xona)
   * "Guruhga ulashish" bosilganda Telegram `share/url` oynasi ochiladi va tanlangan guruhga tayyor chiroyli taklif xabari yuboriladi:
     > 🎯 **"Test nomi" viktorinasi boshlandi!**  
     > Guruhimiz a'zolari o'rtasida musobaqa! Kim eng yuqori ball olishini aniqlaymiz.  
     > [👉 WebApp'da testni boshlash](https://t.me/Queasy_uz_Bot/app?startapp=gquiz_123_share)
2. **Guruh a'zosi tomoni:**
   * Ishtirokchi havolani bosganda WebApp ochiladi va avtomatik ravishda **Guruh Turniri Modali/Ekrani** ochiladi:
     - Test nomi, savollar soni va vaqt chegarasi;
     - "Guruhdagi joriy peshqadamlar" (Top 3 ko'rinib turadi);
     - "Testni boshlash" tugmasi.
   * Ishtirokchi testni topshiradi.
   * Test tugagach, yakuniy ekranda **Guruh Reytingi** (barcha guruhdoshlar o'rtasidagi o'rni, to'g'ri javoblar va sarflangan vaqt) ko'rsatiladi.
   * 📤 "Natijani guruhga yuborish" tugmasi orqali o'z natijasini guruhga maqtanib ulasha oladi.

---

### 2.2. 2-bosqich: Jonli Xona Oqimi (Live Room / Kahoot Rejimi)
1. **Xona yaratish (Host):**
   * Host "Jonli xona ochish"ni bosadi.
   * Tizim 6 xonali PIN kod (masalan: `729401`) va maxsus havola yaratadi (`https://t.me/Queasy_uz_Bot/app?startapp=room_729401`).
   * Host "Guruhga chaqirish" orqali havolani guruhga tashlaydi.
2. **Kutish zali (Lobby):**
   * Ishtirokchilar havola orqali WebApp'dagi "Lobby"ga kirishadi.
   * Ekranda qo'shilgan o'yinchilar ro'yxati (avatarlar, ismlar) real vaqtda ko'rinib boradi.
   * Faqat Hostda "Boshlash (Start)" tugmasi faol bo'ladi.
3. **Jonli o'yin jarayoni:**
   * Host start berganda barcha ishtirokchilarda bir vaqtda 1-savol chiqadi.
   * Har bir savol uchun belgilangan taymer ketadi (masalan, 20 soniya).
   * Har bir savoldan so'ng oraliq natijalar (Top 5) ko'rsatiladi.
   * Barcha savollar tugagach, 1, 2, 3-o'rinlar uchun tantanali Podium chiqadi.

---

## 3. Ma'lumotlar Bazasi Modeli (Database Schema)

`tgcloud/schema.js` fayliga quyidagi yangi jadvallar qo'shiladi:

### 3.1. `group_tournaments` (Turnirlar jadvali)
```javascript
export const groupTournaments = table('group_tournaments', {
  id:          integer('id').primaryKey({ autoIncrement: true }),
  quizId:      integer('quiz_id').notNull(),
  creatorId:   integer('creator_id').notNull(),
  title:       text('title').notNull(),
  shareCode:   text('share_code').notNull().unique(), // masalan 'gt_abc123'
  isActive:    integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt:   integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
});
```

### 3.2. `tournament_participants` (Turnir natijalari jadvali)
```javascript
export const tournamentParticipants = table('tournament_participants', {
  id:           integer('id').primaryKey({ autoIncrement: true }),
  tournamentId: integer('tournament_id').notNull(),
  userId:       integer('user_id').notNull(),
  userName:     text('user_name').notNull(),
  userAvatar:   text('user_avatar'),
  score:        integer('score').notNull().default(0),
  totalQuestions: integer('total_questions').notNull(),
  totalTimeSeconds: integer('total_time_seconds').notNull().default(0),
  finishedAt:   integer('finished_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
});
```

### 3.3. `live_rooms` (Jonli xonalar jadvali - 2-bosqich uchun)
```javascript
export const liveRooms = table('live_rooms', {
  id:             integer('id').primaryKey({ autoIncrement: true }),
  roomCode:       text('room_code').notNull().unique(), // '729401'
  quizId:         integer('quiz_id').notNull(),
  hostId:         integer('host_id').notNull(),
  status:         text('status').notNull().default('waiting'), // 'waiting', 'active', 'finished'
  currentQuestionIndex: integer('current_question_index').notNull().default(0),
  createdAt:      integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
});
```

---

## 4. Backend Serverless API Endpoints

Quyidagi yangi endpointlar `tgcloud/endpoints/` papkasida yaratiladi:

1. `create_tournament.js`:
   * **Kiruvchi:** `{ quizId }`
   * **Vazifasi:** Yangi turnir yaratadi, noyob `shareCode` beradi va Telegram share havolasini qaytaradi.
2. `get_tournament_details.js`:
   * **Kiruvchi:** `{ shareCode }`
   * **Vazifasi:** Turnir ma'lumotlari, test nomi, savollar soni va guruh peshqadamlari jadvalini (Leaderboard) qaytaradi.
3. `submit_tournament_result.js`:
   * **Kiruvchi:** `{ shareCode, score, totalQuestions, totalTimeSeconds }`
   * **Vazifasi:** Ishtirokchining natijasini saqlaydi va yangilangan o'rin/reytingni qaytaradi.
4. `create_live_room.js` va `get_live_room_state.js` (2-bosqich uchun).

---

## 5. Frontend Foydalanuvchi Interfeysi (UI/UX)

1. **`GroupHostView.jsx` yangilanishi:**
   * Har bir test kartasida:
     - 🚀 **"Guruhga ulashish"** (Turnir yaratish va Telegram guruhlariga xabar yuborish)
     - ⚡ **"Jonli xona (Kahoot)"** (Xona ochish va jonli kutish zali)
   * Faol turnirlar va faol xonalar monitoring bloki (nechta odam topshirdi, kim yutmoqda).
2. **`TournamentModal.jsx` / `TournamentView.jsx`:**
   * Telegram `startapp=gt_...` parametri orqali kelgan foydalanuvchi uchun xush kelibsiz ekrani, guruh peshqadamlari jadvali va "Boshlash" tugmasi.
3. **Turnir yakunidagi natijalar ekrani:**
   * Guruhdagi egallagan o'rni (masalan: 🥇 1-o'rin, 5 ta ishtirokchi ichida).
   * "Natijani guruhga yuborish" tugmasi.

---

## 6. Xavfsizlik, Cheklovlar va Optimizatsiya

* **Serverless Polling Optimizatsiyasi:** SQLite va serverless muhitini ortiqcha yuklamaslik uchun kutish zali (Lobby)dagi yangilanishlar 2.5–3 soniya interval bilan tekshiriladi.
* **Ishtirokchi takrorlanishi:** Har bir foydalanuvchi bitta turnirda o'z natijasini yangilashi mumkin (faqat eng yaxshi natija reytingda qoladi).
* **Til qo'llab-quvvatlashi:** Barcha yangi matnlar `uz.js` va `ru.js` lokalizatsiya fayllariga kiritiladi.
