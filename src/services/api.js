// src/services/api.js
// Bridge to Telegram Serverless Endpoints

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
  EP_CLONE_QUIZ,
} from '../constants/endpoints.js';

// Default clean fallback structures (Zero fake/dummy data)
function getCleanDefaults(endpointName) {
  switch (endpointName) {
    case EP_GET_INITIAL_DATA:
      return {
        user: { id: 0, name: 'Foydalanuvchi', level: 1, xp: 0 },
        stats: { totalSolved: 0, accuracy: 0, globalRank: '-' },
        myQuizzes: [],
      };
    case EP_GET_LEADERBOARD:
      return {
        timeframe: 'all',
        topUsers: [],
        currentUserRank: null,
      };
    case EP_GET_GROUP_SESSIONS:
      return {
        activeSessions: [],
        launchableQuizzes: [],
      };
    case EP_GET_USER_MISTAKES:
      return {
        count: 0,
        mistakes: [],
      };
    case EP_GET_KIUT_CATALOG:
      return {
        mode: 'root',
        categories: [],
        totalQuizzes: 0,
      };
    case EP_GET_QUIZ_DETAIL:
      return { quiz: null, questions: [] };
    case EP_SUBMIT_SOLO_RESULT:
      return { success: false };
    case EP_SAVE_QUIZ:
    case EP_UPDATE_QUIZ:
    case EP_DELETE_QUIZ:
    case EP_CLONE_QUIZ:
      return { success: false };
    default:
      return { ok: true };
  }
}

export async function callEndpoint(endpointName, params = {}) {
  const serverless = window.Telegram?.WebApp?.Serverless;

  if (serverless && typeof serverless.call === 'function') {
    return new Promise((resolve) => {
      let resolved = false;

      // 12s watchdog timeout
      const timer = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          console.warn(`[API Timeout] ${endpointName}`);
          resolve({
            ...getCleanDefaults(endpointName),
            success: false,
            error: 'Server javob bermadi (taymaut)',
          });
        }
      }, 12000);

      try {
        serverless.call(endpointName, params, (err, res) => {
          if (resolved) return;
          resolved = true;
          clearTimeout(timer);

          if (err) {
            console.error(`[API Error] ${endpointName}:`, err);
            const errMsg = err?.description || err?.message || 'Server bilan bog\'lanishda xatolik';
            resolve({
              ...getCleanDefaults(endpointName),
              success: false,
              error: errMsg,
            });
          } else {
            resolve(res);
          }
        });
      } catch (ex) {
        if (!resolved) {
          resolved = true;
          clearTimeout(timer);
          console.error(`[API Exception] ${endpointName}:`, ex);
          resolve({
            ...getCleanDefaults(endpointName),
            success: false,
            error: ex?.message || 'Server bilan bog\'lanishda xatolik',
          });
        }
      }
    });
  }

  // Fallback for browsers outside Telegram
  console.warn(`[API] Serverless not available for ${endpointName}`);
  return {
    ...getCleanDefaults(endpointName),
    success: false,
    error: 'Telegram muhiti topilmadi',
  };
}

export default { callEndpoint };
