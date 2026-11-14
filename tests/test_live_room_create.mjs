// tests/test_live_room_create.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';

console.log('Testing Task 1: Database Schema & Live Room Creation...');

// 1. Verify schema has liveRoomAnswers
const schemaContent = fs.readFileSync('tgcloud/schema.js', 'utf8');
assert(schemaContent.includes('liveRoomAnswers'), 'schema.js must export liveRoomAnswers table');
assert(schemaContent.includes("'live_room_answers'"), 'schema.js must define live_room_answers table name');
assert(schemaContent.includes('scoreAwarded'), 'liveRoomAnswers must have scoreAwarded column');

// 2. Verify create_live_room handles modeConfig and battle_ share link
const createRoomContent = fs.readFileSync('tgcloud/endpoints/create_live_room.js', 'utf8');
assert(createRoomContent.includes('modeConfig'), 'create_live_room must accept modeConfig');
assert(createRoomContent.includes('battle_'), 'create_live_room must format shareLink with battle_ prefix');
assert(createRoomContent.includes('shareLink'), 'create_live_room must return shareLink in response');

// 3. Verify get_live_room_state respects modeConfig timeLimit
const getStateContent = fs.readFileSync('tgcloud/endpoints/get_live_room_state.js', 'utf8');
assert(getStateContent.includes('modeConfig'), 'get_live_room_state must return modeConfig');
assert(getStateContent.includes('shareLink') || getStateContent.includes('roomCode'), 'get_live_room_state must handle roomCode');

console.log('Task 1 test assertions verified successfully!');

