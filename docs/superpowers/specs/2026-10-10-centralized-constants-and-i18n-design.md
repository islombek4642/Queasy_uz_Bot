# Centralized Constants & Zero-Hardcode i18n Design Specification

- **Sana:** 2026-10-10
- **Loyiha:** Queasy_uz_Bot
- **Maqsad:** Loyihadagi barcha xabarlar, tugmalar, tizim matnlari va vaqt birliklarini markazlashtirilgan konstantalarga (`MESSAGES` va `ACTIONS`) o'tkazish hamda 3 ta tilni (UZ, RU, EN) to'liq, 100% teng darajada qo'llab-quvvatlash.

---

## 1. Muammo va Talablar

### 1.1 Mavjud Muammolar
1. **Qisman lokalizatsiya:** `messages.js` da faqat `UZ` tili to'liq yozilgan, `RU` va `EN` bo'limlarida 30 dan ortiq kalitlar yetishmaydi.
2. **Hardcoded matnlar:**
   - Guruh boshqaruvi va lobby xabarlari (`session_service.js`, `message.js`).
   - Admin paneli, majburiy obuna va broadcast ogohlantirishlari (`callback_query.js`, `admin_keyboard.js`, `message.js`).
   - Fayl yuklash va tahlil qilish holatlari (`message.js`).
   - Vaqt tanlash va o'chirishni tasdiqlash klaviaturalari (`quiz_keyboard.js`).
   - Inline qidiruv va ulashish natijalari (`inline_query.js`).
3. **Qattiq kodlangan til nomlari va havolalar:** `Ha`/`Yo'q`, `Foydalanuvchi`, `👇 Asosiy menyu:` va boshqa yozuvlar bevosita kod ichida turibdi.

### 1.2 Qat'iy Cheklovlar & Talablar
- **Zero-hardcode:** Kodning hech qaysi qismida (handler, service, keyboard) foydalanuvchiga ko'rinadigan matn string sifatida yozilmasligi kerak. Hammasi `getMessage(key, lang, params)` orqali olinadi.
- **Ko'p tillilik tengligi:** Har bir kalit UZ, RU, EN tillarining barchasida mavjud bo'lishi shart.
- **Vaqt birliklari:** `TIME_SECONDS` va `TIME_MINUTES` shablonlari orqali dinamik generatsiya qilinadi.

---

## 2. Konstantalar Arxitekturasi va Yangi Kalitlar Katalogi

### 2.1 Yangi Kalitlar Ro'yxati (`tgcloud/lib/constants/messages.js`)

#### A. Vaqt va Umumiy Boshqaruv Tugmalari
| Kalit | UZ | RU | EN |
| :--- | :--- | :--- | :--- |
| `TIME_SECONDS` | `{n} soniya` | `{n} сек` | `{n} sec` |
| `TIME_MINUTES` | `{n} daqiqa` | `{n} мин` | `{n} min` |
| `BTN_CONFIRM_DELETE` | `🗑 Ha, o'chirilsin` | `🗑 Да, удалить` | `🗑 Yes, delete` |
| `BTN_CANCEL_DELETE` | `❌ Yo'q, bekor qilish` | `❌ Нет, отмена` | `❌ No, cancel` |
| `BTN_MAIN_MENU` | `⬅️ Asosiy menyu` | `⬅️ Главное меню` | `⬅️ Main menu` |
| `BTN_ADMIN_MENU` | `⬅️ Admin menyu` | `⬅️ Меню админа` | `⬅️ Admin menu` |
| `BTN_ADD_CHANNEL` | `➕ Kanal qo'shish` | `➕ Добавить канал` | `➕ Add channel` |
| `BTN_CONFIRM_BROADCAST` | `🚀 Yuborilsin` | `🚀 Отправить` | `🚀 Send broadcast` |
| `BTN_SELECT_GROUP` | `➕ Guruhni tanlash` | `➕ Выбрать группу` | `➕ Select group` |
| `BTN_SELECT_AND_ADD_GROUP` | `➕ Guruhni tanlash va qo'shish` | `➕ Выбрать и добавить группу` | `➕ Select and add group` |
| `BTN_SHARE_TO_FRIENDS` | `↗️ Do'stlarga yuborish` | `↗️ Отправить друзьям` | `↗️ Share with friends` |
| `BTN_SOLVE_QUIZ` | `▶️ Testni yechish` | `▶️ Решить тест` | `▶️ Solve quiz` |
| `BTN_CONTACT_ADMIN` | `📞 Admin bilan bog'lanish` | `📞 Связаться с админом` | `📞 Contact Admin` |
| `BTN_DELETE_ACTION` | `🗑 O'chirish` | `🗑 Удалить` | `🗑 Delete` |

#### B. Guruh va Lobby Xabarlari
| Kalit | UZ | RU | EN |
| :--- | :--- | :--- | :--- |
| `GROUP_NO_ACTIVE_QUIZ` | `ℹ️ Ushbu guruhda ayni paytda faol test mavjud emas.` | `ℹ️ В этой группе сейчас нет активного теста.` | `ℹ️ There is no active quiz in this group right now.` |
| `GROUP_CURRENT_RESULTS` | `📊 <b>Hozirgi natijalar:</b>\n\n` | `📊 <b>Текущие результаты:</b>\n\n` | `📊 <b>Current Results:</b>\n\n` |
| `GROUP_LOBBY_PREPARED` | `✅ Guruhda test tayyorgarligi boshlandi!` | `✅ Подготовка к тесту в группе началась!` | `✅ Group quiz lobby is ready!` |
| `GROUP_LOBBY_ANNOUNCED` | `✅ <b>Test guruhda e'lon qilindi!</b> Guruhga o'tib, ishtirokchilar bilan birga boshlashingiz mumkin.` | `✅ <b>Тест объявлен в группе!</b> Перейдите в группу, чтобы начать вместе с участниками.` | `✅ <b>Quiz announced in group!</b> Switch to the group to start with participants.` |
| `GROUP_CHOOSE_PROMPT` | `👥 Ushbu testni guruhda o'tkazish uchun quyidagi tugmani bosib, testingiz o'tkaziladigan guruhni tanlang:` | `👥 Чтобы провести тест в группе, нажмите кнопку ниже и выберите нужную группу:` | `👥 To run this quiz in a group, click the button below and pick a group:` |
| `GROUP_NONE_ADMIN_FOUND` | `👥 <b>Siz admin bo'lgan ulangan guruhlar topilmadi.</b>\n\nBotni yangi guruhga qo'shish va admin qilish uchun quyidagi tugmani bosing:` | `👥 <b>Подключенных групп, где вы админ, не найдено.</b>\n\nНажмите кнопку ниже, чтобы добавить бота в группу:` | `👥 <b>No connected groups where you are admin found.</b>\n\nClick below to add the bot to a new group:` |
| `GROUP_ADD_PROMPT` | `👥 <b>Botni guruhga qo'shish:</b>\n\nBotni guruhga qo'shib, guruh a'zolari bilan birga qiziqarli testlarni yechishingiz va umumiy natijalarni ko'rishingiz mumkin!` | `👥 <b>Добавление бота в группу:</b>\n\nДобавьте бота в группу, чтобы соревноваться и проходить тесты вместе!` | `👥 <b>Add Bot to Group:</b>\n\nAdd the bot to your group to solve quizzes together and track leaderboard!` |

#### C. Admin va Broadcast Xabarlari
| Kalit | UZ | RU | EN |
| :--- | :--- | :--- | :--- |
| `ERR_BROADCAST_COMMAND` | `⚠️ <b>Xatolik:</b> Buyruqlarni (/) xabar sifatida tarqatib bo'lmaydi.\n\nIltimos, oddiy xabar, rasm yoki fayl yuboring, yoki inline «❌ Bekor qilish» tugmasini bosing.` | `⚠️ <b>Ошибка:</b> Нельзя отправлять команды (/) в рассылку.\n\nОтправьте текст, фото или файл, либо нажмите «❌ Отмена».` | `⚠️ <b>Error:</b> Bot commands (/) cannot be broadcasted.\n\nPlease send text, photo, or file, or click «❌ Cancel».` |
| `ERR_BROADCAST_BUTTON` | `⚠️ <b>Xatolik:</b> Menyu tugmalarini xabar sifatida tarqatib bo'lmaydi.\n\nIltimos, tarqatmoqchi bo'lgan xabaringizni yozing, yoki inline «❌ Bekor qilish» tugmasini bosing.` | `⚠️ <b>Ошибка:</b> Нельзя отправлять кнопки меню в рассылку.\n\nВведите сообщение для рассылки или нажмите «❌ Отмена».` | `⚠️ <b>Error:</b> Menu buttons cannot be broadcasted.\n\nPlease send the broadcast content or click «❌ Cancel».` |
| `PROMPT_CONFIRM_BROADCAST` | `📢 <b>Ushbu xabar barcha foydalanuvchilarga yuborilsinmi?</b>` | `📢 <b>Отправить это сообщение всем пользователям?</b>` | `📢 <b>Broadcast this message to all users?</b>` |
| `PROMPT_BROADCAST_INPUT` | `📝 <b>Barcha foydalanuvchilarga yuboriladigan xabarni yuboring:</b>\n\n<i>Matn, rasm, video, audio, ovozli xabar yoki fayl yuborishingiz mumkin.</i>` | `📝 <b>Отправьте сообщение для рассылки:</b>\n\n<i>Поддерживаются текст, фото, видео, аудио, голосовые и файлы.</i>` | `📝 <b>Send the message to broadcast:</b>\n\n<i>Text, photo, video, audio, voice note, or files are supported.</i>` |
| `ERR_ADD_CHANNEL` | `⚠️ Kanalni qo'shib bo'lmadi. Bot ushbu kanalda administrator ekanligiga ishonch hosil qiling.\nXato: {error}` | `⚠️ Не удалось добавить канал. Убедитесь, что бот является администратором канала.\nОшибка: {error}` | `⚠️ Could not add channel. Ensure the bot is an administrator in the channel.\nError: {error}` |
| `ERR_MESSAGE_EXPIRED` | `Xabar topilmadi yoki muddati o'tgan.` | `Сообщение не найдено или устарело.` | `Message not found or expired.` |
| `ADMIN_CHANNELS_LIST_TITLE`| `📢 <b>Majburiy obuna kanallari ro'yxati:</b>` | `📢 <b>Список каналов обязательной подписки:</b>` | `📢 <b>Required Channels List:</b>` |
| `ADMIN_USERS_LIST_TITLE` | `👥 <b>Oxirgi {count} ta foydalanuvchi:</b>\n\n` | `👥 <b>Последние {count} пользователей:</b>\n\n` | `👥 <b>Last {count} users:</b>\n\n` |
| `ADMIN_GROUPS_LIST_TITLE` | `👥 <b>Oxirgi {count} ta ulangan guruh:</b>\n\n` | `👥 <b>Последние {count} подключенных групп:</b>\n\n` | `👥 <b>Last {count} connected groups:</b>\n\n` |
| `ADMIN_NO_USERNAME` | `yo'q` | `нет` | `none` |

#### D. Fayl Yuklash, Holatlar va Bildirishnomalar
| Kalit | UZ | RU | EN |
| :--- | :--- | :--- | :--- |
| `FILE_PROCESSING` | `⏳ Test fayli qabul qilindi, tahlil qilinmoqda...` | `⏳ Файл теста получен, идет обработка...` | `⏳ Quiz file received, parsing...` |
| `FILE_PROCESS_ERROR` | `⚠️ Faylni qayta ishlashda kutilmagan xatolik yuz berdi: {error}` | `⚠️ Ошибка при обработке файла: {error}` | `⚠️ Unexpected error processing file: {error}` |
| `MAIN_MENU_CAPTION` | `👇 <b>Asosiy menyu:</b>` | `👇 <b>Главное меню:</b>` | `👇 <b>Main menu:</b>` |
| `MY_QUIZZES_TITLE` | `📚 <b>Sizning testlaringiz ro'yxati:</b> (Jami: {count} ta)` | `📚 <b>Ваши тесты:</b> (Всего: {count})` | `📚 <b>Your Quizzes:</b> (Total: {count})` |
| `LANG_CHOOSE_PROMPT` | `🌐 <b>Tilni tanlang / Выберите язык / Select language:</b>` | `🌐 <b>Tilni tanlang / Выберите язык / Select language:</b>` | `🌐 <b>Tilni tanlang / Выберите язык / Select language:</b>` |
| `LANG_CHANGED_SUCCESS` | `✅ Til muvaffaqiyatli saqlandi!` | `✅ Язык успешно изменен!` | `✅ Language successfully updated!` |
| `PROMPT_CHANGE_TIME` | `⏱ Har bir savol uchun vaqt limitini tanlang:` | `⏱ Выберите лимит времени на вопрос:` | `⏱ Select time limit per question:` |
| `ALERT_TIME_CHANGED` | `⏱ Vaqt {time} soniyaga o'zgartirildi!` | `⏱ Время изменено на {time} сек!` | `⏱ Time limit updated to {time}s!` |
| `PROMPT_CONFIRM_DELETE` | `⚠️ Ushbu testni haqiqatan ham butunlay o'chirib tashlamoqchimisiz?` | `⚠️ Вы уверены, что хотите удалить этот тест?` | `⚠️ Are you sure you want to permanently delete this quiz?` |
| `ALERT_QUIZ_CLONED` | `📥 Test sizning profilingizga nusxalandi!` | `📥 Тест скопирован в ваш профиль!` | `📥 Quiz copied to your profile!` |
| `ERR_CLONE_FAILED` | `Nusxalashda xatolik yuz berdi.` | `Ошибка при копировании.` | `Failed to clone quiz.` |
| `ERR_DELETE_FAILED` | `O'chirishda xatolik yuz berdi.` | `Ошибка при удалении.` | `Failed to delete quiz.` |
| `SHARE_BOT_TEXT` | `🎯 Testlarni tezkor yuklash, shaxsiy va guruhlarda yechish uchun ajoyib bot! Sinab ko'ring:` | `🎯 Отличный бот для создания и прохождения тестов соло и в группах! Попробуйте:` | `🎯 Great bot to create and solve quizzes solo or in groups! Check it out:` |
| `SHARE_BOT_CAPTION` | `↗️ <b>Botni do'stlaringizga ulashing:</b>\n\n🎯 <i>Queasy Test Platformasi</i> orqali testlarni tuzish, yechish va bilimlarni sinash mumkin!\n\n🔗 Havola: https://t.me/{username}` | `↗️ <b>Поделитесь ботом с друзьями:</b>\n\n🎯 Создавайте и решайте тесты в <i>Queasy Test Platform</i>!\n\n🔗 Ссылка: https://t.me/{username}` | `↗️ <b>Share bot with friends:</b>\n\n🎯 Create and take quizzes on <i>Queasy Test Platform</i>!\n\n🔗 Link: https://t.me/{username}` |
| `LABEL_YES` | `Ha` | `Да` | `Yes` |
| `LABEL_NO` | `Yo'q` | `Нет` | `No` |
| `DEFAULT_USER_NAME` | `Foydalanuvchi` | `Пользователь` | `User` |
| `ERR_MISTAKES_EMPTY_SUBJECT`| `Ushbu fan bo'yicha xatolar mavjud emas.` | `По этому предмету нет ошибок.` | `No mistakes found for this subject.` |
| `ERR_QUIZ_EMPTY` | `Test topilmadi yoki savollari bo'sh.` | `Тест не найден или не содержит вопросов.` | `Quiz not found or has no questions.` |
| `INLINE_QUIZ_DESC` | `Savollar: {count} ta | Vaqt: {time}s` | `Вопросов: {count} | Время: {time} сек` | `Questions: {count} | Timer: {time}s` |
| `INLINE_QUIZ_BODY` | `🎯 <b>{title}</b>\n\n📊 Savollar: <b>{count}</b> ta\n⏱ Vaqt: <b>{time}</b> soniya\n\nTestni yechish uchun quyidagi tugmani bosing:` | `🎯 <b>{title}</b>\n\n📊 Вопросов: <b>{count}</b>\n⏱ Время: <b>{time}</b> сек\n\nНажмите кнопку ниже, чтобы начать:` | `🎯 <b>{title}</b>\n\n📊 Questions: <b>{count}</b>\n⏱ Time: <b>{time}</b>s\n\nClick below to start the quiz:` |

---

## 3. Komponentlar bo'yicha Refaktoring Rejasi

### 3.1 Klaviaturalar (`tgcloud/lib/keyboards/`)
1. **`quiz_keyboard.js`:**
   - `getTimeLimitKeyboard(quizId, lang = 'UZ')`:
     - Vaqtlar `CONFIG.POLL.ALLOWED_TIME_LIMITS` asosida dinamik shakllanadi: soniya bo'lsa `getMessage('TIME_SECONDS', lang, { n })`, daqiqa bo'lsa `getMessage('TIME_MINUTES', lang, { n: n / 60 })`.
     - Orqaga tugmasi: `getMessage('BTN_BACK', lang)`.
   - `getConfirmDeleteKeyboard(quizId, lang = 'UZ')`:
     - `getMessage('BTN_CONFIRM_DELETE', lang)` va `getMessage('BTN_CANCEL_DELETE', lang)`.
2. **`admin_keyboard.js`:**
   - `getAdminChannelsKeyboard(channelsList, lang = 'UZ')`:
     - O'chirish: `getMessage('BTN_DELETE_ACTION', lang)`.
     - Kanal qo'shish: `getMessage('BTN_ADD_CHANNEL', lang)`.
     - Orqaga: `getMessage('BTN_ADMIN_MENU', lang)`.
   - `getAdminConfirmBroadcastKeyboard(lang = 'UZ')`:
     - Yuborish: `getMessage('BTN_CONFIRM_BROADCAST', lang)`.
     - Bekor qilish: `getMessage('BTN_CANCEL', lang)`.
3. **`subscribe_keyboard.js`:**
   - `getLanguageKeyboard(lang = 'UZ')`:
     - Orqaga tugmasi: `getMessage('BTN_MAIN_MENU', lang)`.

### 3.2 Handlers (`tgcloud/handlers/`)
1. **`callback_query.js`:**
   - Barcha `answer(...)` bildirishnomalari `getMessage` ga ulanadi.
   - Barcha dialog matnlari (`editMessageText`) va klaviatura chaqiruvlariga `lang` uzatiladi.
2. **`message.js`:**
   - Guruh buyruqlari javoblari, broadcast validatsiya xabarlari, kanal qo'shish xatoliklari, fayl yuklash xabarlari markazlashtirilgan kalitlarga almashtiriladi.
3. **`inline_query.js`:**
   - `INLINE_QUIZ_DESC`, `INLINE_QUIZ_BODY`, `BTN_SOLVE_QUIZ` konstantalardan olinadi.

### 3.3 Services (`tgcloud/lib/services/`)
1. **`session_service.js`:**
   - `shuffleOptions !== false ? getMessage('LABEL_YES', lang) : getMessage('LABEL_NO', lang)`.
   - `userName = ... || getMessage('DEFAULT_USER_NAME', lang)`.
   - `👇 Asosiy menyu:` -> `getMessage('MAIN_MENU_CAPTION', lang)`.

---

## 4. Xavfsizlik va Fallback Strategiyasi
1. `getMessage(key, lang, params)` har doim tanlangan til bo'yicha qidiradi.
2. Agar kalit topilmasa, `MESSAGES.UZ[key]` ga tushadi (fallback).
3. Agar u ham topilmasa, dastur qulamasligi uchun `[key]` qaytaradi.
4. Barcha parametrlashtirilgan o'zgaruvchilar (`{count}`, `{title}`, `{time}`) `replaceAll` orqali xavfsiz tarzda matnga kiritiladi.

---

## 5. Verifikatsiya va Tekshirish Rejasi
1. Kod sintaksisi va modullar eksport/import to'g'riligini tekshirish.
2. Hech bir faylda hardcoded o'zbekcha/ruscha/inglizcha matn qolmaganini tekshirish (Regex/Grep audit).
3. `graphify update .` buyrug'i orqali loyiha grafigini yangilash.
