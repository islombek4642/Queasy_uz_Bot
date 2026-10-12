// src/services/api.js
// Bridge to Telegram Serverless Endpoints with dev fallback

import {
  EP_GET_INITIAL_DATA,
  EP_GET_QUIZ_DETAIL,
  EP_SUBMIT_SOLO_RESULT,
  EP_GET_LEADERBOARD,
  EP_GET_GROUP_SESSIONS,
  EP_SAVE_QUIZ,
  EP_DELETE_QUIZ,
  EP_UPDATE_QUIZ,
  EP_GET_USER_MISTAKES,
  EP_GET_KIUT_CATALOG,
} from '../constants/endpoints.js';

// Development mock data for browser testing
const MOCK_DATA = {
  [EP_GET_INITIAL_DATA]: {
    user: { id: 8756078762, name: 'Islombek', level: 3, xp: 420 },
    stats: { totalSolved: 12, accuracy: 88, globalRank: 14 },
    myQuizzes: [
      {
        id: 1,
        title: 'Fizika va Matematika Asoslari',
        description: 'Nyuton qonunlari va kvadrat tenglamalar',
        timeLimit: 25,
        questionCount: 5,
        shuffleOptions: true,
      },
      {
        id: 2,
        title: 'Ingliz Tili: Irregular Verbs',
        description: 'Eng ko\'p ishlatiladigan noto\'g\'ri fe\'llar',
        timeLimit: 15,
        questionCount: 8,
        shuffleOptions: true,
      },
      {
        id: 3,
        title: 'Tarix: Amir Temur Davlati',
        description: 'Tarixiy sanalar va muhim g\'alabalar',
        timeLimit: 30,
        questionCount: 10,
        shuffleOptions: true,
      },
    ],
  },
  [EP_GET_QUIZ_DETAIL]: {
    quiz: {
      id: 1,
      title: 'Fizika va Matematika Asoslari',
      timeLimit: 25,
      shuffleOptions: true,
    },
    questions: [
      {
        id: 101,
        questionText: 'Nyutonning ikkinchi qonuni formulasini toping:',
        options: ['$F = m \\cdot a$', '$E = m \\cdot c^2$', '$P = U \\cdot I$', '$v = s / t$'],
        correctOptionId: 0,
        explanation: 'Nyutonning ikkinchi qonuni: Kuch jism massasi va tezlanishi ko\'paytmasiga teng: F = m * a.',
      },
      {
        id: 102,
        questionText: 'Kvadrat tenglama diskriminanti formulasi qaysi?',
        options: ['$D = b^2 - 4ac$', '$D = a^2 + b^2$', '$D = 2ab + c$', '$D = b^2 + 4ac$'],
        correctOptionId: 0,
        explanation: 'Kvadrat tenglama diskriminanti: D = b^2 - 4ac.',
      },
      {
        id: 103,
        questionText: 'Yorug\'likning vakuumdagi tezligi taxminan qanchaga teng?',
        options: ['$300\\,000\\text{ km/s}$', '$150\\,000\\text{ km/s}$', '$340\\text{ m/s}$', '$1\\,000\\text{ km/s}$'],
        correctOptionId: 0,
        explanation: 'Yorug\'lik tezligi c ≈ 300,000 km/s ga teng.',
      },
    ],
  },
  [EP_SUBMIT_SOLO_RESULT]: {
    success: true,
    resultId: 999,
    userStats: { totalSolved: 13, accuracy: 90 },
  },
  [EP_GET_LEADERBOARD]: {
    timeframe: 'all',
    topUsers: [
      { rank: 1, id: 101, name: 'Azizbek Rahimov', username: 'azizbek_r', xp: 1450, level: 15, accuracy: 96, quizzesSolved: 38 },
      { rank: 2, id: 102, name: 'Dilnoza Karimova', username: 'dilnoza_k', xp: 1220, level: 13, accuracy: 92, quizzesSolved: 31 },
      { rank: 3, id: 103, name: 'Javohir Toirov', username: 'javohir_t', xp: 980, level: 10, accuracy: 89, quizzesSolved: 24 },
      { rank: 4, id: 8756078762, name: 'Islombek', username: 'islombek_dev', xp: 420, level: 5, accuracy: 88, quizzesSolved: 12, isCurrentUser: true },
      { rank: 5, id: 104, name: 'Shahlo Mahmudova', username: 'shahlo_m', xp: 390, level: 4, accuracy: 83, quizzesSolved: 9 },
    ],
    currentUserRank: { rank: 4, id: 8756078762, name: 'Islombek', username: 'islombek_dev', xp: 420, level: 5, accuracy: 88, isCurrentUser: true },
  },
  [EP_GET_GROUP_SESSIONS]: {
    activeSessions: [
      { sessionId: 501, chatId: -1001234567, chatTitle: 'Informatika & Dasturlash Guruh', quizTitle: 'Python Asoslari', currentIndex: 4, totalQuestions: 10, participantCount: 16 },
    ],
    launchableQuizzes: [
      { id: 1, title: 'Fizika va Matematika Asoslari', questionCount: 5, timeLimit: 25, shareLink: 'https://t.me/Queasy_uz_Bot?startgroup=quiz_1' },
      { id: 2, title: 'Ingliz Tili: Irregular Verbs', questionCount: 8, timeLimit: 15, shareLink: 'https://t.me/Queasy_uz_Bot?startgroup=quiz_2' },
    ],
  },
  [EP_SAVE_QUIZ]: {
    success: true,
    quizId: 4,
    questionCount: 3,
  },
  [EP_DELETE_QUIZ]: {
    success: true,
  },
  [EP_UPDATE_QUIZ]: {
    success: true,
    quizId: 1,
  },
  [EP_GET_USER_MISTAKES]: {
    count: 2,
    mistakes: [
      {
        id: 901,
        questionText: 'Quyidagilardan qaysi biri to\'g\'ri Nyuton qonuni?',
        options: ['$F = m \\cdot a$', '$E = m \\cdot c^2$', '$P = U \\cdot I$', '$v = s / t$'],
        correctOptionId: 0,
        explanation: 'F = m * a bu Nyutonning ikkinchi qonuni.',
      },
      {
        id: 902,
        questionText: 'Diskriminant qachon noldan kichik bo\'lsa tenglama ildizga ega emas?',
        options: ['$D < 0$', '$D > 0$', '$D = 0$', '$D \\ge 0$'],
        correctOptionId: 0,
        explanation: 'D < 0 bo\'lsa haqiqiy ildizlar mavjud emas.',
      },
    ],
  },
  [EP_GET_KIUT_CATALOG]: {
    mode: 'root',
    categories: [
      { name: "KUNDUZGI TA'LIM", fullPath: "KUNDUZGI TA'LIM", count: 708 },
      { name: "SIRTQI TA'LIM", fullPath: "SIRTQI TA'LIM", count: 1015 },
      { name: "KECHKI TA'LIM", fullPath: "KECHKI TA'LIM", count: 374 },
      { name: "MASOFAVIY TA'LIM", fullPath: "MASOFAVIY TA'LIM", count: 210 },
      { name: "FANLAR FARQI", fullPath: "FANLAR FARQI", count: 167 },
      { name: "KUNDUZGI TA'LIM (TIBBIYOT)", fullPath: "KUNDUZGI TA'LIM (TIBBIYOT)", count: 270 },
    ],
    totalQuizzes: 2744,
  },
};

export async function callEndpoint(endpointName, params = {}) {
  return new Promise((resolve, reject) => {
    const serverless = window.Telegram?.WebApp?.Serverless;

    if (serverless && typeof serverless.call === 'function') {
      let resolved = false;

      // 6-second watchdog timeout: if serverless.call doesn't respond, resolve with fallback mock data
      const timer = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          console.warn(`[API Timeout] ${endpointName} took >6s, falling back to mock`);
          if (MOCK_DATA[endpointName]) {
            resolve(MOCK_DATA[endpointName]);
          } else {
            resolve({ ok: false, error: 'Timeout' });
          }
        }
      }, 6000);

      try {
        serverless.call(endpointName, params, (err, res) => {
          if (resolved) return;
          resolved = true;
          clearTimeout(timer);

          if (err) {
            console.error(`[API Error] ${endpointName}:`, err);
            if (MOCK_DATA[endpointName]) {
              resolve(MOCK_DATA[endpointName]);
            } else {
              reject(err);
            }
          } else {
            resolve(res);
          }
        });
      } catch (callEx) {
        if (!resolved) {
          resolved = true;
          clearTimeout(timer);
          console.error(`[API Call Exception] ${endpointName}:`, callEx);
          if (MOCK_DATA[endpointName]) {
            resolve(MOCK_DATA[endpointName]);
          } else {
            reject(callEx);
          }
        }
      }
    } else {
      // Local development or simulated fallback
      console.info(`[Dev API Simulation] ${endpointName}:`, params);
      setTimeout(() => {
        if (MOCK_DATA[endpointName]) {
          resolve(MOCK_DATA[endpointName]);
        } else {
          resolve({ ok: true, data: params });
        }
      }, 200);
    }
  });
}
