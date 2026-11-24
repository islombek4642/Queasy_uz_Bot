# 🤖 AI Agent Uchun Qoldirilgan Ishlarni Davom Ettirish Yo'riqnomasi (Resume Guide)

Ushbu hujjat **Queasy_uz_Bot** loyihasidagi testlar va ma'lumotlar bazasini sinxronizatsiya qilish ishlarini boshqa kompyuterda (yoki keyingi sessiyada) AI Coding Agent (Cursor, Claude Code, Antigravity va boshqalar) tomonidan to'xtagan joyidan davom ettirish uchun tayyorlangan.

---

## 1. Loyiha va Joriy Holat (Context & Status)

- **Loyiha turi:** Telegram Mini App Bot (Telegram Serverless `@tgcloud/cli` V8 isolate + Turso Cloud LibSQL).
- **Asosiy manba:** `https://kiut-nm-test.uz` saytidagi 2,965 ta test.
- **Oldingi muammo:**
  - Ba'zi testlarda savollar soni 0 ta bo'lib qolgan (masalan, Quiz `#2908` — `NAMANGAN RUSSIAN LANGUAGE 1 (2023-2024)(KUNDUZGI)`).
  - 0 ta savolli test ochilganda bot qotib qolar edi (kartani o'chirib, xatolikni ko'rsatmas edi).
  - Mini App WebApp'da "Boshlash" bosilganda bo'sh taymer aylanib xato berar edi.
  - Kategoriyalar ierarxiyasida `MAXSUS` qabul shakli tushib qolgan va Bot inline tugmalari tartibida nomuvofiqlik bo'lgan.

---

## 2. Bugungi Sessiyada To'liq Bajarilgan Ishlar (Completed Work)

1. ✅ **0 ta Savol Himoyasi (Zero-Question Guards):**
   - [tgcloud/handlers/callback_query.js](file:///c:/Queasy_uz_Bot/tgcloud/handlers/callback_query.js) va [tgcloud/handlers/message.js](file:///c:/Queasy_uz_Bot/tgcloud/handlers/message.js): 0 ta savolli test boshlanganida xabar o'chirilmaydi, foydalanuvchiga *"Ushbu testda savollar mavjud emas"* xabari beriladi.
   - [tgcloud/lib/services/session_service.js](file:///c:/Queasy_uz_Bot/tgcloud/lib/services/session_service.js): `startQuizSession` va `announceGroupLobby` da `!quiz?.questions || quiz.questions.length === 0` tekshiruvi kiritildi.
   - [src/views/KiutView.jsx](file:///c:/Queasy_uz_Bot/src/views/KiutView.jsx), [src/views/MyQuizzesView.jsx](file:///c:/Queasy_uz_Bot/src/views/MyQuizzesView.jsx), [src/views/QuizDetailView.jsx](file:///c:/Queasy_uz_Bot/src/views/QuizDetailView.jsx), [src/components/quiz/QuizModeModal.jsx](file:///c:/Queasy_uz_Bot/src/components/quiz/QuizModeModal.jsx): Bo'sh testlar uchun "Boshlash" va "Yuklab olish" tugmalari faolsizlantirildi (`disabled`), bo'sh holat kartalari qo'shildi.
2. ✅ **Telegram Poll Cheklovi:**
   - [tgcloud/lib/constants/config.js](file:///c:/Queasy_uz_Bot/tgcloud/lib/constants/config.js) da `POLL.MIN_OPTIONS = 2` ga oshirildi (Telegram 1 ta variantli pollni qabul qilmasdan botni crash qilardi).
3. ✅ **Kategoriyalar Tartibga Solindi:**
   - [scripts/normalize_all_categories.mjs](file:///c:/Queasy_uz_Bot/scripts/normalize_all_categories.mjs): `SIRTQI TA'LIM` ostiga `MAXSUS` intake to'liq qo'shildi.
4. ✅ **Universal Parser:**
   - [tgcloud/lib/parsers/parser_engine.js](file:///c:/Queasy_uz_Bot/tgcloud/lib/parsers/parser_engine.js) rus tili va noan'anaviy formatdagi testlar uchun integratsiya qilindi. Rasmdagi Quiz `#2908` testi qayta tahlil qilinganda barcha **198 ta savoli** to'liq va aniq ajratib olindi.
5. ✅ **Verifikatsiya:**
   - `npm test`: **34 ta test suite 100% PASS** bo'ldi.
   - `npm run build`: Vite production build muvaffaqiyatli o'tdi (`dist/` tayyor).

---

## 3. To'xtatilgan Joy (Current Checkpoint)

- **Checkpoint fayli:** [scripts/import_checkpoint.json](file:///c:/Queasy_uz_Bot/scripts/import_checkpoint.json)
- **Hozirgi holat:**
  ```json
  {
    "lastIndex": 595,
    "totalTests": 2965,
    "updatedAt": "2026-11-24T16:30:00Z"
  }
  ```
- **Izoh:** 2,965 ta testdan dastlabki 595 tasi ko'rib chiqildi va jarayon talaba talabiga binoan xavfsiz to'xtatildi. Skript qayta ishga tushirilganda avtomatik ravishda **596-testdan** davom etadi.

---

## 4. Foydalanuvchining Faol VIP Sessiyasi (Session Credentials)

Saytdan (`kiut-nm-test.uz/api/test-content`) testlarni yuklash uchun faol obunaga ega Telegram WebApp `initData` talab qilinadi. Quyidagi `initData` foydalanuvchiga tegishli bo'lib, **2026-yil 10-dekabrgacha faol**:

```bash
query_id=AAGqKOcJBAAAAKoo5wmVig9v&user=%7B%22id%22%3A8756078762%2C%22first_name%22%3A%22Islombek%22%2C%22last_name%22%3A%22Xamidullayev%20%EF%A3%BF%22%2C%22username%22%3A%22xamidullayev_i%22%2C%22language_code%22%3A%22uz%22%2C%22allows_write_to_pm%22%3Atrue%2C%22photo_url%22%3A%22https%3A%5C%2F%5C%2Ft.me%5C%2Fi%5C%2Fuserpic%5C%2F320%5C%2FqjtWAJtvr95hsltjS4uN9B7Mwhl1ztXx3SN2YuHMWO8yX219KAFSZE0XcQI4yvTa.svg%22%7D&auth_date=1795517600&signature=n6QRpLP4q2pl3ETYnSQJi3Z4LvyF3i1JnNWtVn8OS-1_ReyETc5I55NkO_4PqbObPUmo5g_x6ItuVJPn_qDDBQ&hash=b12eedffd80b09525dc37a7f0f3ae6f6ae14fc9c5b8a39cd7c28810a821c8181
```

Bu kalit [scripts/master_import_all_new_tests.mjs](file:///c:/Queasy_uz_Bot/scripts/master_import_all_new_tests.mjs#L31) va [scripts/import_missing_to_turso.mjs](file:///c:/Queasy_uz_Bot/scripts/import_missing_to_turso.mjs) ichiga default sifatida biriktirib qo'yilgan.

---

## 5. Keyingi AI Agent Uchun Qadam-baqadam Buyruqlar (Next Steps for AI Agent)

Uy kompyuterida loyihani ochganingizdan so'ng, AI agent quyidagi buyruqlarni ketma-ket bajarishi kerak:

### 1-qadam: Loyiha holatini tekshirish
```powershell
npm test
npm run build
```
*(Barcha 34 ta test o'tishi va build muvaffaqiyatli chiqishi lozim).*

### 2-qadam: Testlarni to'xtagan joyidan (595-testdan) yuklab olishni davom ettirish
```powershell
node scripts/master_import_all_new_tests.mjs
```
*Bu buyruq [scripts/import_checkpoint.json](file:///c:/Queasy_uz_Bot/scripts/import_checkpoint.json) dagi `lastIndex: 595` ni o'qib, qolgan testlarni parallel ravishda xatolarsiz yuklashni davom ettiradi.*

### 3-qadam: Turso Cloud ga yuklash (agar internet va token mavjud bo'lsa)
```powershell
$env:TURSO_TOKEN = "sizning_turso_tokeningiz"
node scripts/import_missing_to_turso.mjs
```

### 4-qadam: Yangilangan bot va Mini Appni Telegram Serverless ga deploy qilish
```powershell
npx tgcloud push
```
*(Deploy faqat static build va `tgcloud/` fayllarini yangilaydi).*

---

## 6. Aloqador Muhim Fayllar

- [scripts/master_import_all_new_tests.mjs](file:///c:/Queasy_uz_Bot/scripts/master_import_all_new_tests.mjs) — Asosiy ko'p oqimli import skripti (checkpoint bilan ishlaydi).
- [scripts/import_checkpoint.json](file:///c:/Queasy_uz_Bot/scripts/import_checkpoint.json) — Joriy indeks (595).
- [kiut_site_index.json](file:///c:/Queasy_uz_Bot/kiut_site_index.json) — Saytdagi barcha 2,965 ta test ro'yxati.
- [scripts/reconcile_and_report.mjs](file:///c:/Queasy_uz_Bot/scripts/reconcile_and_report.mjs) — Baza va saytni solishtiruvchi tahliliy skript.
