// src/services/quizService.js
import { callEndpoint } from './api.js';
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

export async function fetchInitialData() {
  return await callEndpoint(EP_GET_INITIAL_DATA);
}

export async function fetchQuizDetail(quizId) {
  return await callEndpoint(EP_GET_QUIZ_DETAIL, { quizId });
}

export async function submitSoloResult(payload) {
  return await callEndpoint(EP_SUBMIT_SOLO_RESULT, payload);
}

export async function fetchLeaderboard(timeframe = 'all') {
  return await callEndpoint(EP_GET_LEADERBOARD, { timeframe });
}

export async function fetchGroupSessions() {
  return await callEndpoint(EP_GET_GROUP_SESSIONS);
}

export async function saveCustomQuiz(quizData) {
  return await callEndpoint(EP_SAVE_QUIZ, quizData);
}

export async function deleteQuiz(quizId) {
  return await callEndpoint(EP_DELETE_QUIZ, { quizId });
}

export async function updateQuiz(payload) {
  return await callEndpoint(EP_UPDATE_QUIZ, payload);
}

export async function fetchUserMistakes() {
  return await callEndpoint(EP_GET_USER_MISTAKES);
}

export async function fetchKiutCatalog(categoryPath = '', search = '') {
  return await callEndpoint(EP_GET_KIUT_CATALOG, { categoryPath, search });
}

export async function cloneQuiz(quizId) {
  return await callEndpoint(EP_CLONE_QUIZ, { quizId });
}

