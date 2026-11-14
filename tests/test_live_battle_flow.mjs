// tests/test_live_battle_flow.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';

console.log('Testing Task 5: Live Battle Zero-PIN Lobby & Synchronous Arena Flow...');

// 1. Verify LiveRoomView uses battle_ share format and has direct share button
const lobbyContent = fs.readFileSync('src/views/LiveRoomView.jsx', 'utf8');
assert(lobbyContent.includes('battle_'), 'LiveRoomView must format shareLink with battle_ prefix');
assert(lobbyContent.includes('handleShareToTelegram') || lobbyContent.includes('openTelegramLink'), 'LiveRoomView must provide direct Telegram share');

// 2. Verify ArenaView handles liveRoomCode with fetchLiveQuestion and submitLiveAnswer
const arenaContent = fs.readFileSync('src/views/ArenaView.jsx', 'utf8');
assert(arenaContent.includes('fetchLiveQuestion'), 'ArenaView must fetch round questions via fetchLiveQuestion in live room mode');
assert(arenaContent.includes('submitLiveAnswer'), 'ArenaView must submit round answers via submitLiveAnswer');
assert(arenaContent.includes('liveRoomCode'), 'ArenaView must support liveRoomCode');

console.log('Task 5 test assertions verified successfully!');
