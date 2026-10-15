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
  EP_CLONE_QUIZ,
  EP_CREATE_TOURNAMENT,
  EP_GET_TOURNAMENT_DETAILS,
  EP_SUBMIT_TOURNAMENT_RESULT,
  EP_CREATE_LIVE_ROOM,
  EP_GET_LIVE_ROOM_STATE,
  EP_START_LIVE_ROOM,
  EP_SUBMIT_LIVE_ROOM_RESULT,
  EP_FINISH_LIVE_ROOM,
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

export async function createTournament(quizId) {
  return await callEndpoint(EP_CREATE_TOURNAMENT, { quizId });
}

export async function fetchTournamentDetails(shareCode) {
  return await callEndpoint(EP_GET_TOURNAMENT_DETAILS, { shareCode });
}

export async function submitTournamentResult(payload) {
  return await callEndpoint(EP_SUBMIT_TOURNAMENT_RESULT, payload);
}

export async function createLiveRoom(quizId) {
  return await callEndpoint(EP_CREATE_LIVE_ROOM, { quizId });
}

export async function fetchLiveRoomState(roomCode) {
  return await callEndpoint(EP_GET_LIVE_ROOM_STATE, { roomCode });
}

export async function startLiveRoom(roomCode, modeConfig = null) {
  return await callEndpoint(EP_START_LIVE_ROOM, { roomCode, modeConfig });
}

export async function submitLiveRoomResult(payload) {
  return await callEndpoint(EP_SUBMIT_LIVE_ROOM_RESULT, payload);
}

export async function finishLiveRoom(roomCode) {
  return await callEndpoint(EP_FINISH_LIVE_ROOM, { roomCode });
}



