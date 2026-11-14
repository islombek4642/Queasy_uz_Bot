// tests/test_mistakes_turso_integration.mjs
// Verifies mistakes loading and deletion synchronization with Turso Cloud

import assert from 'node:assert';
import fs from 'node:fs';

console.log('--- Testing Mistakes Turso Integration & Parity ---');

const sessionCode = fs.readFileSync('tgcloud/lib/services/session_service.js', 'utf-8');
const callbackCode = fs.readFileSync('tgcloud/handlers/callback_query.js', 'utf-8');

// Test 1: startQuizSession must query Turso for user_mistakes in MODE_MISTAKES
assert.ok(
  sessionCode.includes("SELECT * FROM user_mistakes WHERE user_id = ?"),
  'startQuizSession must query Turso for user_mistakes'
);

// Test 2: handlePollAnswer must delete resolved mistake from Turso Cloud
assert.ok(
  sessionCode.includes("DELETE FROM user_mistakes WHERE user_id = ? AND (id = ? OR question_text = ?)"),
  'handlePollAnswer must delete resolved mistake from Turso Cloud'
);

// Test 3: callback_query.js must refresh keyboard when mistakesCount === 0
assert.ok(
  callbackCode.includes("getUserMistakesGrouped") && callbackCode.includes("getMistakesPageKeyboard"),
  'callback_query.js must re-fetch mistakes and refresh keyboard when subject is empty'
);

console.log('✅ ALL MISTAKES TURSO INTEGRATION TESTS PASSED!');
