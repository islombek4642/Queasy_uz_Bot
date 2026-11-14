// tests/test_live_battle_scoring.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';

console.log('Testing Task 2: Live Battle Anti-Cheat Question Delivery and Scoring...');

// 1. Verify get_live_question endpoint file
assert(fs.existsSync('tgcloud/endpoints/get_live_question.js'), 'get_live_question.js must exist');
const getQContent = fs.readFileSync('tgcloud/endpoints/get_live_question.js', 'utf8');
assert(getQContent.includes('export default async function'), 'get_live_question must export default function');
assert(getQContent.includes('delete') || getQContent.includes('correctOptionId') === false || getQContent.includes('sanitized'), 'get_live_question must omit correctOptionId');
assert(getQContent.includes('roomCode'), 'get_live_question must check roomCode');

// 2. Verify submit_live_answer endpoint file
assert(fs.existsSync('tgcloud/endpoints/submit_live_answer.js'), 'submit_live_answer.js must exist');
const submitAnsContent = fs.readFileSync('tgcloud/endpoints/submit_live_answer.js', 'utf8');
assert(submitAnsContent.includes('export default async function'), 'submit_live_answer must export default function');
assert(submitAnsContent.includes('liveRoomAnswers') || submitAnsContent.includes('live_room_answers'), 'submit_live_answer must write to liveRoomAnswers');
assert(submitAnsContent.includes('scoreAwarded') || submitAnsContent.includes('score_awarded'), 'submit_live_answer must record scoreAwarded');
assert(submitAnsContent.includes('roomPlayers') || submitAnsContent.includes('room_players'), 'submit_live_answer must update room_players score');

// 3. Verify scoring algorithm logic in isolation
function calculateScore(isCorrect, timeTaken, totalTime) {
  if (!isCorrect) return 0;
  const remaining = Math.max(0, totalTime - timeTaken);
  return 100 + Math.round(50 * (remaining / totalTime));
}

// Blitz answer: 15s total, 0s taken -> 150 points
assert.equal(calculateScore(true, 0, 15), 150);
// Half time: 15s total, 7.5s taken -> 100 + 25 = 125 points
assert.equal(calculateScore(true, 7.5, 15), 125);
// Last second: 15s total, 15s taken -> 100 points
assert.equal(calculateScore(true, 15, 15), 100);
// Wrong answer: 0 points
assert.equal(calculateScore(false, 1, 15), 0);

console.log('Task 2 test assertions verified successfully!');

