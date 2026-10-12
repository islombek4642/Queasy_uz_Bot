# Queasy Telegram Mini App (Web App) Arxitektura va Dizayn Spetsifikatsiyasi

**Sana:** 2026-10-11  
**Status:** Tasdiqlangan / Rejalashtirilmoqda  
**Loyiha:** Queasy_uz_Bot (Telegram Serverless + Mini App)  
**Stack:** React 19 (Vite) + Iconify (`@iconify/react`) + KaTeX + Modular CSS Design Tokens + `tgcloud` Serverless Endpoints  

---

## 1. Umumiy Maqsad va Vizyon (Overview & Vision)

Ushbu spetsifikatsiya `Queasy_uz_Bot` loyihasi uchun to'laqonli, yuqori darajadagi zamonaviy **Telegram Mini App (Web App)** yaratishni belgilaydi. Mini App botning standart matnli va poll interfeysini zamonaviy **Kahoot / Quizizz / Duolingo** darajasidagi interaktiv, jonli va estetik jihatdan boy tajribaga aylantiradi.

### Asosiy Muhandislik Tamoyillari:
1. **Nol Hardcode (Zero Hardcoding):** Barcha matnlar, xabarlar, yo'nalishlar (routes), endpoint nomlari, harakat turlari (action types) alohida konstantalar va i18n kataloglariga chiqariladi.
2. **Ko'p Tillilik (i18n):** O'zbekcha (`UZ`), Ruscha (`RU`) va Inglizcha (`EN`) tillari to'liq qo'llab-quvvatlanadi. Telegram foydalanuvchisi tilidan avtomatik aniqlanadi va sozlamalardan qo'lda o'zgartirish mumkin.
3. **Mavzular Moslashuvchanligi (Dark / Light / Auto Theme):** Telegramning `colorScheme` (tungi yoki kunduzgi rejim) holati avtomatik aniqlanadi, shuningdek foydalanuvchi xohlasa qo'lda Tungi yoki Kunduzgi rejimni tanlay oladi.
4. **Modulli Arxitektura va SoC (Separation of Concerns):** Frontend to'liq modullarga bo'lingan, kengaytirishga juda qulay, bir-biriga bog'lanmagan (decoupled) qatlamlardan iborat bo'ladi.
5. **Nol Xarajat va Serverless Xosting:** Tashqi server, domen yoki SSL talab qilinmaydi. Vite `dist` fayllari to'g'ridan-to'g'ri `https://app8869835041.tgcloud.ai/` bulutida xost qilinadi.

---

## 2. Modulli Frontend Arxitekturasi (SoC — Separation of Concerns)

Frontend loyihasi kengaytirish va yangi funksiyalar qo'shish oson bo'lishi uchun quyidagi qat'iy modulli tuzilmaga ega bo'ladi:

```
src/
├── assets/                  # SVG rasmlar, illyustratsiyalar, brend elementlari
├── constants/               # Loyiha konstantalari (HECH QANDAY HARDCODESIZ)
│   ├── config.js            # Global sozlamalar, limitlar, standartlar
│   ├── routes.js            # Sahifalar va ekranlar ro'yxati (NAV_HOME, NAV_ARENA, ...)
│   ├── endpoints.js         # Backend endpoint nomlari (EP_GET_INITIAL, EP_SUBMIT, ...)
│   └── theme.js             # Ranglar, rejimlar (THEME_DARK, THEME_LIGHT, THEME_AUTO)
├── i18n/                    # Ko'p tillilik tizimi
│   ├── locales/
│   │   ├── uz.js            # O'zbekcha matnlar
│   │   ├── ru.js            # Ruscha matnlar
│   │   └── en.js            # Inglizcha matnlar
│   └── index.js             # useTranslation() hook va tarjima mexanizmi
├── context/                 # Global holat boshqaruvi (Context API)
│   ├── TelegramContext.jsx  # Telegram WebApp SDK, initData, foydalanuvchi
│   ├── ThemeContext.jsx     # Tungi/Kunduzgi/Auto rejim boshqaruvi
│   └── QuizContext.jsx      # Faol test jarayoni, ballar, taymer holati
├── hooks/                   # Maxsus hooklar
│   ├── useTelegram.js       # Telegram metodlari (Haptics, MainButton, BackButton)
│   ├── useTheme.js          # Joriy mavzu va ranglar
│   ├── useTranslation.js    # Tilni almashtirish va matnlarni olish
│   └── useQuizTimer.js      # Sekundomer, progress ring, timeout hodisalari
├── services/                # Backend bilan aloqa qatlami (API Service)
│   ├── api.js               # Telegram.WebApp.Serverless.call shlyuzi + lokal mockup fallback
│   ├── quizService.js       # Testlarni olish, saqlash, yechish
│   └── userService.js       # Foydalanuvchi profili, reytinglar
├── components/              # Qayta ishlatiluvchi atomik va molekulyar UI komponentlar
│   ├── common/              # Tugmalar, kartochkalar, modallar, badge, yuklanish spinnieri
│   │   ├── Button.jsx
│   │   ├── Card.jsx
│   │   ├── Badge.jsx
│   │   └── Modal.jsx
│   ├── quiz/                # Test jarayoni komponentlari
│   │   ├── TimerRing.jsx    # SVG doiraviy animatsiyali taymer
│   │   ├── ProgressBar.jsx  # Savollar chizig'i
│   │   ├── OptionCard.jsx   # Javob varianti kartochkasi
│   │   ├── MathText.jsx     # KaTeX orqali matematik formulalar ko'rsatuvchi
│   │   └── ResultCard.jsx   # Natija va diplom kartasi
│   └── navigation/          # Navigatsiya elementlari
│       ├── Header.jsx       # Til va Mavzu almashtiruvchi header
│       └── BottomNav.jsx    # Pastki qulay tab bar
├── views/                   # Asosiy sahifalar (Ekranlar)
│   ├── HomeView.jsx         # Bosh sahifa (So'nggi testlar, tezkor boshlash)
│   ├── ArenaView.jsx        # Jonli Solo Test Yechish Arenasi
│   ├── GroupHostView.jsx    # Guruh o'yini Xost Boshqaruv Markazi (Kahoot)
│   ├── StudioView.jsx       # Vizual Test Yaratish va Tahrirlash Muharriri
│   └── ProfileView.jsx      # Shaxsiy statistika, yutuqlar, sozlamalar
├── styles/                  # CSS Tokenlar va global dizayn
│   ├── variables.css        # CSS o'zgaruvchilari (Dark/Light ranglar, shriftlar)
│   ├── glassmorphism.css    # Shisha effektlari, blur, borderlar
│   ├── animations.css       # Silliq paydo bo'lish, neon nur animatsiyalari
│   └── index.css            # Asosiy base stillar
├── App.jsx                  # Asosiy App konteyneri
└── main.jsx                 # Vite kirish nuqtasi
```

---

## 3. Mavzular (Themes) va Dizayn Tizimi

Ilova **3 xil rejimda** ishlaydi:
1. **Auto (Avtomatik):** Telegramning `colorScheme` parametri yoki qurilmaning `prefers-color-scheme` tizimi asosida o'zgaradi.
2. **Dark (Tungi):** Sleek chuqur qorong'u rejim, binafsha/neon aksentlar, glassmorphism.
3. **Light (Kunduzgi):** Toza, o'qishga juda qulay, oppoq/och kulrang fon va aniq kontrastli matnlar.

### CSS O'zgaruvchilar Strukturasi (`variables.css`):
```css
/* Tungi Rejim (Standart) */
[data-theme="dark"] {
  --bg-primary: #0b0e14;
  --bg-secondary: #121722;
  --surface-card: rgba(22, 28, 42, 0.75);
  --surface-border: rgba(255, 255, 255, 0.08);
  --text-primary: #f8fafc;
  --text-secondary: #94a3b8;
  --accent-primary: #6366f1;
  --accent-gradient: linear-gradient(135deg, #6366f1, #8b5cf6);
  --color-success: #10b981;
  --color-error: #ef4444;
  --color-warning: #f59e0b;
}

/* Kunduzgi Rejim */
[data-theme="light"] {
  --bg-primary: #f8fafc;
  --bg-secondary: #f1f5f9;
  --surface-card: rgba(255, 255, 255, 0.85);
  --surface-border: rgba(0, 0, 0, 0.08);
  --text-primary: #0f172a;
  --text-secondary: #64748b;
  --accent-primary: #4f46e5;
  --accent-gradient: linear-gradient(135deg, #4f46e5, #7c3aed);
  --color-success: #059669;
  --color-error: #dc2626;
  --color-warning: #d97706;
}
```

---

## 4. Ko'p Tillilik Tizimi (i18n — UZ, RU, EN)

Barcha matnlar alohida fayllarda saqlanadi va kalitlar orqali chaqiriladi:
- `t('BTN_START_QUIZ')`
- `t('TIME_LEFT', { seconds: 15 })`
- `t('TITLE_MY_QUIZZES')`

Til avtomatik ravishda `Telegram.WebApp.initDataUnsafe.user.language_code` orqali aniqlanadi (agar `ru` bo'lsa `RU`, `en` bo'lsa `EN`, aks holda `UZ`), shuningdek foydalanuvchi Header'dagi tugma orqali xohlagan vaqtda tilni almashtira oladi.

---

## 5. Asosiy Ekranlar va Funksionallik

### 5.1. Bosh Sahifa (HomeView)
- Foydalanuvchi salomlashuvi, darajasi va statistikasi.
- "Tezkor Boshlash" (oxirgi yechilgan testlar).
- "Mening Testlarim" karuseli.
- Yangi test yaratish tugmasi.

### 5.2. Solo Quiz Arena (ArenaView)
- KaTeX orqali matematik formulalar va rasmlar to'liq ko'rsatiladi.
- Doiraviy SVG taymer animatsiyasi.
- Har bir javob tanlanganda Telegram Haptic Feedback (`light`, `success`, `error`).
- Test yakunida confetti animatsiyasi, natija sertifikati va Telegram Story / chatga ulashish tugmasi.

### 5.3. Guruh O'yinlari Xost Markazi (GroupHostView)
- Admin guruhdagi faol testni kuzatib turadi.
- Lobbida kimlar borligi va har bir savolga kim javob bergani jonli yashil nurlar bilan belgilanadi.
- Vaqt tugashi bilan Mini App orqali keyingi savolga avtomatik o'tkaziladi.

### 5.4. Test Muharriri (StudioView)
- Savol matnini va variantlarni vizual tahrirlash.
- Drag-and-drop orqali tartiblash.
- Taymer (soniya) va aralashtirish sozlamalari.

### 5.5. Profil va Reyting (ProfileView)
- Foydalanuvchi statistikasi (jami yechilgan savollar, aniqlik darajasi, sarflangan o'rtacha vaqt).
- Global bilimdonlar ligasi.
- Til va Mavzuni sozlash.

---

## 6. Serverless Endpoints (`tgcloud/endpoints/`)

| Endpoint | Kirish Parametrlari | Chiqish Natijasi |
|---|---|---|
| `get_initial_data.js` | `{}` | `{ user, myQuizzes, stats, lang }` |
| `get_quiz_detail.js` | `{ quizId }` | `{ quiz, questions }` |
| `submit_solo_result.js` | `{ quizId, score, answers, timeSpent }` | `{ success, resultId, userStats }` |
| `save_quiz.js` | `{ quizId?, title, timeLimit, questions }` | `{ success, quizId }` |
| `delete_quiz.js` | `{ quizId }` | `{ success }` |
| `group_host_sync.js` | `{ sessionId }` | `{ activeSession, currentAnswers }` |
| `get_leaderboard.js` | `{ timeframe: 'weekly'/'all' }` | `{ topUsers }` |

---

## 7. Bosqichma-bosqich Amalga Oshirish Rejasi (Phases)

- **1-Bosqich (MVP Foundation & Solo Arena):**
  - Vite + React 19 loyihasini o'rnatish, `@iconify/react` va KaTeX qo'shish.
  - Modulli arxitektura (`src/` tuzilmasi), CSS Design Tokens, Tungi/Kunduzgi/Auto mavzular tizimi.
  - 3 tilli i18n tizimi (`UZ`, `RU`, `EN`).
  - Backend `get_initial_data.js`, `get_quiz_detail.js`, `submit_solo_result.js` endpointlari.
  - Bosh sahifa va Solo Quiz Arena (doiraviy taymer, KaTeX, haptics, natija kartasi).
  - `tgcloud.jsonc` orqali Mini App-ni deploy qilish (`dist`).

- **2-Bosqich (Guruh Xosti va Jonli Leaderboard):**
  - Guruh o'yinlarini jonli boshqarish ekrani (`GroupHostView`).
  - Ishtirokchilar jonli monitoringi va avto-o'tish.

- **3-Bosqich (Quiz Studio):**
  - Vizual test tahrirlash va yangi test yaratish konstruktori.

- **4-Bosqich (Profil va Global Reyting):**
  - Shaxsiy tahlil, yutuqlar va global peshqadamlar jadvali.
