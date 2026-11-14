// tests/test_live_room_crash_resilience.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';

console.log('Testing Live Room Crash Resilience & Safe Rendering...');

// 1. Verify LiveRoomView does NOT reference undeclared handleConfirmStartMode
const liveRoomContent = fs.readFileSync('src/views/LiveRoomView.jsx', 'utf8');
assert(
  !liveRoomContent.includes('handleConfirmStartMode'),
  'LiveRoomView must not contain undefined handleConfirmStartMode which causes ReferenceError'
);

// 2. Verify safe user name slicing in LiveRoomView (prevents TypeError: Cannot read properties of undefined reading slice)
assert(
  liveRoomContent.includes("(p?.userName || 'O\\'yinchi').slice(0, 1)") ||
  liveRoomContent.includes('(p?.userName || "O\'yinchi").slice(0, 1)') ||
  liveRoomContent.includes('(p?.userName || \'O\'yinchi\')'),
  'LiveRoomView must defensively guard p.userName before calling .slice'
);

// 3. Verify room.status check for isFinished
assert(
  liveRoomContent.includes("const isFinished = room.status === 'finished'"),
  'LiveRoomView must only consider a room finished when room.status === finished'
);

// 4. Verify get_live_room_state logic for hasFinished
const stateEndpointContent = fs.readFileSync('tgcloud/endpoints/get_live_room_state.js', 'utf8');
assert(
  stateEndpointContent.includes("const isRoomFinished = room.status === 'finished'"),
  'get_live_room_state must tie hasFinished to room.status === finished'
);
assert(
  !stateEndpointContent.includes('hasFinished: p.score >= 0'),
  'get_live_room_state must not prematurely mark players as finished using score >= 0'
);

// 5. Verify GroupHostView safely retrieves quizId
const groupHostContent = fs.readFileSync('src/views/GroupHostView.jsx', 'utf8');
assert(
  groupHostContent.includes('modeConfig?.quizId || modeModalQuizId'),
  'GroupHostView must fallback to modeConfig.quizId if modeModalQuizId is cleared'
);

console.log('✅ Live Room Crash Resilience test passed successfully!');
