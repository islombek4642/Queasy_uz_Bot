# Telegram Serverless QuizBot (Queasy_uz_Bot) - Yakuniy To'liq Spetsifikatsiya (Spec v4)

## 1. Loyiha haqida umumiy ma'lumot
**Loyiha nomi:** `Queasy_uz_Bot` (Serverless QuizBot)  
**Platforma:** Telegram Serverless (`tgcloud` CLI / V8 Isolate muhiti)  
**Bot Tokeni / CLI Access:** `app8869835041:niwNCJhFXyIqKk2dRhTh07SPAm4K2Oa92s5nYOBTbqg`  
**Dvigatel:** Telegramning o'rnatilgan SQLite bazasi (`sdk/db`) va Bot API (`sdk/api`).  
**Arxitektura standarti:** Zero-Hardcode (barcha matnlar, konstantalar `lib/constants/` da) va Modular arxitektura.

---

## 2. Foydalanuvchi Imkoniyatlari (User Experience)

### 2.1. Test Rejimlari:
1. 📚 **To'liq test (`MODE_FULL`):** Barcha savollarni 1-savoldan to oxirgisigacha (`1` dan `N` gacha) ketma-ket yechish.
2. 📝 **Oraliq test (`MODE_RANGE`):** Savollar oralig'ini tanlash (masalan: `50-100`). Faqat tanlangan oraliqdagi savollar beriladi.
3. 🔀 **Aralash / Tasodifiy test (`MODE_RANDOM`):** Umumiy to'plamdan tasodifiy $N$ ta savol ajratib olinadi va variantlar ham aralashtiriladi.
4. 🧠 **"Mening xatolarim" (Xatolar ustida ishlash — `MODE_MISTAKES`):** Foydalanuvchi oldingi testlarda xato qilgan savollari bazada (`user_mistakes`) to'planadi. Ushbu rejimda faqat adashgan savollaridan iborat shaxsiy test generatsiya qilinadi.

### 2.2. Testlarni Boshqarish va Ulashish (My Quizzes & Share):
- **Mening testlarim:** Paginatsiya (10 tadan sahifalangan inline ro'yxat).
- **Test sozlamalari:** Vaqt limitini o'zgartirish (10s, 15s, 30s, 45s, 60s, 120s), variantlarni aralashtirish (Ha/Yo'q).
- **Testni o'chirish:** Xavfsiz tasdiqlash bilan.
- **Ulashish va Klonlash (Share & Clone):** Har bir test uchun havola: `t.me/Queasy_uz_Bot?start=quiz_{quiz_id}`.
  - Havolani ochgan do'sti testni darhol yechishi yoki "O'zimga nusxalash" (Clone) tugmasi orqali o'ziga saqlab olishi mumkin.

### 2.3. Guruhda Test Yechish (Group Multiplayer):
- Bot guruhga qo'shilganda `/quiz` buyrug'i orqali jamoaviy test boshlanadi.
- Bir vaqtda bir nechta a'zoning javoblari qabul qilinadi (`group_answers`).
- Yakunda **Guruh G'oliblari Reytingi (Leaderboard)**: 🥇 1-o'rin, 🥈 2-o'rin, 🥉 3-o'rin.

### 2.4. Ko'p Tilli Tizim (`/set_language`):
- O'zbek tili (Lotin / Kirill), Ruscha, Inglizcha.

---

## 3. Aqlli Parser va Validatsiya Ekosistemasi

### 3.1. Formatlar:
- **ABC formati:** Standart (`1. Savol\nA) ..\nB) ..\nTo'g'ri javob: B`), Prefiks belgili (`*A)`, `+A)`, `#A)`), va Hujjat oxiridagi javoblar kaliti (`Javoblar: 1-A, 2-C...`).
- **GIFT formati (Moodle):** `{ =To'g'ri ~Xato1 ~Xato2 }` va izohlar bilan `{ =To'g'ri #Izoh }`.
- **Jadval-blok formati:** `====` va `++++` ajratuvchilari, `#` to'g'ri javob.
- **Legacy formati:** `?Savol\n+To'g'ri\n=Xato`.
- **Jadvallar va Fayllar:** `.txt`, `.docx` (XML ekstraktori), `.xlsx` (Excel sheets).

### 3.2. Aqlli Validatsiya (`Validator`):
- Buzuq qatorlarni avtomatik ulash (`fixBrokenLineJoins`).
- Kasrlar va formulalarni to'g'rilash (`π 6` -> `π/6`).
- Sintaksis tekshiruvi: Agar savolda variantlar 2 tadan kam bo'lsa yoki to'g'ri javob belgilanmagan bo'lsa, xatolik qaysi qatorda ekanligi aniq ko'rsatiladi:
  *Misol: "⚠️ 7-savolda to'g'ri javob belgilanmagan (Matn: 'O'zbekiston poytaxti...')".*

---

## 4. Admin Panel va Majburiy Obuna Tizimi (`/admin`)

Faqat administratorlar uchun maxsus boshqaruv paneli:

### 4.1. Statistika (Bot Analytics):
- Jami foydalanuvchilar soni.
- Bugun qo'shilgan yangi a'zolar.
- Bot qo'shilgan guruhlar soni.
- Yaratilgan testlar soni va umumiy yechilgan sessiyalar.

### 4.2. Xabar Tarqatish (Broadcast / Rassilka):
- Barcha faol foydalanuvchilarga xabar yoki rasm jo'natish.
- Yuborish jarayonida yutuq va xatoliklar statistikasi.

### 4.3. Foydalanuvchilar va Guruhlar Ro'yxati:
- **Foydalanuvchilar:** ID, ism, username, ro'yxatdan o'tgan sanasi, bloklash/blokdan chiqarish.
- **Guruhlar:** Guruh nomi, ID, qo'shilgan sanasi, faollik holati.

### 4.4. Majburiy Obuna (Force Channel Subscription):
- Admin kanal qo'shishi va o'chirishi mumkin (`@kanal_username` yoki `-100...` ID).
- Foydalanuvchi botga kirganda `api.getChatMember` orqali a'zoligi tekshiriladi.
- A'zo bo'lmaganlarga kanal(lar) ro'yxati va "✅ Tekshirish" tugmasi chiqadi. A'zo bo'lmaguncha bot funksiyalari bloklanadi.

### 4.5. Kanalga Test E'lon Qilish (Publish to Channel):
- Admin o'zi tanlagan testni to'g'ridan-to'g'ri ulangan kanalga avtomatik tarzda jo'natishi (nashr qilishi) mumkin.

---

## 5. Ma'lumotlar Bazasi Sxemasi (`tgcloud/schema.js`)

1. **`users`:** `telegramId` (PK), `firstName`, `lastName`, `username`, `lang`, `isBlocked`, `createdAt`, `lastActiveAt`.
2. **`groups`:** `groupId` (PK), `title`, `username`, `isActive`, `createdAt`.
3. **`quizzes`:** `id` (PK), `ownerId`, `title`, `description`, `timeLimit`, `shuffleOptions`, `createdAt`.
4. **`questions`:** `id` (PK), `quizId`, `questionText`, `optionsJson`, `correctOptionId`, `explanation`, `orderIndex`.
5. **`user_mistakes`:** `id` (PK), `userId`, `questionText`, `optionsJson`, `correctOptionId`, `explanation`, `originalQuizId`, `createdAt`.
6. **`quiz_sessions`:** `id` (PK), `quizId`, `chatId`, `userId`, `isGroup`, `mode`, `currentIndex`, `totalQuestions`, `correctCount`, `wrongCount`, `isActive`, `lastPollId`, `selectedQuestionsJson`.
7. **`group_answers`:** `id` (PK), `sessionId`, `userId`, `userName`, `questionIndex`, `isCorrect`, `responseTime`, `createdAt`.
8. **`required_channels`:** `id` (PK), `channelId`, `channelUsername`, `title`, `inviteLink`, `isActive`, `createdAt`.
9. **`user_states`:** `userId` (PK), `state`, `contextDataJson`, `updatedAt`.
10. **`bot_settings`:** `key` (PK), `value`, `updatedAt`.

---

## 6. Zero-Hardcode & Modular Katalog Strukturasi

```
Queasy_uz_Bot/
├── tgcloud/
│   ├── handlers/
│   │   ├── message.js           # /start, /admin, /quiz, matn/fayl yuklash, FSM holatlari
│   │   ├── callback_query.js    # Barcha inline tugmalar (admin, rejimlari, paginatsiya, obuna tekshirish)
│   │   └── poll_answer.js       # Solo va Guruh test javoblarini qabul qilish
│   ├── lib/
│   │   ├── constants/
│   │   │   ├── actions.js       # Callback amallari, rejimlar, FSM holatlari
│   │   │   ├── config.js        # Standart parametrlar, admin ID lari, limitlar
│   │   │   └── messages.js      # Barcha ko'p tilli xabarlar va shablonlar
│   │   ├── keyboards/
│   │   │   ├── main_keyboard.js   # Asosiy menyu
│   │   │   ├── mode_keyboard.js   # 3 ta rejim (To'liq, Oraliq, Aralash)
│   │   │   ├── quiz_keyboard.js   # Testni boshqarish, sozlamalar, paginatsiya
│   │   │   ├── group_keyboard.js  # Guruh quiz tugmalari
│   │   │   └── admin_keyboard.js  # Admin panel, rassilka, kanallar boshqaruvi
│   │   ├── parsers/
│   │   │   ├── cleaner.js         # Buzuq qatorlarni ulash va tozalash
│   │   │   ├── validator.js       # Savollarni aqlli sintaktik tekshirish
│   │   │   ├── abc_parser.js      # ABC formati + javoblar kaliti
│   │   │   ├── gift_parser.js     # GIFT formati
│   │   │   ├── block_parser.js    # ==== / ++++ formati
│   │   │   ├── legacy_parser.js   # ? / + / = formati
│   │   │   ├── docx_reader.js     # Word (.docx) ekstraktori
│   │   │   ├── xlsx_reader.js     # Excel (.xlsx) ekstraktori
│   │   │   └── parser_engine.js   # Birlashtiruvchi universal dvijok
│   │   ├── services/
│   │   │   ├── user_service.js    # Profil, til, holat (FSM)
│   │   │   ├── quiz_service.js    # Testlarni saqlash, tahrirlash, klonlash
│   │   │   ├── session_service.js # Solo va Guruh sessiyalari, xatolar ustida ishlash
│   │   │   ├── group_service.js   # Guruhlar ro'yxati va monitoring
│   │   │   ├── admin_service.js   # Statistika, broadcast, foydalanuvchilar boshqaruvi
│   │   │   └── channel_service.js # Majburiy obunani tekshirish
│   │   └── utils/
│   │       ├── normalizer.js
│   │       └── unzip.js           # Pure JS zip dekoderi
│   └── schema.js                  # SQLite bazasi sxemasi
├── tgcloud.jsonc
├── package.json
└── docs/
    ├── SPECIFICATION.md
    └── PLAN.md
```
