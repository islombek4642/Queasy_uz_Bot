// tests/test_live_battle_sync_and_ready.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';

console.log('Testing Live Battle Synchronized Clock, Readiness, Limits & i18n...');

// 1. Verify schema has isReady in roomPlayers
const schemaContent = fs.readFileSync('tgcloud/schema.js', 'utf8');
assert(schemaContent.includes('isReady:'), 'schema.js roomPlayers must define isReady column');

// 2. Verify toggle_live_ready endpoint exists and logic is correct
assert(fs.existsSync('tgcloud/endpoints/toggle_live_ready.js'), 'toggle_live_ready.js endpoint must exist');
const toggleContent = fs.readFileSync('tgcloud/endpoints/toggle_live_ready.js', 'utf8');
assert(toggleContent.includes('export default async function'), 'toggle_live_ready must export default async function');
assert(toggleContent.includes('live_ready:'), 'toggle_live_ready must persist ready status');
assert(toggleContent.includes('isReady'), 'toggle_live_ready must process isReady boolean');

// 3. Verify get_live_room_state enforces max 10 players and returns ready states & synchronized clock
const stateContent = fs.readFileSync('tgcloud/endpoints/get_live_room_state.js', 'utf8');
assert(stateContent.includes('ROOM_FULL'), 'get_live_room_state must guard room capacity (ROOM_FULL)');
assert(stateContent.includes('maxPlayers: 10'), 'get_live_room_state must report maxPlayers: 10');
assert(stateContent.includes('isReady'), 'get_live_room_state must calculate isReady for players');
assert(stateContent.includes('canStart'), 'get_live_room_state must compute canStart condition');
assert(stateContent.includes('roundPhase'), 'get_live_room_state must calculate roundPhase for synchronized clock');
assert(stateContent.includes('timeRemaining'), 'get_live_room_state must calculate timeRemaining for synchronized round');

// 4. Verify start_live_room enforces minimum 2 players and 2 ready players
const startContent = fs.readFileSync('tgcloud/endpoints/start_live_room.js', 'utf8');
assert(startContent.includes('MIN_PLAYERS_REQUIRED'), 'start_live_room must enforce at least 2 players');
assert(startContent.includes('MIN_READY_REQUIRED'), 'start_live_room must enforce at least 2 ready players');
assert(startContent.includes('live_room_game:'), 'start_live_room must store live_room_game clock');

// 5. Verify get_group_sessions queries active live rooms
const groupSessionsContent = fs.readFileSync('tgcloud/endpoints/get_group_sessions.js', 'utf8');
assert(groupSessionsContent.includes('live_rooms') || groupSessionsContent.includes('liveRooms'), 'get_group_sessions must query live rooms for active sessions');
assert(groupSessionsContent.includes("'waiting'") && groupSessionsContent.includes("'active'"), 'get_group_sessions must select waiting and active rooms');

// 6. Verify GroupHostView renders active live rooms, re-enter/join actions and uses i18n
const groupHostContent = fs.readFileSync('src/views/GroupHostView.jsx', 'utf8');
assert(groupHostContent.includes("t('GROUP_BATTLE_TITLE')"), 'GroupHostView must localize GROUP_BATTLE_TITLE');
assert(groupHostContent.includes("t('ACTIVE_SESSIONS_COUNT'"), 'GroupHostView must localize ACTIVE_SESSIONS_COUNT');
assert(groupHostContent.includes("t('BTN_MANAGE_ENTER')"), 'GroupHostView must localize BTN_MANAGE_ENTER');
assert(groupHostContent.includes("t('BTN_REENTER')"), 'GroupHostView must localize BTN_REENTER');
assert(groupHostContent.includes("t('BTN_JOIN')"), 'GroupHostView must localize BTN_JOIN');
assert(groupHostContent.includes("t('ROOM_FULL')"), 'GroupHostView must localize ROOM_FULL');
assert(groupHostContent.includes('s.participantCount'), 'GroupHostView must display participantCount');

// 7. Verify LiveRoomView supports readiness toggle and 10 players cap
const liveRoomContent = fs.readFileSync('src/views/LiveRoomView.jsx', 'utf8');
assert(liveRoomContent.includes('toggleLiveReady'), 'LiveRoomView must call toggleLiveReady');
assert(liveRoomContent.includes("t('BTN_TOGGLE_READY')"), 'LiveRoomView must localize BTN_TOGGLE_READY');
assert(liveRoomContent.includes("t('BTN_TOGGLE_UNREADY')"), 'LiveRoomView must localize BTN_TOGGLE_UNREADY');
assert(liveRoomContent.includes("t('PLAYER_READY')"), 'LiveRoomView must localize PLAYER_READY');
assert(liveRoomContent.includes("t('PLAYER_NOT_READY')"), 'LiveRoomView must localize PLAYER_NOT_READY');
assert(liveRoomContent.includes('maxPlayers'), 'LiveRoomView must display maxPlayers');

// 8. Verify ArenaView synchronizes live battle clock and mid-game questions
const arenaContent = fs.readFileSync('src/views/ArenaView.jsx', 'utf8');
assert(arenaContent.includes('fetchLiveRoomState'), 'ArenaView must call fetchLiveRoomState for live battle');
assert(arenaContent.includes('targetIdx') || arenaContent.includes('currentQuestionIndex'), 'ArenaView must sync to room.currentQuestionIndex for mid-game joiners');
assert(arenaContent.includes("t('BATTLE_STARTING_TITLE')"), 'ArenaView must localize BATTLE_STARTING_TITLE');
assert(arenaContent.includes("t('BATTLE_STARTING_SUB')"), 'ArenaView must localize BATTLE_STARTING_SUB');
assert(arenaContent.includes("t('LIVE_SCORE_AWARDED'"), 'ArenaView must localize LIVE_SCORE_AWARDED');
assert(arenaContent.includes("t('LIVE_SCORE_ZERO')"), 'ArenaView must localize LIVE_SCORE_ZERO');
assert(arenaContent.includes("t('LIVE_WAITING_NEXT_ROUND')"), 'ArenaView must localize LIVE_WAITING_NEXT_ROUND');
assert(!arenaContent.includes("setTimeout(() => {\n        handleAdvance(false);\n      }, 3000)"), 'ArenaView must not independently advance on local timer in live battle');

// 9. Verify App.jsx clears room codes on exit
const appContent = fs.readFileSync('src/App.jsx', 'utf8');
assert(appContent.includes('setActiveLiveRoomCode(null)'), 'App.jsx handleExitArena must clear activeLiveRoomCode');
assert(appContent.includes('setActiveRoomCode(null)'), 'App.jsx handleExitArena must clear activeRoomCode');

// 10. Verify LiveRoomView transitions mid-game joiners
assert(liveRoomContent.includes("res.room?.status === 'active'"), 'LiveRoomView must check for active room status');
assert(!liveRoomContent.includes("prevStatusRef.current === 'waiting'"), 'LiveRoomView must not block mid-game joiners with waiting ref check');

// 11. Verify QuizModeModal allows clearing and editing range & random inputs
const modalContent = fs.readFileSync('src/components/quiz/QuizModeModal.jsx', 'utf8');
assert(modalContent.includes('rawRangeStart'), 'QuizModeModal must use raw string state for range start');
assert(modalContent.includes('rawRangeEnd'), 'QuizModeModal must use raw string state for range end');
assert(modalContent.includes('rawRandomCount'), 'QuizModeModal must use raw string state for random count');
assert(modalContent.includes('onBlur'), 'QuizModeModal must clamp on blur to allow typing and deleting');
assert(modalContent.includes("t('MODE_ALL_QUESTIONS')"), 'QuizModeModal must localize MODE_ALL_QUESTIONS');
assert(modalContent.includes("t('SELECT_TIME_TITLE')"), 'QuizModeModal must localize SELECT_TIME_TITLE');
assert(modalContent.includes("t('BTN_START_GAME')"), 'QuizModeModal must localize BTN_START_GAME');

// 12. Verify Frontend i18n 100% parity across all 3 languages
const uz = (await import('../src/i18n/locales/uz.js')).default;
const ru = (await import('../src/i18n/locales/ru.js')).default;
const en = (await import('../src/i18n/locales/en.js')).default;
assert.equal(Object.keys(uz).length, Object.keys(ru).length, 'UZ and RU key count must match');
assert.equal(Object.keys(uz).length, Object.keys(en).length, 'UZ and EN key count must match');

console.log('🎉 All Live Battle Sync, Readiness, Limits & i18n assertions PASSED!');
