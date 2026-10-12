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
      return { success: false };
    default:
      return { ok: true };
  }
}

export async function callEndpoint(endpointName, params = {}) {
  const initData = window.Telegram?.WebApp?.initData || '';

  // 1. Try real HTTP call to /api/<endpointName>
  try {
    const res = await fetch(`/api/${endpointName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(initData ? { 'Authorization': `tma ${initData}`, 'x-telegram-init-data': initData } : {}),
      },
      body: JSON.stringify(params),
    });

    if (res.ok) {
      const data = await res.json();
      return data;
    } else {
      console.warn(`[API ${res.status}] ${endpointName}`);
    }
  } catch (err) {
    console.warn(`[API Network Error] ${endpointName}:`, err?.message);
  }

  // 2. Return clean empty data if offline or unauthorized
  return getCleanDefaults(endpointName);
}

export default { callEndpoint };
