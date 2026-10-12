# Bot va Web App O'rtasida "Xatolar Ustida Ishlash" (Mistakes Bank) To'liq Sinxronizatsiyasi Spetsifikatsiyasi

**Sana:** 2026-10-12  
**Holat:** Approved  
**Muallif:** Antigravity & islombek4642  

---

## 1. Umumiy Maqsad va Vizyon

Ushbu spetsifikatsiyaning maqsadi — **Telegram Bot** va **Telegram Mini App (Web App)** o'rtasida "Xatolar ustida ishlash" (Mistakes Practice) tizimini 100% ikki tomonlama (Two-Way Real-time Sync) bog'lash. 

Foydalanuvchi qayerda test yechishidan qat'i nazar:
1. **Botda test yechganda qilingan xatolar** — umumiy bazaga tushadi va Web Appdagi "Xatolar ustida ishlash" bo'limida darhol aks etadi.
2. **Web Appda test yechganda qilingan xatolar** — umumiy bazaga tushadi va Botdagi `/mistakes` bo'limida aks etadi.
3. **Botda xato to'g'rilanganda** — bazadan o'chiriladi va Web Appdan ham yo'qoladi.
4. **Web Appda xato to'g'rilanganda** — bazadan o'chiriladi va Botdan ham yo'qoladi.
5. **Xatolar testi yakunlanganda** — to'plangan XP va natijalar ikkala platformada ham umumiy foydalanuvchi statistikasiga qo'shiladi.

---

## 2. Mavjud Muammolar va Cheklovlar

1. **Web App xatolarni to'plamaydi:** `ArenaView.jsx` da noto'g'ri javob berilganda savol faqat `wrongCount++` qilinadi, savol ma'lumotlari (`failedQuestions`) yig'ilmaydi va serverga uzatilmaydi.
2. **Web App xatolarni o'chirmaydi:** Web Appda xatolar ustida ishlash paytida savol to'g'ri topilsa, uning `mistakeId` si bazadan o'chirilmaydi.
3. **`quizId: null` sababli server rad etadi:** Xatolar ustida ishlash rejimida `quizId` mavjud bo'lmagani uchun, `submit_solo_result.js` uni `if (!quizId) return { success: false }` deb rad etadi. Natijada foydalanuvchiga XP va ball hisoblanmaydi.
4. **Duplikatsiya:** `submit_solo_result.js` va `get_user_mistakes.js` da bir xil savol takrorlanishidan himoya mavjud emas.

---

## 3. Texnik Yechim va Arxitektura

### 3.1. Backend: `tgcloud/endpoints/submit_solo_result.js`

Ushbu endpoint Mini Appdan quyidagi ma'lumotlarni qabul qiladi:
* `quizId`: number | null (oddiy testlar uchun ID, xatolar rejimi uchun 0 yoki null)
* `isMistakesMode`: boolean (xatolar rejimini belgilovchi bayroq)
* `correctCount`: number
* `wrongCount`: number
* `timeSpent`: number (soniyalarda sarflangan vaqt)
* `failedQuestions`: Array<{ questionText: string, options: string[], correctOptionId: number, explanation?: string, originalQuizId?: number }>
* `resolvedMistakeIds`: Array<number> (to'g'ri topilgan xatolarning `user_mistakes.id` lari)

**Mantiqiy oqim:**
1. **Validatsiya:** `totalQuestions = correctCount + wrongCount`. Agar `totalQuestions === 0`, rad etish. Agar `!isMistakesMode && !quizId`, rad etish.
2. **Sessiyani qayd etish (`quiz_sessions`):**
   - Agar `isMistakesMode` bo'lsa, `quizId: 0`, `mode: 'mistakes'`.
   - Aks holda, `quizId: quizId`, `mode: 'full'`.
   - `correctCount`, `wrongCount`, `isActive: false` bilan sessiya saqlanadi.
3. **To'g'rilangan xatolarni tozalash:**
   - Agar `Array.isArray(resolvedMistakeIds)` va uzunligi > 0 bo'lsa:
   - Har bir `id` uchun: `db.delete(userMistakes).where(and(eq(userMistakes.id, id), eq(userMistakes.userId, userId))).run()`.
4. **Yangi xatolarni yozish (Deduplikatsiya bilan):**
   - Agar `Array.isArray(failedQuestions)` va uzunligi > 0 bo'lsa:
   - Har bir savol uchun avval bazada `(userId, questionText)` mavjudligi tekshiriladi (`saveUserMistake` kabi).
   - Mavjud bo'lmasa, `userMistakes` jadvaliga yoziladi.
5. **Javob:** `{ success: true, sessionId, resolvedCount, addedMistakesCount }`.

---

### 3.2. Backend: `tgcloud/endpoints/get_user_mistakes.js`

1. Joriy foydalanuvchining barcha xatolarini `userMistakes` dan oladi.
2. `questionText` bo'yicha deduplikatsiya qiladi (bir xil savol bazada bo'lsa ham foydalanuvchiga faqat bittasi taqdim etiladi).
3. Har bir xato obyekti quyidagi ko'rinishda qaytariladi:
   ```json
   {
     "id": 12,
     "mistakeId": 12,
     "questionText": "Savol matni",
     "options": ["A", "B", "C", "D"],
     "correctOptionId": 2,
     "explanation": "Izoh",
     "originalQuizId": 5
   }
   ```
4. Jami unikal xatolar sonini `count` da qaytaradi.

---

### 3.3. Frontend: `src/views/ArenaView.jsx`

1. **State va Reflar:**
   - `failedQuestionsRef`: Oddiy test davomida noto'g'ri belgilangan savollarni yig'ib boradi.
   - `resolvedMistakeIdsRef`: Xatolar ustida ishlash davomida to'g'ri belgilangan savollarning `id` (mistakeId) larini yig'ib boradi.
2. **Savolga javob berilganda (`handleSelectOption` va `handleTimeout`):**
   - Agar javob xato bo'lsa:
     - Oddiy test bo'lsa (`!customQuestions`): `failedQuestionsRef.current.push(currentQ)`.
   - Agar javob to'g'ri bo'lsa:
     - Xatolar rejimi bo'lsa (`customQuestions`): agar `currentQ.id` yoki `currentQ.mistakeId` mavjud bo'lsa, `resolvedMistakeIdsRef.current.push(currentQ.mistakeId || currentQ.id)`.
3. **Test yakunlanganda (`handleAdvance`):**
   - `submitSoloResult` ga barcha to'plangan ma'lumotlarni yuboradi:
     ```javascript
     submitSoloResult({
       quizId: quizId || 0,
       isMistakesMode: Boolean(customQuestions),
       correctCount,
       wrongCount,
       timeSpent: elapsed,
       failedQuestions: failedQuestionsRef.current,
       resolvedMistakeIds: resolvedMistakeIdsRef.current,
     });
     ```

---

### 3.4. Frontend: `src/views/HomeView.jsx` va `src/App.jsx`

1. `ArenaView` dan chiqqanda `refreshData()` nafaqat profil va testlarni, balki `fetchUserMistakes()` ni ham yangilaydi.
2. `HomeView.jsx` dagi `mistakesData`:
   - Agar `res.count === 0` bo'lsa, holatni to'g'ri `{ mistakes: [], count: 0 }` ga tushiradi (banner avtomatik yashiriladi).
   - Har safar `initialData` yangilanganda xatolar sonini ham qayta tekshiradi.

---

## 4. Xavfsizlik va Ma'lumotlar Butunligi

1. **User Izolyatsiyasi:** Har bir endpoint `ctx.initData.user.id` orqali tasdiqlangan foydalanuvchi ID sini ishlatadi. Boshqa foydalanuvchining xatolarini o'chirish yoki ko'rish mutlaqo mumkin emas (`eq(userMistakes.userId, userId)`).
2. **Tranzaksiya Butunligi:** To'g'rilangan xatolarni o'chirish va yangi xatolarni yozish jarayonidagi xatoliklar asosiy natija saqlanishini to'xtatib qo'ymasligi uchun `try/catch` bilan himoyalanadi.
